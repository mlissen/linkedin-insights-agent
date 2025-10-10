import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { LinkedInPost, SalesInsight, SalesCategory } from './types.js';
import axios from 'axios';

interface ExternalResourceSuggestion {
  primaryWebsite?: string;
  blogUrls?: string[];
  otherResources?: string[];
}

export class ClaudeService {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  async scorePostRelevance(post: LinkedInPost, focusTopics?: string[]): Promise<number> {
    const topicsContext = focusTopics && focusTopics.length > 0
      ? focusTopics.join(', ')
      : 'fundraising, venture capital, investment, startup funding';

    const prompt = `You are evaluating whether a LinkedIn post is relevant to the following topics: ${topicsContext}

POST CONTENT:
"${post.content.substring(0, 1000)}"

POST TYPE: ${post.contentType || 'post'}

Task: Score how relevant this post is to the focus topics on a scale of 0.0 to 1.0, where:
- 1.0 = Highly relevant (directly discusses ${topicsContext})
- 0.5 = Somewhat relevant (mentions topics tangentially)
- 0.0 = Not relevant (completely off-topic: recruiting, product marketing, events, personal updates, etc.)

Respond ONLY with valid JSON in this exact format:
{"relevance": 0.8}`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const parsed = this.parseJsonResponse<{ relevance: number }>(content.text);
        if (parsed && typeof parsed.relevance === 'number') {
          return Math.max(0, Math.min(1, parsed.relevance)); // Clamp to 0-1
        }
      }
      return 0; // Default to not relevant if parsing fails
    } catch (error: any) {
      console.error('Error scoring post relevance:', error.message);
      return 0.5; // Default to neutral if error
    }
  }

  async analyzePost(post: LinkedInPost, focusTopics?: string[]): Promise<{
    insights: SalesInsight[];
    templates: string[];
    actionableItems: string[];
    methodologies: Array<{name: string, description: string, application?: string}>;
  }> {
    const prompt = this.buildAnalysisPrompt(post, focusTopics);

    // Declare imageContent outside try block so it's accessible in catch
    let imageContent: Anthropic.ImageBlockParam[] = [];

    try {
      // Check if post has images and download them if present
      if (post.imageUrls && post.imageUrls.length > 0) {
        console.log(`🖼️  Post ${post.id} has ${post.imageUrls.length} images, downloading for analysis...`);
        for (const imageUrl of post.imageUrls.slice(0, 5)) { // Limit to 5 images per post
          try {
            const imageData = await this.downloadImageAsBase64(imageUrl);
            if (imageData) {
              imageContent.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageData.mediaType,
                  data: imageData.base64
                }
              });
            }
          } catch (error: any) {
            console.log(`⚠️  Failed to download image ${imageUrl}:`, error.message);
          }
        }
      }

      // Build message content with text and images
      const messageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [
        { type: 'text', text: prompt },
        ...imageContent
      ];

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: messageContent
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return this.parseAnalysisResponse(content.text, post);
      } else {
        throw new Error('Unexpected response type from Claude');
      }
    } catch (error: any) {
      console.error('Error analyzing post with Claude:', error);

      // If we had images and the error was image-related, retry without images
      if (imageContent.length > 0 && error.message && error.message.includes('image')) {
        console.log(`🔄 Retrying post ${post.id} without images...`);
        try {
          const response = await this.anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [{ type: 'text', text: prompt }]
            }]
          });

          const content = response.content[0];
          if (content.type === 'text') {
            return this.parseAnalysisResponse(content.text, post);
          }
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError.message);
        }
      }

      return {
        insights: [],
        templates: [],
        actionableItems: [],
        methodologies: []
      };
    }
  }

  async suggestExternalResources(params: { profileName: string; externalLinks: string[] }): Promise<ExternalResourceSuggestion | null> {
    if (!params.externalLinks || params.externalLinks.length === 0) {
      return null;
    }

    const limitedLinks = params.externalLinks.slice(0, 20);
    const prompt = `You are helping map additional content sources for the LinkedIn expert "${params.profileName}".

Provided below are external URLs referenced in their LinkedIn activity:
${limitedLinks.map((link, index) => `${index + 1}. ${link}`).join('\n')}

Task:
- Identify the person's primary official website (if any).
- Identify up to 5 blog, newsletter, or long-form content URLs worth scraping for deeper insights.
- Note any other high-value resources (e.g., podcasts, playbooks, resources).

Important rules:
- Prefer URLs from the provided list. Only add new URLs if you are highly confident they are official resources.
- If unsure, leave the field empty.
- Respond in strict JSON format with keys: primaryWebsite (string), blogUrls (array of strings), otherResources (array of strings).
- Do not include commentary outside the JSON.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const parsed = this.parseJsonResponse<ExternalResourceSuggestion>(content.text);
        if (!parsed) return null;
        return {
          primaryWebsite: parsed.primaryWebsite,
          blogUrls: parsed.blogUrls || [],
          otherResources: parsed.otherResources || []
        };
      }
    } catch (error: any) {
      console.log('⚠️ Claude resource discovery failed:', error.message);
      return null;
    }

    return null;
  }

  private buildAnalysisPrompt(post: LinkedInPost, focusTopics?: string[]): string {
    const linkDetails = (post.links || []).slice(0, 3).map((link, index) => `  ${index + 1}. ${link}`).join('\n');
    const imageCount = post.imageUrls?.length || 0;
    const hasImages = imageCount > 0;

    const topicsContext = focusTopics && focusTopics.length > 0
      ? `Focus on insights related to: ${focusTopics.join(', ')}.`
      : '';

    return `CRITICAL INSTRUCTION: Only extract insights if this post directly discusses fundraising, venture capital, investment, startup funding, or closely related topics. If this post is primarily about:
- Recruiting or job postings
- Product marketing or product launches
- Events, webinars, or conferences
- Personal updates, congratulations, or celebrations
- Unrelated business topics (packaging, tires, manufacturing, etc.)

Then return EMPTY ARRAYS for all categories. Do not try to force insights from irrelevant content.

${topicsContext}

Analyze this LinkedIn post for actionable insights, strategies, guidance, and tactics:

POST CONTENT:
"${post.content}"

POST TYPE: ${post.contentType || 'post'}

POST METRICS:
- Likes: ${post.engagement.likes}
- Comments: ${post.engagement.comments}
- Shares: ${post.engagement.shares}

LINKS MENTIONED:
${linkDetails || '  (no external links captured)'}

${hasImages ? `IMAGES: This post contains ${imageCount} image(s). IMPORTANT: Carefully analyze the image(s) for:
- Frameworks, playbooks, step-by-step processes, or systematic approaches shown visually
- Diagrams, flowcharts, visual strategies, or process maps
- Lists, checklists, numbered steps, or tactical guidance visible in screenshots
- Any text, tables, charts, or data visualization containing actionable insights
- Templates, examples, or specific methodologies displayed
Treat insights from images with EQUAL WEIGHT to text content. Extract all frameworks and playbooks visible in the images.\n` : ''}

Please analyze this post and extract:

1. INSIGHTS: Identify specific strategies, techniques, or approaches mentioned IN BOTH TEXT AND IMAGES. For each insight:
   - Category it as: PROSPECTING, DISCOVERY, NURTURE, CLOSING, SALES_COMMS, CADENCES, STRATEGY, TEMPLATES, or TACTICS
   - Extract the key insight in 1-2 sentences
   - Rate confidence (0.1-1.0) based on engagement and specificity
   - If the insight came from an image, make sure to extract it completely

2. TEMPLATES: Extract any templates, scripts, or copy-paste content that could be reused (from text OR images)

3. ACTIONABLE ITEMS: Identify specific actions someone could take based on this post (including steps shown in images)

4. METHODOLOGIES: Identify any named methodologies, frameworks, or systematic approaches (especially those shown in images, diagrams, or visual content)

Respond in this exact JSON format:
{
  "insights": [
    {
      "category": "CATEGORY_NAME",
      "insight": "The specific insight or technique",
      "confidence": 0.8
    }
  ],
  "templates": [
    "Exact template or script text"
  ],
  "actionableItems": [
    "Specific action someone should take"
  ],
  "methodologies": [
    {
      "name": "Methodology Name",
      "description": "What it is and how it works",
      "application": "When and how to use it"
    }
  ]
}

Only include actual insights from the post content. If no insights are found in a category, leave that array empty.`;
  }

  private parseAnalysisResponse(response: string, post: LinkedInPost): {
    insights: SalesInsight[];
    templates: string[];
    actionableItems: string[];
    methodologies: Array<{name: string, description: string, application?: string}>;
  } {
    try {
      const parsed = this.parseJsonResponse<any>(response);
      if (!parsed) {
        throw new Error('No JSON found in Claude response');
      }

      const insights: SalesInsight[] = (parsed.insights || []).map((insight: any, index: number) => ({
        id: `${post.id}-ai-${index}`,
        category: this.mapCategory(insight.category),
        insight: insight.insight,
        sourcePost: post,
        confidence: insight.confidence || 0.5,
        extractedAt: new Date().toISOString(),
        actionableItems: parsed.actionableItems || [],
        templates: parsed.templates || []
      }));

      return {
        insights,
        templates: parsed.templates || [],
        actionableItems: parsed.actionableItems || [],
        methodologies: parsed.methodologies || []
      };
    } catch (error: any) {
      console.error('Error parsing Claude response:', error);
      console.error('Raw response:', response);
      return {
        insights: [],
        templates: [],
        actionableItems: [],
        methodologies: []
      };
    }
  }

  private extractJsonString(responseText: string): string | null {
    if (!responseText) return null;

    const normalized = responseText
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : null;
  }

  private parseJsonResponse<T>(responseText: string): T | null {
    const jsonPayload = this.extractJsonString(responseText);
    if (!jsonPayload) return null;

    try {
      return JSON.parse(jsonPayload) as T;
    } catch (parseError: any) {
      console.warn('Initial JSON parse failed, attempting repair:', parseError.message);
      try {
        return JSON.parse(jsonrepair(jsonPayload)) as T;
      } catch (repairError: any) {
        console.error('Failed to repair JSON payload:', repairError);
        return null;
      }
    }
  }

  private mapCategory(category: string): SalesCategory {
    const categoryMap: Record<string, SalesCategory> = {
      'PROSPECTING': SalesCategory.PROSPECTING,
      'DISCOVERY': SalesCategory.DISCOVERY,
      'NURTURE': SalesCategory.NURTURE,
      'CLOSING': SalesCategory.CLOSING,
      'SALES_COMMS': SalesCategory.SALES_COMMS,
      'CADENCES': SalesCategory.CADENCES,
      'STRATEGY': SalesCategory.STRATEGY,
      'TEMPLATES': SalesCategory.TEMPLATES,
      'TACTICS': SalesCategory.TACTICS
    };

    return categoryMap[category] || SalesCategory.TACTICS;
  }

  async batchAnalyzePosts(posts: LinkedInPost[], batchSize: number = 5, focusTopics?: string[]): Promise<{
    insights: SalesInsight[];
    templates: string[];
    actionableItems: string[];
    methodologies: Array<{name: string, description: string, application?: string}>;
  }> {
    const allInsights: SalesInsight[] = [];
    const allTemplates: string[] = [];
    const allActionableItems: string[] = [];
    const allMethodologies: Array<{name: string, description: string, application?: string}> = [];

    console.log(`🤖 Starting two-pass AI analysis of ${posts.length} posts...`);

    // PASS 1: Score relevance with Haiku (fast & cheap)
    console.log(`📊 Pass 1: Scoring post relevance with Haiku...`);
    const relevanceScores: { post: LinkedInPost; score: number }[] = [];

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const scorePromises = batch.map(async post => ({
        post,
        score: await this.scorePostRelevance(post, focusTopics)
      }));
      const batchScores = await Promise.all(scorePromises);
      relevanceScores.push(...batchScores);

      if (i + batchSize < posts.length) {
        // Longer wait to avoid rate limits (50 req/min = 1 req every 1.2s)
        // With batchSize=5, wait 6+ seconds between batches
        await new Promise(resolve => setTimeout(resolve, 7000));
      }
    }

    // Filter posts by relevance threshold
    const relevantPosts = relevanceScores.filter(({ score }) => score > 0.6).map(({ post }) => post);
    const filteredCount = posts.length - relevantPosts.length;
    console.log(`✅ Pass 1 complete: ${relevantPosts.length}/${posts.length} posts are relevant (filtered out ${filteredCount} off-topic posts)`);

    if (relevantPosts.length === 0) {
      console.log(`⚠️  No relevant posts found. Skipping Pass 2.`);
      return {
        insights: [],
        templates: [],
        actionableItems: [],
        methodologies: []
      };
    }

    // PASS 2: Extract insights with Sonnet (high quality, relevant posts only)
    console.log(`🧠 Pass 2: Extracting insights from ${relevantPosts.length} relevant posts with Sonnet...`);

    for (let i = 0; i < relevantPosts.length; i += batchSize) {
      const batch = relevantPosts.slice(i, i + batchSize);
      console.log(`🔍 Analyzing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(relevantPosts.length/batchSize)} (posts ${i+1}-${Math.min(i+batchSize, relevantPosts.length)})`);

      // Process batch in parallel
      const batchPromises = batch.map(post => this.analyzePost(post, focusTopics));
      const batchResults = await Promise.all(batchPromises);

      // Aggregate results
      for (const result of batchResults) {
        allInsights.push(...result.insights);
        allTemplates.push(...result.templates);
        allActionableItems.push(...result.actionableItems);
        allMethodologies.push(...result.methodologies);
      }

      // Rate limiting - wait between batches
      if (i + batchSize < relevantPosts.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Pass 2 complete! Extracted ${allInsights.length} insights, ${allTemplates.length} templates, ${allActionableItems.length} actionable items`);

    return {
      insights: this.deduplicateInsights(allInsights),
      templates: this.deduplicateStrings(allTemplates),
      actionableItems: this.deduplicateStrings(allActionableItems),
      methodologies: this.deduplicateMethodologies(allMethodologies)
    };
  }

  private deduplicateInsights(insights: SalesInsight[]): SalesInsight[] {
    const seen = new Set<string>();
    return insights.filter(insight => {
      const key = `${insight.category}-${insight.insight.slice(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateStrings(items: string[]): string[] {
    return [...new Set(items.filter(item => item && item.trim().length > 0))];
  }

  private deduplicateMethodologies(methodologies: Array<{name: string, description: string, application?: string}>): Array<{name: string, description: string, application?: string}> {
    const seen = new Set<string>();
    return methodologies.filter(methodology => {
      if (seen.has(methodology.name)) return false;
      seen.add(methodology.name);
      return true;
    });
  }

  private async downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const base64 = Buffer.from(response.data, 'binary').toString('base64');

      // Determine media type from content-type header or URL
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
      const contentType = response.headers['content-type'];

      if (contentType?.includes('png')) {
        mediaType = 'image/png';
      } else if (contentType?.includes('gif')) {
        mediaType = 'image/gif';
      } else if (contentType?.includes('webp')) {
        mediaType = 'image/webp';
      } else if (imageUrl.toLowerCase().endsWith('.png')) {
        mediaType = 'image/png';
      } else if (imageUrl.toLowerCase().endsWith('.gif')) {
        mediaType = 'image/gif';
      } else if (imageUrl.toLowerCase().endsWith('.webp')) {
        mediaType = 'image/webp';
      }

      return { base64, mediaType };
    } catch (error: any) {
      console.error(`Failed to download image from ${imageUrl}:`, error.message);
      return null;
    }
  }
}
