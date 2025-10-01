import './env.js';
import { InsightAnalyzer } from './analyzer.js';
import { LinkedInPost, ScrapingConfig } from './types.js';

// Test the AI analysis with a sample post
async function testAIAnalysis() {
  console.log('🧪 Testing AI-powered analysis...');

  // Sample post data (from our previous scraping)
  const samplePost: LinkedInPost = {
    id: 'test-post-1',
    content: 'Thanks for your email, I\'m not the right person. Got it. Could you point me in the right direction of who is? I\'d be grateful for the introduction. This simple sales response turns a rejection into a warm referral opportunity.',
    publishedAt: '2024-01-01',
    engagement: { likes: 125, comments: 45, shares: 12 },
    url: 'https://linkedin.com/posts/test',
    author: 'samsalesli'
  };

  const config: ScrapingConfig = {
    linkedinUsername: 'samsalesli',
    postLimit: 1,
    focusTopics: ['sales', 'prospecting', 'outreach'],
    outputFormat: 'instructions'
  };

  try {
    const analyzer = new InsightAnalyzer();
    const analysis = await analyzer.analyzeInsights([samplePost], config);

    console.log('✅ Analysis Results:');
    console.log('📊 Insights found:', analysis.insights.length);
    console.log('📝 Templates found:', analysis.templates.length);
    console.log('🎯 Actionable items:', analysis.actionableInstructions.length);
    console.log('🧠 Methodologies found:', analysis.methodologies?.length || 0);
    console.log('🌐 External articles found:', analysis.externalArticles?.length || 0);
    console.log('🔗 External sources found:', analysis.externalSources?.length || 0);

    if (analysis.insights.length > 0) {
      console.log('\n🔍 Sample Insight:');
      console.log('Category:', analysis.insights[0].category);
      console.log('Insight:', analysis.insights[0].insight);
      console.log('Confidence:', analysis.insights[0].confidence);
    }

    if (analysis.templates.length > 0) {
      console.log('\n📝 Sample Template:');
      console.log(analysis.templates[0]);
    }

    if (analysis.externalArticles && analysis.externalArticles.length > 0) {
      console.log('\n🌐 Sample External Article:');
      console.log('Title:', analysis.externalArticles[0].title);
      console.log('URL:', analysis.externalArticles[0].url);
      console.log('Source:', analysis.externalArticles[0].sourceDomain);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      console.log('💡 Please set your ANTHROPIC_API_KEY environment variable');
      console.log('💡 Will fall back to keyword-based analysis instead');
    }
  }
}

testAIAnalysis().catch(console.error);
