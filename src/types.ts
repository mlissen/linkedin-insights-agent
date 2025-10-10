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

export interface ExpertConfig {
  username: string;
  weight?: number; // Optional weight for aggregation (0-1, default 1.0)
  postLimit?: number; // Optional override for post limit
}

export interface ScrapingConfig {
  linkedinUsername: string;
  postLimit: number;
  focusTopics: string[];
  outputFormat: 'json' | 'markdown' | 'instructions';
}

export interface MultiExpertConfig {
  topic: string;
  experts: ExpertConfig[];
  focusTopics: string[];
  postLimit?: number; // Default post limit for all experts
  outputMode: 'individual' | 'combined' | 'both';
  tokenLimit?: number; // Target token limit per file (default: 50000)
  parallel?: boolean; // Run scraping in parallel (default: true)
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

export interface ExpertAnalysis {
  expert: ExpertConfig;
  analysis: InsightAnalysis;
  outputPath?: string;
}

export interface AggregatedAnalysis {
  topic: string;
  experts: ExpertAnalysis[];
  combinedInsights: SalesInsight[];
  combinedMethodologies: Array<{name: string, description: string, application?: string, sources: string[]}>;
  combinedTemplates: Array<{template: string, sources: string[]}>;
  summary: string;
}
