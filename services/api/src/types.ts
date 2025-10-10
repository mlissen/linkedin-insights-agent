export interface AuthContext {
  userId: string;
  email: string;
  role?: string;
}

export interface RunConfigInput {
  profileUrls: string[];
  topics: string[];
  outputFormat: 'ai-ready' | 'briefing';
  nickname?: string;
  postLimit?: number;
}
