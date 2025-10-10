# LinkedIn Insights Agent

A powerful tool to scrape LinkedIn posts from experts and extract actionable insights, strategies, templates, and tactics for your AI sales, marketing, and business projects.

## Features

### Core Features
- 🔍 **Smart Scraping**: Extracts up to 200 recent posts from any LinkedIn user
- 🧠 **AI-Powered Analysis**: Categorizes insights into prospecting, discovery, closing, templates, and more
- 📊 **Multiple Output Formats**: JSON, Markdown, or formatted project instructions
- 🎯 **Topic Filtering**: Focus on specific topics like "cold email", "fundraising", or "objection handling"
- 📝 **Template Extraction**: Automatically identifies and extracts email templates, scripts, and frameworks
- 🌐 **Extended Content Sources**: Captures LinkedIn articles and trusted off-platform resources
- 🚀 **Project-Ready Output**: Generates instructions you can directly input into AI projects

### 🆕 Multi-Expert Features
- 👥 **Multi-Expert Extraction**: Extract insights from multiple LinkedIn experts simultaneously
- ⚡ **Parallel Processing**: Process multiple experts concurrently for faster results
- 🔄 **Intelligent Aggregation**: Combine and deduplicate insights across experts
- 📁 **Dual Output Modes**: Generate individual files per expert AND/OR combined aggregated outputs
- 🎯 **Token-Aware Generation**: Auto-split files to fit LLM context windows (Claude, ChatGPT, etc.)
- 📋 **Config File Support**: Define multi-expert setups in JSON files for easy reuse

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Chrome or Chromium browser (Puppeteer will use this)
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/linkedin-insights-agent.git
   cd linkedin-insights-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Add your Anthropic API key:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-actual-api-key-here
   ```

4. **Configure your target:**
   Edit `src/main.ts` to change the LinkedIn username and focus topics:
   ```typescript
   const config: ScrapingConfig = {
     linkedinUsername: 'sammckenna1', // Change to your target username
     postLimit: 200,
     focusTopics: ['sales', 'prospecting', 'outreach'], // Customize topics
     outputFormat: 'instructions' // Choose: 'json', 'markdown', or 'instructions'
   };
   ```

5. **Run the analysis:**
   ```bash
   npm start
   ```

6. **LinkedIn Login (if prompted):**
   - The browser will open automatically (non-headless mode)
   - If the profile is private or LinkedIn requires login, you'll see the login page
   - **Log in manually** in the opened browser window using your LinkedIn credentials
   - After logging in, the scraper will continue automatically
   - Your credentials are **never stored** - you're just logging into LinkedIn normally
   - The browser stays open so you can see the scraping progress

7. **Find your results:**
   Results are saved in the `./data/[username]/` directory with three files:
   - `1-knowledge-base.txt` - Comprehensive reference material
   - `2-core-rules.txt` - Key principles to always apply
   - `3-project-instructions.txt` - Concise AI project guidance

## Configuration Options

### LinkedIn Users
The tool comes pre-configured with several sales experts:
- **Sam McKenna** (`sammckenna1`) - Outbound sales strategies
- **Jeb Blount** (`jebblount`) - Fanatical prospecting methods
- **Morgan J Ingram** (`morganjingram`) - Social selling tactics

### Focus Topics
Customize what insights to extract:
```typescript
focusTopics: [
  'sales',
  'prospecting',
  'cold email',
  'discovery calls',
  'objection handling',
  'closing techniques'
]
```

### Output Formats

1. **`instructions`** - Perfect for AI projects, formatted as implementation guidelines
2. **`markdown`** - Human-readable analysis with categories and insights
3. **`json`** - Raw data for programmatic use

### External Content Enrichment

- The scraper now collects full LinkedIn articles (Pulse) when available.
- Claude suggests verified external resources (blogs, newsletters, playbooks) based on links shared in recent activity.
- The analyzer fetches the referenced URLs, extracts article text, and surfaces highlights in the final instructions and project formatter output.

## What Gets Extracted

### Sales Categories
- **Prospecting**: Lead generation, cold outreach, qualifying
- **Discovery**: Needs assessment, qualifying questions, pain points
- **Nurturing**: Follow-up strategies, relationship building
- **Closing**: Deal closure, objection handling, negotiation
- **Communications**: Email templates, scripts, messaging
- **Cadences**: Outreach sequences, follow-up timing
- **Strategy**: Overall sales methodology and frameworks
- **Templates**: Copy-paste email templates and scripts
- **Tactics**: Specific techniques and best practices

### Output Includes
- ✅ Actionable insights with confidence scores
- ✅ Email templates and scripts ready to use
- ✅ Specific tactics and strategies
- ✅ Project implementation guidelines
- ✅ Source post references for verification

## Example Use Cases

### Single Expert Mode (Legacy)

#### For Sales AI Projects
```bash
npm start -- --expert sammckenna1 --focus-topics "prospecting,cold email,outreach"
```

#### For Marketing AI Projects
```bash
npm start -- --expert morganjingram --focus-topics "social selling,linkedin,video prospecting"
```

### 🆕 Multi-Expert Mode

#### Extract from Multiple Fundraising Experts
```bash
npm start -- --config ./configs/fundraising-experts.json
```

#### Quick Multi-Expert Setup (CLI)
```bash
npm start -- --experts sammckenna1,jebblount,morganjingram \
             --topic "Sales Mastery" \
             --focus-topics "prospecting,cold email,closing" \
             --output-mode both
