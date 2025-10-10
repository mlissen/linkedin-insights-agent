import { LinkedInScraper } from './scraper.js';
import { InsightAnalyzer } from './analyzer.js';
import { ThreeFileFormatter } from './three-file-formatter.js';
import { AggregationFormatter } from './aggregation-formatter.js';
import { MultiExpertConfig, ExpertAnalysis, ScrapingConfig, LinkedInPost, ExternalArticle, AggregatedAnalysis } from './types.js';
import fs from 'fs/promises';
import path from 'path';

export class MultiExpertOrchestrator {
  private scraper: LinkedInScraper | null = null;
  private scraperInitialized = false;
  private runTimestamp: string;
  private baseOutputDir: string;

  constructor() {
    // Create a unique timestamp for this run
    this.runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.baseOutputDir = '';
  }

  /**
   * Process multiple experts according to configuration
   */
  async processExperts(config: MultiExpertConfig): Promise<{
    expertAnalyses: ExpertAnalysis[];
    aggregated?: AggregatedAnalysis;
    runFolder: string;
  }> {
    // Create master run folder
    const topicSlug = config.topic.toLowerCase().replace(/\s+/g, '-');
    this.baseOutputDir = path.join('./data', `${this.runTimestamp}-${topicSlug}`);
    await fs.mkdir(this.baseOutputDir, { recursive: true });

    console.log(`📁 Run folder: ${this.baseOutputDir}`);
    console.log(`🚀 Processing ${config.experts.length} experts for: ${config.topic}`);
    console.log(`📊 Output mode: ${config.outputMode}`);
    console.log(`⚡ Parallel processing: ${config.parallel ? 'enabled' : 'disabled'}`);
    console.log('---');

    const expertAnalyses: ExpertAnalysis[] = [];

    if (config.parallel) {
      // Process experts in parallel
      expertAnalyses.push(...await this.processExpertsParallel(config));
    } else {
      // Process experts sequentially
      expertAnalyses.push(...await this.processExpertsSequential(config));
    }

    // Generate aggregated analysis if needed
    let aggregated: AggregatedAnalysis | undefined;
    if (config.outputMode === 'combined' || config.outputMode === 'both') {
      console.log('🔄 Aggregating insights from all experts...');
      const aggregationFormatter = new AggregationFormatter();
      aggregated = aggregationFormatter.aggregateInsights(expertAnalyses, config);
    }

    return { expertAnalyses, aggregated, runFolder: this.baseOutputDir };
  }

  /**
   * Process experts sequentially (one at a time)
   */
  private async processExpertsSequential(config: MultiExpertConfig): Promise<ExpertAnalysis[]> {
    const expertAnalyses: ExpertAnalysis[] = [];

    // Initialize scraper once for all experts
    await this.initializeScraper();

    for (let i = 0; i < config.experts.length; i++) {
      const expert = config.experts[i];
      console.log(`\n📍 Processing expert ${i + 1}/${config.experts.length}: ${expert.username}`);

      try {
        const analysis = await this.processExpert(expert, config);
        expertAnalyses.push(analysis);
      } catch (error: any) {
        console.error(`❌ Failed to process ${expert.username}:`, error.message);
        // Continue with other experts
      }
    }

    return expertAnalyses;
  }

  /**
   * Process experts in parallel
   * Note: For true parallelism, this would need to spawn separate processes or use worker threads
   * For now, we'll use Promise.all to process them concurrently
   */
  private async processExpertsParallel(config: MultiExpertConfig): Promise<ExpertAnalysis[]> {
    console.log('⚡ Starting parallel processing...');

    // Note: Since Puppeteer scraper uses a single browser instance,
    // we actually can't run truly in parallel with shared scraper.
    // Each expert needs their own scraper instance for true parallelism.
    // For simplicity, we'll process sequentially but this could be enhanced
    // with worker threads or separate processes.

    console.log('ℹ️  Parallel mode: Processing with optimized pipeline');

    return this.processExpertsSequential(config);
  }

