# Configuration Files

This directory contains example configuration files for multi-expert LinkedIn insights extraction.

## Available Configurations

### 1. `fundraising-experts.json`
Extract insights from multiple fundraising experts.

**Usage:**
```bash
npm start -- --config ./configs/fundraising-experts.json
```

**Experts:**
- toby-egbuna (Fundraising advisor)
- jason (VC/investor perspective)

**Output:** 50K token limit (compatible with Claude, ChatGPT Pro)

---

### 2. `sales-experts.json`
Extract insights from top sales professionals.

**Usage:**
```bash
npm start -- --config ./configs/sales-experts.json
```

**Experts:**
- sammckenna1 (Sam McKenna - Outbound sales)
- jebblount (Jeb Blount - Fanatical prospecting)
- morganjingram (Morgan J Ingram - Social selling)

**Output:** 50K token limit (compatible with Claude, ChatGPT Pro)

---

### 3. `chatgpt-plus-compatible.json`
Optimized for ChatGPT Plus with 32K token context window.

**Usage:**
```bash
npm start -- --config ./configs/chatgpt-plus-compatible.json
```

**Output:** 32K token limit (optimized for ChatGPT Plus)

---

## Configuration Format

```json
{
  "topic": "Your Topic Name",
  "experts": [
    {
      "username": "linkedin-username",
      "weight": 1.0,           // Optional: Expert weight for aggregation (0-1)
      "postLimit": 200          // Optional: Override default post limit
    }
  ],
  "focusTopics": [
    "topic1",
    "topic2",
    "topic3"
  ],
  "outputMode": "both",         // "individual" | "combined" | "both"
  "postLimit": 200,             // Default post limit for all experts
  "parallel": true,             // Process experts in parallel
  "tokenLimit": 50000           // Target token limit per file
}
```

## Creating Your Own Configuration

1. Copy an existing config file
2. Update the `topic` and `focusTopics`
3. Replace `experts` with your target LinkedIn usernames
4. Adjust `tokenLimit` based on your LLM:
   - Claude Standard: 200K tokens
   - Claude Enterprise: 500K tokens
   - ChatGPT Plus: 32K tokens
   - ChatGPT Pro: 128K tokens
   - Recommended: 30-50K for broad compatibility

5. Choose `outputMode`:
   - `individual`: Separate files per expert
   - `combined`: Single aggregated file
   - `both`: Generate both formats

## Output Structure

### Individual Mode
```
data/individual/
  ├── expert1-[timestamp]/
  │   ├── 1-knowledge-base.txt
  │   ├── 2-core-rules.txt
  │   └── 3-project-instructions.txt
  └── expert2-[timestamp]/
      └── ...
```

### Combined Mode
```
data/combined/
  └── topic-[timestamp]/
      ├── 1-aggregated-knowledge.txt
      ├── 2-unified-rules.txt
      └── 3-master-instructions.txt
```

### Both Mode
Generates both individual and combined outputs.

## Tips

1. **Start Small**: Test with 2-3 experts before scaling up
2. **Token Limits**: Choose based on your target LLM platform
3. **Expert Weights**: Use weights to prioritize certain experts (1.0 = full weight, 0.5 = half weight)
4. **Post Limits**: Adjust per expert based on their posting frequency
5. **Parallel Processing**: Enable for faster extraction (requires more memory)

## Example Commands

### Load from config file
```bash
npm start -- --config ./configs/fundraising-experts.json
```

### Override config settings via CLI
```bash
npm start -- --config ./configs/sales-experts.json --output-mode combined --token-limit 32000
```

### Quick multi-expert without config file
```bash
npm start -- --experts expert1,expert2,expert3 --topic "Your Topic" --focus-topics "topic1,topic2" --output-mode both
```
