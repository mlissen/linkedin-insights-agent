import fs from 'fs/promises';
import { MultiExpertConfig } from './types.js';

export class ConfigLoader {
  /**
   * Load multi-expert configuration from a JSON file
   */
  static async loadFromFile(filePath: string): Promise<MultiExpertConfig> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(fileContent) as MultiExpertConfig;

      // Validate configuration
      this.validateConfig(config);

      // Apply defaults
      return this.applyDefaults(config);
    } catch (error: any) {
      throw new Error(`Failed to load configuration from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create configuration from CLI arguments
   */
  static fromCLI(args: {
    experts?: string; // Comma-separated usernames
    topic?: string;
    focusTopics?: string; // Comma-separated topics
    postLimit?: number;
    outputMode?: 'individual' | 'combined' | 'both';
    parallel?: boolean;
    tokenLimit?: number;
  }): MultiExpertConfig {
    if (!args.experts) {
      throw new Error('At least one expert username is required');
    }

    const expertUsernames = args.experts.split(',').map(u => u.trim());
    const config: MultiExpertConfig = {
      topic: args.topic || 'Expert Insights',
      experts: expertUsernames.map(username => ({
        username,
        weight: 1.0
      })),
      focusTopics: args.focusTopics ? args.focusTopics.split(',').map(t => t.trim()) : [],
      outputMode: args.outputMode || 'both',
      postLimit: args.postLimit,
      parallel: args.parallel !== false,
      tokenLimit: args.tokenLimit
    };

    return this.applyDefaults(config);
  }

  /**
   * Apply default values to configuration
   */
  private static applyDefaults(config: MultiExpertConfig): MultiExpertConfig {
    return {
      ...config,
      postLimit: config.postLimit || 200,
      tokenLimit: config.tokenLimit || 50000,
      parallel: config.parallel !== false,
      experts: config.experts.map(expert => ({
        ...expert,
        weight: expert.weight || 1.0,
        postLimit: expert.postLimit || config.postLimit || 200
      }))
    };
  }

  /**
   * Validate configuration
   */
  private static validateConfig(config: MultiExpertConfig): void {
    if (!config.experts || config.experts.length === 0) {
      throw new Error('Configuration must include at least one expert');
    }

    if (!config.topic) {
      throw new Error('Configuration must include a topic');
    }

    if (!config.focusTopics || config.focusTopics.length === 0) {
      throw new Error('Configuration must include at least one focus topic');
    }

    if (!['individual', 'combined', 'both'].includes(config.outputMode)) {
      throw new Error('Output mode must be "individual", "combined", or "both"');
    }

    // Validate expert weights
    for (const expert of config.experts) {
      if (expert.weight !== undefined && (expert.weight < 0 || expert.weight > 1)) {
        throw new Error(`Expert weight must be between 0 and 1 (got ${expert.weight} for ${expert.username})`);
      }
    }
  }
}
