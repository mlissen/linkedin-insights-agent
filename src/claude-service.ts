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

  async analyzePost(post: LinkedInPost, focusTopics?: string[]): Promise<{
    insights: SalesInsight[];
    templates: string[];
    actionableItems: string[];
    methodologies: Array<{name: string, description: string, application?: string}>;
  }> {
    const prompt = this.buildAnalysisPrompt(post, focusTopics);

    try {
      // Check if post has images and download them if present
      const imageContent: Anthropic.ImageBlockParam[] = [];
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
        model: "claude-3-haiku-20240307",
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

    return `Analyze this LinkedIn post for actionable insights, strategies, guidance, and tactics:

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
${topicsContext}

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

    console.log(`🤖 Starting AI analysis of ${posts.length} posts in batches of ${batchSize}...`);

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      console.log(`🔍 Analyzing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)} (posts ${i+1}-${Math.min(i+batchSize, posts.length)})`);

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
      if (i + batchSize < posts.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ AI analysis complete! Extracted ${allInsights.length} insights, ${allTemplates.length} templates, ${allActionableItems.length} actionable items`);

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