```

#### ChatGPT Plus Compatible (32K token limit)
```bash
npm start -- --config ./configs/chatgpt-plus-compatible.json
```

## Multi-Expert Configuration

### Configuration File Format

Create a JSON file in `./configs/` directory:

```json
{
  "topic": "Fundraising & Investment",
  "experts": [
    {
      "username": "toby-egbuna",
      "weight": 1.0,
      "postLimit": 200
    },
    {
      "username": "expert2",
      "weight": 0.9,
      "postLimit": 150
    }
  ],
  "focusTopics": ["fundraising", "pitch deck", "VC", "investors"],
  "outputMode": "both",
  "parallel": true,
  "tokenLimit": 50000
}
```

### Output Modes

- **`individual`**: Separate files for each expert
- **`combined`**: Single aggregated file with all insights
- **`both`**: Generate both individual and combined outputs (recommended)

### Token Limits by Platform

| Platform | Token Limit | Recommended Setting |
|----------|-------------|---------------------|
| Claude Standard | 200K | `50000` |
| Claude Enterprise | 500K | `50000` |
| ChatGPT Free | 8K | `7000` |
| ChatGPT Plus | 32K | `32000` |
| ChatGPT Pro | 128K | `50000` |

### CLI Arguments

```bash
# Multi-expert from config file
npm start -- --config ./configs/your-config.json

# Multi-expert from CLI
npm start -- --experts user1,user2,user3 \
             --topic "Your Topic" \
             --focus-topics "topic1,topic2,topic3" \
             --output-mode both \
             --token-limit 32000

# Single expert (legacy)
npm start -- --expert username
```

### Output Structure

#### Individual Mode
```
data/individual/
  ├── expert1-[timestamp]/
  │   ├── 1-knowledge-base.txt
  │   ├── 2-core-rules.txt
  │   └── 3-project-instructions.txt
  └── expert2-[timestamp]/
      └── ...
```

#### Combined Mode
```
data/combined/
  └── topic-[timestamp]/
      ├── 1-aggregated-knowledge.txt
      ├── 2-unified-rules.txt
      └── 3-master-instructions.txt
```

## Important Notes

### LinkedIn Compliance
- The tool respects LinkedIn's robots.txt and rate limits
- Scraping is done with realistic delays to avoid detection
- Only scrapes publicly available posts
- Use responsibly and in compliance with LinkedIn's Terms of Service

### Browser Requirements
- Runs in non-headless mode by default so you can see what's happening
- Requires Chrome/Chromium to be installed (Puppeteer will download it automatically)
- LinkedIn login may be required for private profiles or rate limiting
- Browser window stays open during scraping for transparency and debugging

### Data Privacy
- No login credentials are stored
- All data is saved locally in the `./data` directory
- You control what data is collected and how it's used

## Troubleshooting

### Common Issues

1. **LinkedIn blocks the request**
   - Try running with longer delays
   - Ensure you're not rate-limited
   - Check if profile is public

2. **No posts found**
   - Verify the LinkedIn username is correct
   - Check if the user has recent posts
   - Ensure profile is public

3. **Low-quality insights**
   - Adjust focus topics to be more specific
   - Increase post limit for more data
   - Check confidence scores in output

### Getting Help

Check the generated output files for:
- Number of posts successfully scraped
- Confidence scores for insights
- Source post URLs for manual verification

## Advanced Usage

### Custom Analysis
Modify `src/analyzer.ts` to:
- Add new sales categories
- Adjust keyword matching
- Change confidence scoring

### Custom Output
Modify `src/formatter.ts` to:
- Create new output formats
- Customize instruction templates
- Add new data processing

## License

MIT License - Use responsibly and ethically.
