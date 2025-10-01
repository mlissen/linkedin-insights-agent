export enum SalesCategory {
  PROSPECTING = 'prospecting',
  DISCOVERY = 'discovery',
  NURTURE = 'nurture',
  CLOSING = 'closing',
  SALES_COMMS = 'sales_comms',
  CADENCES = 'cadences',
  STRATEGY = 'strategy',
  TEMPLATES = 'templates',
  TACTICS = 'tactics'
}

export type ContentSourceType = 'post' | 'article' | 'document' | 'featured' | 'external';

export interface LinkedInPost {
  id: string;
  content: string;
  publishedAt: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  url: string;
  author: string;
  contentType?: ContentSourceType;
  links?: string[];
  imageUrls?: string[];
}

export interface ExternalArticle {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  sourceType: ContentSourceType;
  sourceDomain: string;
  publishedAt?: string;
  fetchedAt: string;
}

export interface SalesInsight {
  id: string;
  category: SalesCategory;
  insight: string;
  sourcePost: LinkedInPost;
  confidence: number;
  extractedAt: string;
  actionableItems: string[];
  templates?: string[];
}

export interface ScrapingConfig {
  linkedinUsername: string;
  postLimit: number;
  focusTopics: string[];
  outputFormat: 'json' | 'markdown' | 'instructions';
}

export interface InsightAnalysis {
  posts: LinkedInPost[];
  insights: SalesInsight[];
  summary: string;
  actionableInstructions: string[];
  templates: string[];
  methodologies?: Array<{name: string, description: string, application?: string}>;
  externalArticles?: ExternalArticle[];
  externalSources?: string[];
}
