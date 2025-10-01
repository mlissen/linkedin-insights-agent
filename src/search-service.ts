import axios from 'axios';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  displayUrl: string;
}

export interface BlogSearchResult {
  personalBlogUrls: string[];
  companyBlogUrls: string[];
  articleUrls: string[];
  resourceUrls: string[];
}

export class SearchService {
  private braveApiKey: string | null;

  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY || null;
    if (!this.braveApiKey) {
      console.warn('BRAVE_SEARCH_API_KEY not found - external content discovery will be limited');
    }
  }

  async searchForPersonContent(profileName: string, companyName?: string): Promise<BlogSearchResult> {
    if (!this.braveApiKey) {
      console.log('⚠️ Search API unavailable - returning empty results');
      return {
        personalBlogUrls: [],
        companyBlogUrls: [],
        articleUrls: [],
        resourceUrls: []
      };
    }

    console.log(`🔍 Searching for external content for ${profileName}${companyName ? ` at ${companyName}` : ''}...`);

    try {
      const searches = [
        `"${profileName}" blog site:*.com -site:linkedin.com`,
        `"${profileName}" author articles site:medium.com OR site:substack.com`,
        `"${profileName}" thought leadership blog`,
      ];

      if (companyName) {
        searches.push(
          `"${companyName}" blog site:*.com -site:linkedin.com`,
          `"${profileName}" "${companyName}" insights blog`
        );
      }

      const allResults: SearchResult[] = [];

      for (const query of searches) {
        try {
          const results = await this.performBraveSearch(query);
          allResults.push(...results);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.warn(`Search failed for query "${query}":`, error.message);
        }
      }

      return this.categorizeSearchResults(allResults, profileName, companyName);
    } catch (error: any) {
      console.error('Search service error:', error.message);
      return {
        personalBlogUrls: [],
        companyBlogUrls: [],
        articleUrls: [],
        resourceUrls: []
      };
    }
  }

  private async performBraveSearch(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.braveApiKey
        },
        params: {
          q: query,
          count: 10,
          offset: 0,
          mkt: 'en-US',
          safesearch: 'moderate',
          freshness: 'py',
          text_decorations: false,
          spellcheck: true
        }
      });

      if (!response.data?.web?.results) {
        return [];
      }

      return response.data.web.results.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        description: result.description || '',
        displayUrl: result.display_url || result.url || ''
      }));
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn('Search API rate limit reached');
      } else {
        console.warn('Search API error:', error.response?.data || error.message);
      }
      return [];
    }
  }

  private categorizeSearchResults(results: SearchResult[], profileName: string, companyName?: string): BlogSearchResult {
    const personalBlogUrls: string[] = [];
    const companyBlogUrls: string[] = [];
    const articleUrls: string[] = [];
    const resourceUrls: string[] = [];

    const seen = new Set<string>();

    for (const result of results) {
      const url = result.url.toLowerCase();
      const title = result.title.toLowerCase();
      const description = result.description.toLowerCase();

      // Skip duplicates
      if (seen.has(result.url)) continue;
      seen.add(result.url);

      // Skip social media and LinkedIn
      if (this.shouldSkipUrl(url)) continue;

      const domain = this.extractDomain(result.url);
      const nameInContent = title.includes(profileName.toLowerCase()) ||
                           description.includes(profileName.toLowerCase());
      const companyInContent = companyName &&
                              (title.includes(companyName.toLowerCase()) ||
                               description.includes(companyName.toLowerCase()));

      // Categorize based on URL patterns and content
      if (this.isPersonalBlog(url, domain, nameInContent)) {
        personalBlogUrls.push(result.url);
      } else if (companyName && this.isCompanyBlog(url, domain, companyInContent || false)) {
        companyBlogUrls.push(result.url);
      } else if (this.isArticleUrl(url)) {
        articleUrls.push(result.url);
      } else if (this.isResourceUrl(url, title, description)) {
        resourceUrls.push(result.url);
      }
    }

    return {
      personalBlogUrls: personalBlogUrls.slice(0, 5),
      companyBlogUrls: companyBlogUrls.slice(0, 3),
      articleUrls: articleUrls.slice(0, 5),
      resourceUrls: resourceUrls.slice(0, 3)
    };
  }

  private shouldSkipUrl(url: string): boolean {
    const skipPatterns = [
      'linkedin.com',
      'twitter.com',
      'facebook.com',
      'instagram.com',
      'youtube.com',
      'tiktok.com',
      'reddit.com',
      // Webinar and event platforms
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

    // Check for webinar/event keywords in URL
    const eventKeywords = [
      '/webinar',
      '/event',
      '/register',
      '/registration',
      '/rsvp',
      '/live-event',
      '/upcoming-event'
    ];

    if (eventKeywords.some(keyword => url.toLowerCase().includes(keyword))) {
      return true;
    }

    return skipPatterns.some(pattern => url.includes(pattern));
  }

  private isPersonalBlog(url: string, domain: string, nameInContent: boolean): boolean {
    const personalBlogIndicators = [
      url.includes('/blog'),
      url.includes('/insights'),
      url.includes('/thoughts'),
      url.includes('/posts'),
      nameInContent && (domain.includes('blog') || domain.includes('writes')),
      domain.includes('substack.com'),
      domain.includes('medium.com'),
      domain.includes('ghost.io'),
      domain.includes('wordpress.com')
    ];

    return personalBlogIndicators.some(indicator => indicator);
  }

  private isCompanyBlog(url: string, domain: string, companyInContent: boolean): boolean {
    const companyBlogIndicators = [
      url.includes('/blog'),
      url.includes('/insights'),
      url.includes('/resources'),
      url.includes('/knowledge'),
      companyInContent && url.includes('/blog'),
      companyInContent && url.includes('/insights')
    ];

    return companyBlogIndicators.some(indicator => indicator);
  }

  private isArticleUrl(url: string): boolean {
    const articleIndicators = [
      url.includes('medium.com'),
      url.includes('substack.com'),
      url.includes('/article'),
      url.includes('/post'),
      url.includes('/story')
    ];

    return articleIndicators.some(indicator => indicator);
  }

  private isResourceUrl(url: string, title: string, description: string): boolean {
    const resourceKeywords = [
      'playbook', 'guide', 'template', 'framework', 'toolkit',
      'resource', 'whitepaper', 'ebook', 'checklist', 'methodology'
    ];

    const content = `${title} ${description}`.toLowerCase();
    const hasResourceKeyword = resourceKeywords.some(keyword => content.includes(keyword));

    // Exclude if it's a webinar or event, even if it has resource keywords
    const eventKeywords = ['webinar', 'event', 'register', 'registration', 'live session', 'upcoming'];
    const isEvent = eventKeywords.some(keyword => content.includes(keyword));

    return hasResourceKeyword && !isEvent;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return '';
    }
  }
}