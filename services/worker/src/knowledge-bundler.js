export async function buildKnowledgeBundle(aggregateAnalysis, perExpertAnalysis, formatter, topics, defaultPostLimit) {
    const instructionsMarkdown = [
        '# How to Use These Insights',
        '',
        aggregateAnalysis.actionableInstructions && aggregateAnalysis.actionableInstructions.length > 0
            ? aggregateAnalysis.actionableInstructions.map((item) => `- ${item}`).join('\n')
            : '- Prioritize the highest confidence insights and adapt them to your outreach sequences.',
        '',
        'Refer to the individual expert files for detailed tactics and source notes.',
    ].join('\n');
    const expertMarkdownFiles = await Promise.all(Object.entries(perExpertAnalysis).map(async ([username, expertAnalysis]) => {
        const postCount = expertAnalysis.posts?.length ?? defaultPostLimit;
        const knowledgeConfig = {
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
    }));
    return { instructionsMarkdown, expertMarkdownFiles };
}
