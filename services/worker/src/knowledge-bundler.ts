export interface KnowledgeBundle {
  instructionsMarkdown: string;
  expertMarkdownFiles: Array<{ username: string; content: string }>;
}

export interface InsightAnalysisLike {
  actionableInstructions?: string[];
  posts?: Array<Record<string, unknown>>;
  tokenUsage?: number;
}

export interface FormatterLike {
  formatThreeFiles(
    analysis: InsightAnalysisLike,
    config: ScrapingConfigLike,
  ): Promise<{ knowledgeBase: string }>;
}

export interface ScrapingConfigLike {
  linkedinUsername: string;
  focusTopics: string[];
  postLimit: number;
  outputFormat: string;
}

export async function buildKnowledgeBundle(
  aggregateAnalysis: InsightAnalysisLike,
  perExpertAnalysis: Record<string, InsightAnalysisLike>,
  formatter: FormatterLike,
  topics: string[],
  defaultPostLimit: number,
): Promise<KnowledgeBundle> {
  const instructionsMarkdown = [
    '# How to Use These Insights',
    '',
    aggregateAnalysis.actionableInstructions && aggregateAnalysis.actionableInstructions.length > 0
      ? aggregateAnalysis.actionableInstructions.map((item: string) => `- ${item}`).join('\n')
      : '- Prioritize the highest confidence insights and adapt them to your outreach sequences.',
    '',
    'Refer to the individual expert files for detailed tactics and source notes.',
  ].join('\n');

  const expertMarkdownFiles = await Promise.all(
    Object.entries(perExpertAnalysis).map(async ([username, expertAnalysis]) => {
      const postCount = expertAnalysis.posts?.length ?? defaultPostLimit;
      const knowledgeConfig: ScrapingConfigLike = {
        linkedinUsername: username,
        focusTopics: topics,
        postLimit: postCount,
        outputFormat: 'instructions',
      };
      const knowledge = await formatter.formatThreeFiles(expertAnalysis, knowledgeConfig);
      return {
        username,
        content: [`# ${username} Knowledge Base`, '', knowledge.knowledgeBase].join('\n'),
      };
    }),
  );

  return { instructionsMarkdown, expertMarkdownFiles };
}
