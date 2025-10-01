import './env.js';
import fs from 'fs/promises';
import path from 'path';
import { LinkedInScraper } from './scraper.js';
import { InsightAnalyzer } from './analyzer.js';
import { OutputFormatter } from './formatter.js';
import { ClaudeProjectFormatter } from './claude-project-formatter.js';
import { ThreeFileFormatter } from './three-file-formatter.js';
import { LinkedInPost, ScrapingConfig, ExternalArticle } from './types.js';

async function main() {
  // Configuration for Toby Egbuna fundraising insights
  const config: ScrapingConfig = {
    linkedinUsername: 'toby-egbuna', // Toby Egbuna's LinkedIn username
    postLimit: 200,
    focusTopics: ['fundraising', 'venture capital', 'investment', 'startup funding', 'pitch deck', 'investors', 'funding rounds', 'capital raising', 'due diligence'], // Fundraising focus topics
    outputFormat: 'instructions' // Choose: 'json', 'markdown', or 'instructions'
  };

  console.log(`🚀 Starting LinkedIn insights extraction for @${config.linkedinUsername}`);
  console.log(`📊 Target: ${config.postLimit} posts`);
  console.log(`🎯 Focus topics: ${config.focusTopics.join(', ')}`);
  console.log(`📄 Output format: ${config.outputFormat}`);
  console.log('---');

  const scraper = new LinkedInScraper();
  const formatter = new OutputFormatter();
  const claudeFormatter = new ClaudeProjectFormatter();
  const threeFileFormatter = new ThreeFileFormatter();

  const cacheDir = path.resolve('./.cache');
  const postsCachePath = path.join(cacheDir, `${config.linkedinUsername}-posts.json`);
  const articlesCachePath = path.join(cacheDir, `${config.linkedinUsername}-articles.json`);
  const useCache = process.env.USE_SCRAPE_CACHE === 'true';
  const forceRefresh = process.env.REFRESH_SCRAPE_CACHE === 'true';

  let posts: LinkedInPost[] = [];
  let linkedInArticles: ExternalArticle[] = [];
  let scraperInitialized = false;

  async function loadCache<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      return null;
    }
  }

  async function saveCache(filePath: string, payload: unknown): Promise<void> {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  try {
    if (useCache && !forceRefresh) {
      console.log('🗂️ Attempting to load cached scrape...');
      posts = (await loadCache<LinkedInPost[]>(postsCachePath)) ?? [];
      linkedInArticles = (await loadCache<ExternalArticle[]>(articlesCachePath)) ?? [];

      if (posts.length > 0) {
        console.log(`✅ Loaded ${posts.length} posts from cache`);
      }

      if (linkedInArticles.length > 0) {
        console.log(`✅ Loaded ${linkedInArticles.length} LinkedIn articles from cache`);
      }

      if (posts.length === 0 || linkedInArticles.length === 0) {
        console.log('⚠️ Cache missing or incomplete. Falling back to live scrape.');
        posts = [];
        linkedInArticles = [];
      }
    }

    if (posts.length === 0) {
      console.log('🔧 Initializing scraper...');
      await scraper.init();
      scraperInitialized = true;

      console.log('📥 Scraping LinkedIn posts...');
      posts = await scraper.scrapeUserPosts(config);
      console.log(`✅ Scraped ${posts.length} posts`);

      console.log('📰 Collecting full LinkedIn articles...');
      linkedInArticles = await scraper.scrapeLinkedInArticles(posts, 8);
      console.log(`✅ Retrieved ${linkedInArticles.length} LinkedIn articles`);

      if (posts.length > 0) {
        console.log('💾 Saving scrape cache for future runs...');
        await saveCache(postsCachePath, posts);
        await saveCache(articlesCachePath, linkedInArticles);
      }
    }

    const analyzer = new InsightAnalyzer({ linkedInArticles });

    // Step 3: Analyze insights
    console.log('🧠 Analyzing insights...');
    const analysis = await analyzer.analyzeInsights(posts, config);
    console.log(`✅ Extracted ${analysis.insights.length} insights`);

    // Step 4: Format and save output in THREE FILES
    console.log('📝 Generating three-file output...');
    const threeFileOutput = await threeFileFormatter.formatThreeFiles(analysis, config);

    // Save to organized folder structure
    const { folderPath, files } = await threeFileFormatter.saveThreeFiles(
      threeFileOutput,
      config.linkedinUsername
    );

    // Summary
    console.log('---');
    console.log('🎉 Analysis Complete!');
    console.log(`📊 Summary: ${analysis.summary}`);
    console.log(`📁 Output folder: ${folderPath}`);
    console.log(`   💡 Use "1-knowledge-base.txt" for comprehensive reference material`);
    console.log(`   ⚡ Use "2-core-rules.txt" for key principles to always apply`);
    console.log(`   🤖 Use "3-project-instructions.txt" for concise AI project guidance`);
    console.log(`📝 Templates extracted: ${analysis.templates.length}`);
    console.log(`🎯 Actionable instructions: ${analysis.actionableInstructions.length}`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    console.log('🕐 Keeping browser open for 30 seconds so you can inspect what happened...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  } finally {
    if (scraperInitialized) {
      console.log('🕐 Closing browser in 5 seconds... (Press Ctrl+C to keep it open)');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await scraper.close();
    } else {
      console.log('✅ Used cached scrape. Browser was not launched this run.');
    }
  }
}

// Run the analysis
main().catch(console.error);
