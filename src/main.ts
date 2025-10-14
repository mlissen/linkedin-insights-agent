import './env.js';
import { CLIParser } from './cli-parser.js';
import { ConfigLoader } from './config-loader.js';
import { MultiExpertOrchestrator } from './multi-expert-orchestrator.js';
import { LinkedInScraper } from './scraper.js';
import { InsightAnalyzer } from './analyzer.js';
import { ThreeFileFormatter } from './three-file-formatter.js';
import { ScrapingConfig, MultiExpertConfig, LinkedInPost, ExternalArticle } from './types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Main entry point - supports both single and multi-expert modes
 */
async function main() {
  // Parse CLI arguments
  const args = CLIParser.parse();
  const mode = CLIParser.getMode(args);

  if (mode === 'help') {
    CLIParser.printHelp();
    return;
  }

  if (mode === 'multi-cli' || mode === 'multi-config') {
    await runMultiExpertMode(args);
  } else {
    await runSingleExpertMode(args);
  }
}

/**
 * Run multi-expert mode
 */
async function runMultiExpertMode(args: any) {
  let config: MultiExpertConfig;

  try {
    if (args.config) {
      // Load from config file
      console.log(`📁 Loading configuration from: ${args.config}`);
      config = await ConfigLoader.loadFromFile(args.config);
    } else {
      // Create from CLI arguments
      config = ConfigLoader.fromCLI(args);
    }

    console.log(`🚀 Multi-Expert Mode: ${config.topic}`);
    console.log(`👥 Processing ${config.experts.length} experts`);
    console.log(`🎯 Focus topics: ${config.focusTopics.join(', ')}`);
    console.log(`📊 Output mode: ${config.outputMode}`);
    console.log(`⚡ Parallel: ${config.parallel}`);
    console.log('---');

    const orchestrator = new MultiExpertOrchestrator();

    try {
      // Process all experts
      const { expertAnalyses, aggregated, runFolder } = await orchestrator.processExperts(config);

      // Save aggregated output if needed
      if (aggregated && (config.outputMode === 'combined' || config.outputMode === 'both')) {
        await orchestrator.saveAggregatedOutput(aggregated, config);
      }

      // Summary
      console.log('---');
      console.log('🎉 Multi-Expert Analysis Complete!');
      console.log(`📁 All outputs saved to: ${runFolder}`);
      console.log(`👥 Processed ${expertAnalyses.length} experts successfully`);

      if (config.outputMode === 'individual' || config.outputMode === 'both') {
        console.log(`📁 Individual outputs in: ${path.join(runFolder, 'individual')}/`);
        for (const ea of expertAnalyses) {
          if (ea.outputPath) {
            console.log(`   - ${ea.expert.username}`);
          }
        }
      }

      if (config.outputMode === 'combined' || config.outputMode === 'both') {
        console.log(`📁 Combined outputs in: ${path.join(runFolder, 'combined')}/`);
      }

      console.log('');
      console.log(`📊 Total insights: ${expertAnalyses.reduce((sum, ea) => sum + ea.analysis.insights.length, 0)}`);
      console.log(`📝 Total templates: ${expertAnalyses.reduce((sum, ea) => sum + ea.analysis.templates.length, 0)}`);
      console.log(`📰 Total posts analyzed: ${expertAnalyses.reduce((sum, ea) => sum + ea.analysis.posts.length, 0)}`);

    } finally {
      await orchestrator.close();
    }

  } catch (error: any) {
    console.error('❌ Error in multi-expert mode:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Run single expert mode (legacy)
 */
async function runSingleExpertMode(args: any) {
  // Use hardcoded config or CLI args for single expert
  const config: ScrapingConfig = {
    linkedinUsername: args.expert || 'toby-egbuna',
    postLimit: args.postLimit || 200,
    focusTopics: args.focusTopics
      ? args.focusTopics.split(',').map((t: string) => t.trim())
      : ['fundraising', 'venture capital', 'investment', 'startup funding', 'pitch deck', 'investors', 'funding rounds', 'capital raising', 'due diligence'],
    outputFormat: 'instructions'
  };

  console.log(`🚀 Single Expert Mode: @${config.linkedinUsername}`);
  console.log(`📊 Target: ${config.postLimit} posts`);
  console.log(`🎯 Focus topics: ${config.focusTopics.join(', ')}`);
  console.log(`📄 Output format: ${config.outputFormat}`);
  console.log('---');

  const scraper = new LinkedInScraper();
  const formatter = new ThreeFileFormatter();

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
      posts = await scraper.scrapeUserPosts(config, postsCachePath);
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

    // Analyze insights
    console.log('🧠 Analyzing insights...');
    const analysis = await analyzer.analyzeInsights(posts, config);
    console.log(`✅ Extracted ${analysis.insights.length} insights`);

    // Format and save output in THREE FILES
    console.log('📝 Generating three-file output...');
    const threeFileOutput = await formatter.formatThreeFiles(analysis, config);

    // Save to organized folder structure
    const { folderPath, files } = await formatter.saveThreeFiles(
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
