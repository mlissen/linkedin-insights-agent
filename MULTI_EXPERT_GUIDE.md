# Multi-Expert LinkedIn Insights Agent - Quick Start Guide

## 🎉 What's New?

Your LinkedIn Insights Agent now supports extracting insights from **multiple experts simultaneously** and intelligently combining them into unified knowledge bases perfect for AI chatbot projects!

## 🚀 Quick Examples

### Example 1: Extract from Multiple Fundraising Experts
```bash
npm start -- --config ./configs/fundraising-experts.json
```

This will:
- Extract insights from multiple fundraising experts
- Generate individual files for each expert
- Create a combined/aggregated knowledge base
- Automatically handle token limits for LLM compatibility

### Example 2: Quick Multi-Expert via CLI
```bash
npm start -- --experts sammckenna1,jebblount,morganjingram \
             --topic "Sales Mastery" \
             --focus-topics "prospecting,cold email,closing" \
             --output-mode both
```

### Example 3: ChatGPT Plus Compatible
```bash
npm start -- --config ./configs/chatgpt-plus-compatible.json
```

Optimized for ChatGPT Plus's 32K token context window.

## 📋 Configuration Files

Pre-configured examples in `./configs/`:

1. **fundraising-experts.json** - Multiple fundraising experts
2. **sales-experts.json** - Top sales professionals (Sam McKenna, Jeb Blount, Morgan J Ingram)
3. **chatgpt-plus-compatible.json** - Optimized for ChatGPT Plus (32K limit)

### Create Your Own Config

```json
{
  "topic": "Your Topic",
  "experts": [
    {
      "username": "linkedin-username",
      "weight": 1.0,
      "postLimit": 200
    }
  ],
  "focusTopics": ["topic1", "topic2", "topic3"],
  "outputMode": "both",
  "parallel": true,
  "tokenLimit": 50000
}
```

Save as `./configs/my-config.json` and run:
```bash
npm start -- --config ./configs/my-config.json
```

## 📁 Output Structure

### Individual Mode
Each expert gets their own folder with 3 files:
```
data/individual/
  └── expert1-[timestamp]/
      ├── 1-knowledge-base.txt       # Comprehensive reference
      ├── 2-core-rules.txt            # Key principles
      └── 3-project-instructions.txt  # AI chatbot instructions
```

### Combined Mode
All experts aggregated into unified files:
```
data/combined/
  └── topic-[timestamp]/
      ├── 1-aggregated-knowledge.txt  # Combined insights
      ├── 2-unified-rules.txt         # Unified principles
      └── 3-master-instructions.txt   # Master chatbot instructions
```

### Both Mode (Recommended)
Generates both individual AND combined outputs!

## 🎯 Token Limits

The tool automatically monitors and splits files to fit LLM context windows:

| LLM Platform | Token Limit | Config Setting |
|--------------|-------------|----------------|
| Claude Standard | 200K | `"tokenLimit": 50000` |
| Claude Sonnet 4 | 1M | `"tokenLimit": 50000` |
| ChatGPT Free | 8K | `"tokenLimit": 7000` |
| ChatGPT Plus | 32K | `"tokenLimit": 32000` |
| ChatGPT Pro | 128K | `"tokenLimit": 50000` |

Files exceeding the limit are automatically split into parts (e.g., `knowledge-base-part1.txt`, `knowledge-base-part2.txt`).

## ⚡ Parallel Processing

Set `"parallel": true` in your config for concurrent processing (faster results).

**Note:** Currently processes sequentially due to shared browser instance, but optimized pipeline provides performance improvements.

## 🔄 Aggregation Features

The combined output includes:

1. **Deduplication** - Removes duplicate insights across experts
2. **Cross-referencing** - Shows which experts mentioned each insight
3. **Weighted insights** - Prioritizes insights based on expert weights
4. **Unified methodologies** - Combines frameworks from all experts
5. **Template library** - All templates with source attribution

## 📊 CLI Arguments Reference

```bash
# View all options
npm start -- --help

# Multi-expert from config
npm start -- --config ./configs/your-config.json

# Multi-expert from CLI
npm start -- --experts user1,user2,user3 \
             --topic "Topic" \
             --focus-topics "topic1,topic2" \
             --output-mode both \
             --token-limit 32000 \
             --parallel

# Single expert (legacy mode)
npm start -- --expert username
```

## 💡 Pro Tips

1. **Start with 2-3 experts** to test before scaling up
2. **Use config files** for reusable setups
3. **Choose token limits** based on your target LLM platform
4. **Set expert weights** (0.0-1.0) to prioritize certain experts
5. **Use "both" output mode** for maximum flexibility
6. **Enable caching** with `USE_SCRAPE_CACHE=true` to speed up reruns

## 🎓 Example Use Cases

### Fundraising Chatbot
Extract from 5-10 top fundraising advisors → Create AI assistant with collective wisdom

```bash
npm start -- --config ./configs/fundraising-experts.json
```

### Sales Training Bot
Combine insights from sales legends → Build comprehensive sales training AI

```bash
npm start -- --config ./configs/sales-experts.json
```

### Custom Domain Expert
Define your own expert list for any domain (marketing, product, leadership, etc.)

```bash
npm start -- --experts expert1,expert2,expert3 \
             --topic "Product Management" \
             --focus-topics "roadmapping,prioritization,user research"
```

## 🚨 Troubleshooting

**Error: "At least one expert username is required"**
- Make sure to use `--experts` (plural) for multi-expert mode
- Or provide a config file with `--config`

**Output files too large**
- Reduce `tokenLimit` in config
- Reduce `postLimit` per expert
- Files will auto-split if needed

**LinkedIn login issues**
- Browser will open for manual login
- Credentials are never stored
- Login persists across runs

## 📚 Next Steps

1. **Try the examples** in `./configs/`
2. **Create your own config** for your domain
3. **Use outputs in Claude Projects** or ChatGPT
4. **Combine multiple domains** (e.g., sales + marketing experts)

---

**Need Help?** Check the main README.md or configs/README.md for detailed documentation.