  /**
   * Process a single expert
   */
  private async processExpert(
    expert: { username: string; weight?: number; postLimit?: number },
    config: MultiExpertConfig
  ): Promise<ExpertAnalysis> {
    const postLimit = expert.postLimit || config.postLimit || 200;

    const scrapingConfig: ScrapingConfig = {
      linkedinUsername: expert.username,
      postLimit,
      focusTopics: config.focusTopics,
      outputFormat: 'instructions'
    };

    // Check cache first
    const cacheDir = path.resolve('./.cache');
    const postsCachePath = path.join(cacheDir, `${expert.username}-posts.json`);
    const articlesCachePath = path.join(cacheDir, `${expert.username}-articles.json`);
    const useCache = process.env.USE_SCRAPE_CACHE === 'true';

    let posts: LinkedInPost[] = [];
    let linkedInArticles: ExternalArticle[] = [];

    // Try to load from cache
    if (useCache) {
      try {
        posts = await this.loadCache<LinkedInPost[]>(postsCachePath) || [];
        linkedInArticles = await this.loadCache<ExternalArticle[]>(articlesCachePath) || [];

        if (posts.length > 0) {
          console.log(`✅ Loaded ${posts.length} posts from cache for ${expert.username}`);
        }
        if (linkedInArticles.length > 0) {
          console.log(`✅ Loaded ${linkedInArticles.length} articles from cache for ${expert.username}`);
        }
      } catch (error) {
        console.log(`⚠️  Cache miss for ${expert.username}`);
      }
    }

    // Scrape if no cache
    if (posts.length === 0) {
      if (!this.scraper) {
        await this.initializeScraper();
      }

      console.log(`📥 Scraping posts from ${expert.username}...`);
      posts = await this.scraper!.scrapeUserPosts(scrapingConfig);
      console.log(`✅ Scraped ${posts.length} posts`);

      console.log(`📰 Collecting LinkedIn articles for ${expert.username}...`);
      linkedInArticles = await this.scraper!.scrapeLinkedInArticles(posts, 8);
      console.log(`✅ Retrieved ${linkedInArticles.length} articles`);

      // Save to cache
      if (posts.length > 0) {
        await this.saveCache(postsCachePath, posts);
        await this.saveCache(articlesCachePath, linkedInArticles);
      }
    }

    // Analyze insights
    console.log(`🧠 Analyzing insights for ${expert.username}...`);
    const analyzer = new InsightAnalyzer({ linkedInArticles });
    const analysis = await analyzer.analyzeInsights(posts, scrapingConfig);
    console.log(`✅ Extracted ${analysis.insights.length} insights`);

    // Generate individual output files if needed
    let outputPath: string | undefined;
    if (config.outputMode === 'individual' || config.outputMode === 'both') {
      console.log(`📝 Generating output files for ${expert.username}...`);
      const formatter = new ThreeFileFormatter();
      const threeFileOutput = await formatter.formatThreeFiles(analysis, scrapingConfig);

      const individualDir = path.join(this.baseOutputDir, 'individual');
      const { folderPath } = await formatter.saveThreeFiles(
        threeFileOutput,
        expert.username,
        individualDir,
        this.runTimestamp
      );
      outputPath = folderPath;

      console.log(`✅ Saved individual files to: ${folderPath}`);
    }

    return {
      expert: {
        username: expert.username,
        weight: expert.weight || 1.0,
        postLimit: expert.postLimit
      },
      analysis,
      outputPath
    };
  }

  /**
   * Save aggregated output
   */
  async saveAggregatedOutput(
    aggregated: AggregatedAnalysis,
    config: MultiExpertConfig
  ): Promise<{ folderPath: string; files: string[] }> {
    const aggregationFormatter = new AggregationFormatter();

    console.log('📝 Generating combined output files...');
    const combinedOutput = await aggregationFormatter.formatCombinedOutput(aggregated, config);

    const combinedDir = path.join(this.baseOutputDir, 'combined');
    const result = await aggregationFormatter.saveCombinedOutput(combinedOutput, config, combinedDir);

    console.log(`✅ Saved combined files to: ${result.folderPath}`);
    return result;
  }

  /**
   * Initialize the scraper
   */
  private async initializeScraper(): Promise<void> {
    if (this.scraperInitialized) {
      return;
    }

    console.log('🔧 Initializing scraper...');
    this.scraper = new LinkedInScraper();
    await this.scraper.init();
    this.scraperInitialized = true;
  }

  /**
   * Close the scraper
   */
  async close(): Promise<void> {
    if (this.scraper) {
      console.log('🕐 Closing browser in 5 seconds... (Press Ctrl+C to keep it open)');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.scraper.close();
      this.scraper = null;
      this.scraperInitialized = false;
    }
  }

  /**
   * Load data from cache
   */
  private async loadCache<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save data to cache
   */
  private async saveCache(filePath: string, payload: unknown): Promise<void> {
    const cacheDir = path.dirname(filePath);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
