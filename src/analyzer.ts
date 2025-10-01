import { LinkedInPost, SalesInsight, SalesCategory, ScrapingConfig, InsightAnalysis, ExternalArticle } from './types.js';
import { ClaudeService } from './claude-service.js';
import { scrapeExternalArticles } from './external-content.js';
import { SearchService } from './search-service.js';

export class InsightAnalyzer {
  private claudeService: ClaudeService | null;
  private searchService: SearchService;
  private linkedInArticles: ExternalArticle[];

  constructor(options?: { linkedInArticles?: ExternalArticle[] }) {
    this.linkedInArticles = options?.linkedInArticles || [];
    this.searchService = new SearchService();
    // Initialize Claude service, but handle missing API key gracefully
    try {
      this.claudeService = new ClaudeService();
    } catch (error: any) {
      console.warn('Claude API not available, falling back to keyword analysis:', error.message);
      this.claudeService = null;
    }
  }

  async analyzeInsights(posts: LinkedInPost[], config: ScrapingConfig): Promise<InsightAnalysis> {
    if (this.claudeService) {
      return this.analyzeWithAI(posts, config);
    } else {
      return this.analyzeWithKeywords(posts, config);
    }
  }

  private async analyzeWithAI(posts: LinkedInPost[], config: ScrapingConfig): Promise<InsightAnalysis> {
    console.log('🤖 Using AI-powered analysis with Claude...');

    // Filter posts by focus topics if specified
    const relevantPosts = this.filterPostsByTopics(posts, config.focusTopics);
    console.log(`📊 Analyzing ${relevantPosts.length}/${posts.length} posts relevant to focus topics`);

    // Use Claude to analyze posts
    const aiResults = await this.claudeService!.batchAnalyzePosts(relevantPosts, 5, config.focusTopics);

    const enrichment = await this.enrichExternalContent(posts, config);
    const summary = this.generateSummary(aiResults.insights, posts.length);

    return {
      posts,
      insights: aiResults.insights,
      summary,
      actionableInstructions: aiResults.actionableItems,
      templates: aiResults.templates,
      methodologies: aiResults.methodologies,
      externalArticles: enrichment.articles,
      externalSources: enrichment.sources
    };
  }

  private async analyzeWithKeywords(posts: LinkedInPost[], config: ScrapingConfig): Promise<InsightAnalysis> {
    console.log('🔍 Using keyword-based analysis (fallback mode)...');

    const insights: SalesInsight[] = [];
    const templates: string[] = [];
    const actionableInstructions: string[] = [];

    // Fallback to simple keyword matching if Claude isn't available
    const salesKeywords = {
      [SalesCategory.PROSPECTING]: ['prospecting', 'cold outreach', 'lead generation'],
      [SalesCategory.DISCOVERY]: ['discovery call', 'qualifying questions', 'pain points'],
      [SalesCategory.NURTURE]: ['follow up', 'relationship building', 'staying in touch'],
      [SalesCategory.CLOSING]: ['closing deals', 'overcoming objections', 'negotiation'],
      [SalesCategory.SALES_COMMS]: ['sales emails', 'cold emails', 'email templates'],
      [SalesCategory.CADENCES]: ['sales cadence', 'outreach sequence', 'touch points'],
      [SalesCategory.STRATEGY]: ['sales strategy', 'sales methodology', 'framework'],
      [SalesCategory.TEMPLATES]: ['template', 'script', 'copy paste'],
      [SalesCategory.TACTICS]: ['sales tactics', 'techniques', 'best practices']
    };

    for (const post of posts) {
      const postInsights = this.extractInsightsFromPostKeywords(post, config.focusTopics, salesKeywords);
      insights.push(...postInsights);

      const extractedTemplates = this.extractSimpleTemplates(post);
      templates.push(...extractedTemplates);

      const actionableItems = this.extractSimpleActionableItems(post);
      actionableInstructions.push(...actionableItems);
    }

    const enrichment = await this.enrichExternalContent(posts, config);
    const summary = this.generateSummary(insights, posts.length);

    return {
      posts,
      insights: this.deduplicateInsights(insights),
      summary,
      actionableInstructions: this.deduplicateStrings(actionableInstructions),
      templates: this.deduplicateStrings(templates),
      externalArticles: enrichment.articles,
      externalSources: enrichment.sources
    };
  }

