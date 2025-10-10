/**
 * CLI argument parser for LinkedIn Insights Agent
 */

export interface CLIArgs {
  // Single expert mode (legacy)
  expert?: string;

  // Multi-expert mode
  experts?: string; // Comma-separated list
  config?: string; // Path to config file

  // Common options
  topic?: string;
  focusTopics?: string; // Comma-separated list
  postLimit?: number;
  outputMode?: 'individual' | 'combined' | 'both';
  parallel?: boolean;
  tokenLimit?: number;

  // Other options
  help?: boolean;
}

export class CLIParser {
  /**
   * Parse command line arguments
   */
  static parse(argv: string[] = process.argv.slice(2)): CLIArgs {
    const args: CLIArgs = {};

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];

      switch (arg) {
        case '--help':
        case '-h':
          args.help = true;
          break;

        case '--expert':
        case '-e':
          args.expert = argv[++i];
          break;

        case '--experts':
          args.experts = argv[++i];
          break;

        case '--config':
        case '-c':
          args.config = argv[++i];
          break;

        case '--topic':
        case '-t':
          args.topic = argv[++i];
          break;

        case '--focus-topics':
        case '--topics':
          args.focusTopics = argv[++i];
          break;

        case '--post-limit':
        case '-p':
          args.postLimit = parseInt(argv[++i]);
          break;

        case '--output-mode':
        case '-o':
          const mode = argv[++i];
          if (mode === 'individual' || mode === 'combined' || mode === 'both') {
            args.outputMode = mode;
          } else {
            throw new Error(`Invalid output mode: ${mode}. Must be 'individual', 'combined', or 'both'`);
          }
          break;

        case '--parallel':
          args.parallel = true;
          break;

        case '--no-parallel':
          args.parallel = false;
          break;

        case '--token-limit':
          args.tokenLimit = parseInt(argv[++i]);
          break;

        default:
          if (arg.startsWith('--')) {
            console.warn(`Unknown argument: ${arg}`);
          }
      }
    }

    return args;
  }

  /**
   * Print help message
   */
  static printHelp(): void {
    console.log(`
LinkedIn Insights Agent - Extract insights from LinkedIn experts

USAGE:
  npm start -- [OPTIONS]

SINGLE EXPERT MODE:
  --expert, -e <username>           Extract insights from a single expert

MULTI-EXPERT MODE:
  --experts <usernames>             Comma-separated list of expert usernames
                                    Example: --experts expert1,expert2,expert3

  --config, -c <path>               Path to JSON configuration file
                                    Example: --config ./configs/fundraising-experts.json

OPTIONS:
  --topic, -t <topic>               Topic/domain (e.g., "fundraising", "sales")

  --focus-topics <topics>           Comma-separated focus areas
                                    Example: --focus-topics "fundraising,pitch deck,VC"

  --post-limit, -p <number>         Maximum posts per expert (default: 200)

  --output-mode, -o <mode>          Output mode: individual | combined | both
                                    - individual: Separate files per expert
                                    - combined: Single aggregated file
                                    - both: Generate both (default)

  --parallel                        Process experts in parallel (default: true)
  --no-parallel                     Process experts sequentially

  --token-limit <number>            Target token limit per file (default: 50000)

  --help, -h                        Show this help message

EXAMPLES:
  # Single expert (legacy mode)
  npm start -- --expert toby-egbuna

  # Multiple experts with CLI arguments
  npm start -- --experts toby-egbuna,expert2 --topic fundraising --output-mode both

  # Multiple experts from config file
  npm start -- --config ./configs/fundraising-experts.json

  # Custom token limit for ChatGPT Plus compatibility (32K)
  npm start -- --experts expert1,expert2 --token-limit 32000

CONFIGURATION FILE FORMAT:
  {
    "topic": "fundraising",
    "experts": [
      {"username": "toby-egbuna", "weight": 1.0},
      {"username": "expert2", "weight": 0.8}
    ],
    "focusTopics": ["fundraising", "pitch deck", "VC"],
    "outputMode": "both",
    "postLimit": 200,
    "parallel": true,
    "tokenLimit": 50000
  }

ENVIRONMENT VARIABLES:
  USE_SCRAPE_CACHE=true             Use cached scrape data if available
  REFRESH_SCRAPE_CACHE=true         Force refresh of cache
  ANTHROPIC_API_KEY=<key>           Your Anthropic API key (required)
`);
  }

  /**
   * Determine operation mode from arguments
   */
  static getMode(args: CLIArgs): 'single' | 'multi-cli' | 'multi-config' | 'help' {
    if (args.help) {
      return 'help';
    }

    if (args.config) {
      return 'multi-config';
    }

    if (args.experts) {
      return 'multi-cli';
    }

    if (args.expert) {
      return 'single';
    }

    // Default to help if no valid mode
    return 'help';
  }
}