  private async enrichExternalContent(posts: LinkedInPost[], config: ScrapingConfig): Promise<{ articles: ExternalArticle[]; sources: string[] }> {
    const externalArticles: ExternalArticle[] = [...this.linkedInArticles];
    const externalSources = new Set<string>(externalArticles.map(article => article.sourceDomain));

    // Extract external links from LinkedIn posts
    const externalLinks = new Set<string>();
    for (const post of posts) {
      if (!post.links) continue;
      for (const link of post.links) {
        if (!link || !link.startsWith('http')) continue;
        if (link.includes('linkedin.com')) continue;

        // Filter out webinar/event URLs
        if (this.isWebinarOrEventUrl(link)) {
          console.log(`⏭️  Skipping webinar/event link: ${link}`);
          continue;
        }

        externalLinks.add(link.split('?')[0]);
      }
    }

    const externalLinkList = Array.from(externalLinks).slice(0, 20);

    // Use search service to discover external content
    console.log('🔍 Searching for external thought leadership content...');
    const searchResults = await this.searchService.searchForPersonContent(config.linkedinUsername);

    // Combine Claude suggestions with search results
    let suggestedBlogUrls: string[] = [...searchResults.personalBlogUrls, ...searchResults.articleUrls];
    let suggestedResourceUrls: string[] = [...searchResults.companyBlogUrls, ...searchResults.resourceUrls];

    // Also try Claude suggestions if available and we have external links
    if (this.claudeService && externalLinkList.length > 0) {
      try {
        const suggestion = await this.claudeService.suggestExternalResources({
          profileName: config.linkedinUsername,
          externalLinks: externalLinkList
        });

        if (suggestion) {
          if (suggestion.primaryWebsite) {
            externalSources.add(this.extractDomain(suggestion.primaryWebsite));
            suggestedResourceUrls.push(suggestion.primaryWebsite);
          }
          if (suggestion.blogUrls && suggestion.blogUrls.length > 0) {
            suggestedBlogUrls.push(...suggestion.blogUrls);
          }
          if (suggestion.otherResources && suggestion.otherResources.length > 0) {
            suggestedResourceUrls.push(...suggestion.otherResources);
          }
        }
      } catch (error: any) {
        console.log('⚠️ Unable to fetch external resource suggestions from Claude:', error.message);
      }
    }

    // Add heuristic blog URLs from LinkedIn links
    const heuristicBlogUrls = externalLinkList.filter(link => /blog|insight|playbook|guide/i.test(link));

    // Combine all URLs and deduplicate
    const urlsToFetch = Array.from(new Set([
      ...suggestedBlogUrls,
      ...heuristicBlogUrls
    ])).slice(0, 15); // Increased limit since we have better discovery

    if (urlsToFetch.length > 0) {
      console.log(`📄 Scraping ${urlsToFetch.length} discovered articles...`);
      const fetchedArticles = await scrapeExternalArticles(urlsToFetch, 'external');
      for (const article of fetchedArticles) {
        if (!externalArticles.find(existing => existing.url === article.url)) {
          externalArticles.push(article);
          externalSources.add(article.sourceDomain);
        }
      }
    }

    // Add all discovered resource domains
    for (const url of suggestedResourceUrls) {
      if (!url) continue;
      externalSources.add(this.extractDomain(url));
    }

    return {
      articles: externalArticles,
      sources: Array.from(externalSources).filter(Boolean)
    };
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return '';
    }
  }

  private isWebinarOrEventUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    // Check for webinar/event platforms
    const eventPlatforms = [
      'zoom.us',
      'eventbrite.com',
      'hopin.com',
      'brighttalk.com',
      'on24.com',
      'webex.com',
      'gotomeeting.com',
      'demio.com',
      'livestorm.com'
    ];

    if (eventPlatforms.some(platform => lowerUrl.includes(platform))) {
      return true;
    }

    // Check for webinar/event keywords in URL path
    const eventKeywords = [
      '/webinar',
      '/event',
      '/register',
      '/registration',
      '/rsvp',
      '/live-event',
      '/upcoming-event',
      '/join-webinar',
      '/watch-webinar'
    ];

    if (eventKeywords.some(keyword => lowerUrl.includes(keyword))) {
      return true;
    }

    // Check for event-related query parameters
    const eventParams = ['?register=', '?event=', '&register=', '&event='];
    if (eventParams.some(param => lowerUrl.includes(param))) {
      return true;
    }

    return false;
  }

  private filterPostsByTopics(posts: LinkedInPost[], focusTopics: string[]): LinkedInPost[] {
    if (focusTopics.length === 0) return posts;

    return posts.filter(post => {
      const content = post.content.toLowerCase();
      return focusTopics.some(topic => content.includes(topic.toLowerCase()));
    });
  }

  private extractInsightsFromPostKeywords(post: LinkedInPost, focusTopics: string[], salesKeywords: Record<SalesCategory, string[]>): SalesInsight[] {
    const insights: SalesInsight[] = [];
    const content = post.content.toLowerCase();

    // Check if post is relevant to focus topics
    const isRelevant = focusTopics.length === 0 ||
      focusTopics.some(topic => content.includes(topic.toLowerCase()));

    if (!isRelevant) return insights;

    // Categorize the post and extract insights
    for (const [category, keywords] of Object.entries(salesKeywords)) {
      const matchingKeywords = keywords.filter(keyword =>
        content.includes(keyword.toLowerCase())
      );

      if (matchingKeywords.length > 0) {
        const insight = this.generateSimpleInsight(post, category as SalesCategory, matchingKeywords);
        if (insight) {
          insights.push(insight);
        }
      }
    }

    return insights;
  }

  private generateSimpleInsight(post: LinkedInPost, category: SalesCategory, keywords: string[]): SalesInsight | null {
    const sentences = post.content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Find sentences that contain the keywords
    const relevantSentences = sentences.filter(sentence =>
      keywords.some(keyword => sentence.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (relevantSentences.length === 0) return null;

    const insightText = relevantSentences.slice(0, 2).join('. ').trim(); // Limit to 2 sentences

    // Simple confidence based on engagement
    const confidence = this.calculateConfidence(post, keywords.length);

    return {
      id: `${post.id}-${category}`,
      category,
      insight: insightText,
      sourcePost: post,
      confidence,
      extractedAt: new Date().toISOString(),
      actionableItems: [],
      templates: []
    };
  }

  private extractSimpleActionableItems(post: LinkedInPost): string[] {
    const content = post.content;
    const actionablePatterns = [
      /try (this|these):[^.!?]*/gi,
      /here's how:[^.!?]*/gi,
      /step \d+:[^.!?]*/gi,
      /you should[^.!?]*/gi,
      /pro tip:[^.!?]*/gi
    ];

    const actionableItems: string[] = [];

    for (const pattern of actionablePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        actionableItems.push(...matches.map(match => match.trim()));
      }
    }

    return actionableItems.slice(0, 3); // Limit to 3 items
  }

  private extractSimpleTemplates(post: LinkedInPost): string[] {
    const content = post.content;
    const templates: string[] = [];

    // Look for quoted text that might be templates
    const templatePatterns = [
      /\"[^\"]{30,}\"/g, // Longer quoted text
      /subject:\s*[^.!?]*/gi,
      /copy this:[^.!?]*/gi
    ];

    for (const pattern of templatePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        templates.push(...matches.map(match => match.trim()));
      }
    }

    return templates.slice(0, 2); // Limit to 2 templates
  }


  private calculateConfidence(post: LinkedInPost, keywordMatches: number): number {
    // Base confidence on keyword matches
    let confidence = Math.min(keywordMatches * 0.2, 0.8);

    // Boost confidence based on engagement
    const totalEngagement = post.engagement.likes + post.engagement.comments + post.engagement.shares;
    if (totalEngagement > 100) confidence += 0.1;
    if (totalEngagement > 500) confidence += 0.1;

    // Ensure confidence is between 0 and 1
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  private generateSummary(insights: SalesInsight[], totalPosts: number): string {
    const categoryCount = insights.reduce((acc, insight) => {
      acc[insight.category] = (acc[insight.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => `${category} (${count} insights)`);

    const highConfidenceInsights = insights.filter(i => i.confidence > 0.7).length;

    return `Analyzed ${totalPosts} posts and extracted ${insights.length} insights. ` +
           `Top categories: ${topCategories.join(', ')}. ` +
           `${highConfidenceInsights} high-confidence insights identified.`;
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
    return [...new Set(items)];
  }
}
