import { AggregatedAnalysis, ExpertAnalysis, SalesInsight, MultiExpertConfig } from './types.js';
import { TokenUtils } from './token-utils.js';
import fs from 'fs/promises';
import path from 'path';

interface CombinedOutput {
  aggregatedKnowledge: string;
  unifiedRules: string;
  masterInstructions: string;
}

export class AggregationFormatter {
  /**
   * Aggregate insights from multiple experts
   */
  aggregateInsights(expertAnalyses: ExpertAnalysis[], config: MultiExpertConfig): AggregatedAnalysis {
    console.log(`🔄 Aggregating insights from ${expertAnalyses.length} experts...`);

    // Combine insights with deduplication
    const combinedInsights = this.deduplicateInsights(expertAnalyses);

    // Combine methodologies
    const combinedMethodologies = this.combineMethodologies(expertAnalyses);

    // Combine templates
    const combinedTemplates = this.combineTemplates(expertAnalyses);

    // Generate summary
    const summary = this.generateAggregatedSummary(expertAnalyses, config);

    return {
      topic: config.topic,
      experts: expertAnalyses,
      combinedInsights,
      combinedMethodologies,
      combinedTemplates,
      summary
    };
  }

  /**
   * Format aggregated analysis into combined output files
   */
  async formatCombinedOutput(
    aggregated: AggregatedAnalysis,
    config: MultiExpertConfig
  ): Promise<CombinedOutput> {
    const aggregatedKnowledge = this.generateAggregatedKnowledge(aggregated, config);
    const unifiedRules = this.generateUnifiedRules(aggregated, config);
    const masterInstructions = this.generateMasterInstructions(aggregated, config);

    return {
      aggregatedKnowledge,
      unifiedRules,
      masterInstructions
    };
  }

  /**
   * Save combined output files with token-aware splitting
   */
  async saveCombinedOutput(
    output: CombinedOutput,
    config: MultiExpertConfig,
    outputDir: string = './data/combined'
  ): Promise<{ folderPath: string; files: string[] }> {
    // Create knowledge and rules subdirectories
    const knowledgeDir = path.join(outputDir, 'knowledge');
    const rulesDir = path.join(outputDir, 'rules');

    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.mkdir(rulesDir, { recursive: true });

    const savedFiles: string[] = [];

    // Save each file with token monitoring - organized by type
    const files = [
      { name: '1-aggregated-knowledge.txt', content: output.aggregatedKnowledge, dir: knowledgeDir },
      { name: '2-unified-rules.txt', content: output.unifiedRules, dir: rulesDir },
      { name: '3-master-instructions.txt', content: output.masterInstructions, dir: rulesDir }
    ];

    for (const file of files) {
      const fileInfo = TokenUtils.getFileSizeInfo(file.content);
      const tokenLimit = config.tokenLimit || 50000;

      const relativeDir = file.dir.includes('knowledge') ? 'knowledge/' : 'rules/';
      console.log(`📄 ${relativeDir}${file.name}: ${fileInfo.kb}KB (${fileInfo.tokenFormatted})`);

      if (fileInfo.tokens > tokenLimit) {
        console.log(`⚠️  File exceeds token limit (${TokenUtils.formatTokenCount(tokenLimit)}), splitting...`);

        const chunks = TokenUtils.splitByTokens(file.content, tokenLimit);
        for (let i = 0; i < chunks.length; i++) {
          const partName = file.name.replace('.txt', `-part${i + 1}.txt`);
          const partPath = path.join(file.dir, partName);
          await fs.writeFile(partPath, chunks[i], 'utf-8');
          savedFiles.push(partPath);

          const partInfo = TokenUtils.getFileSizeInfo(chunks[i]);
          console.log(`   📄 ${relativeDir}${partName}: ${partInfo.kb}KB (${partInfo.tokenFormatted})`);
        }
      } else {
        const filePath = path.join(file.dir, file.name);
        await fs.writeFile(filePath, file.content, 'utf-8');
        savedFiles.push(filePath);
      }
    }

    console.log(`✅ Saved combined outputs to: ${outputDir}`);
    return { folderPath: outputDir, files: savedFiles };
  }

  /**
   * Deduplicate similar insights across experts
   */
  private deduplicateInsights(expertAnalyses: ExpertAnalysis[]): SalesInsight[] {
    const allInsights: SalesInsight[] = [];
    const seenInsights = new Set<string>();

    for (const expertAnalysis of expertAnalyses) {
      for (const insight of expertAnalysis.analysis.insights) {
        // Create a normalized version for comparison
        const normalized = insight.insight.toLowerCase().trim();

        // Simple deduplication - can be made more sophisticated with similarity scoring
        if (!seenInsights.has(normalized)) {
          seenInsights.add(normalized);
          allInsights.push(insight);
        }
      }
    }

    // Sort by confidence
    return allInsights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Combine methodologies from all experts
   */
  private combineMethodologies(expertAnalyses: ExpertAnalysis[]): Array<{
    name: string;
    description: string;
    application?: string;
    sources: string[];
  }> {
    const methodologyMap = new Map<string, {
      name: string;
      description: string;
      application?: string;
      sources: string[];
    }>();

    for (const expertAnalysis of expertAnalyses) {
      const methodologies = expertAnalysis.analysis.methodologies || [];

      for (const methodology of methodologies) {
        const key = methodology.name.toLowerCase();

        if (methodologyMap.has(key)) {
          // Add expert as source
          const existing = methodologyMap.get(key)!;
          if (!existing.sources.includes(expertAnalysis.expert.username)) {
            existing.sources.push(expertAnalysis.expert.username);
          }
        } else {
          methodologyMap.set(key, {
            ...methodology,
            sources: [expertAnalysis.expert.username]
          });
        }
      }
    }

    return Array.from(methodologyMap.values());
  }

  /**
   * Combine templates from all experts
   */
  private combineTemplates(expertAnalyses: ExpertAnalysis[]): Array<{
    template: string;
    sources: string[];
  }> {
    const templateMap = new Map<string, string[]>();

    for (const expertAnalysis of expertAnalyses) {
      const templates = expertAnalysis.analysis.templates || [];

      for (const template of templates) {
        const normalized = template.trim();

        if (templateMap.has(normalized)) {
          const sources = templateMap.get(normalized)!;
          if (!sources.includes(expertAnalysis.expert.username)) {
            sources.push(expertAnalysis.expert.username);
          }
        } else {
          templateMap.set(normalized, [expertAnalysis.expert.username]);
        }
      }
    }

    return Array.from(templateMap.entries()).map(([template, sources]) => ({
      template,
      sources
    }));
  }

  /**
   * Generate aggregated summary
   */
  private generateAggregatedSummary(expertAnalyses: ExpertAnalysis[], config: MultiExpertConfig): string {
    const totalPosts = expertAnalyses.reduce((sum, ea) => sum + ea.analysis.posts.length, 0);
    const totalInsights = expertAnalyses.reduce((sum, ea) => sum + ea.analysis.insights.length, 0);
    const expertNames = expertAnalyses.map(ea => ea.expert.username).join(', ');

    return `Aggregated insights from ${expertAnalyses.length} experts (${expertNames}) on ${config.topic}. ` +
           `Analyzed ${totalPosts} posts and extracted ${totalInsights} unique insights.`;
  }

  /**
   * Generate aggregated knowledge base
   */
  private generateAggregatedKnowledge(aggregated: AggregatedAnalysis, config: MultiExpertConfig): string {
    const sections: string[] = [];

    sections.push(`# AGGREGATED KNOWLEDGE BASE: ${aggregated.topic}`);
    sections.push(`Generated: ${new Date().toLocaleDateString()}`);
    sections.push(`Sources: ${aggregated.experts.length} experts`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Expert Overview
    sections.push('## CONTRIBUTING EXPERTS');
    sections.push('');
    for (const expert of aggregated.experts) {
      const weight = expert.expert.weight || 1.0;
      const posts = expert.analysis.posts.length;
      const insights = expert.analysis.insights.length;
      sections.push(`### ${expert.expert.username}`);
      sections.push(`- Weight: ${weight}`);
      sections.push(`- Posts analyzed: ${posts}`);
      sections.push(`- Insights extracted: ${insights}`);
      sections.push('');
    }

    // Combined Methodologies
    sections.push('---');
    sections.push('');
    sections.push('## COMBINED METHODOLOGIES & FRAMEWORKS');
    sections.push('');

    for (const methodology of aggregated.combinedMethodologies) {
      sections.push(`### ${methodology.name}`);
      sections.push(`*Sources: ${methodology.sources.join(', ')}*`);
      sections.push('');
      sections.push(methodology.description);
      sections.push('');
      if (methodology.application) {
        sections.push(`**Application:** ${methodology.application}`);
        sections.push('');
      }
    }

    // Combined Templates
    sections.push('---');
    sections.push('');
    sections.push('## COMBINED TEMPLATE LIBRARY');
    sections.push('');

    for (let i = 0; i < aggregated.combinedTemplates.length; i++) {
      const item = aggregated.combinedTemplates[i];
      sections.push(`### Template ${i + 1}`);
      sections.push(`*Sources: ${item.sources.join(', ')}*`);
      sections.push('```');
      sections.push(item.template);
      sections.push('```');
      sections.push('');
    }

    // All Insights
    sections.push('---');
    sections.push('');
    sections.push('## ALL COMBINED INSIGHTS');
    sections.push('');

    // Group by category
    const insightsByCategory = new Map<string, SalesInsight[]>();
    for (const insight of aggregated.combinedInsights) {
      const category = insight.category;
      if (!insightsByCategory.has(category)) {
        insightsByCategory.set(category, []);
      }
      insightsByCategory.get(category)!.push(insight);
    }

    for (const [category, insights] of insightsByCategory) {
      sections.push(`### ${this.formatCategoryName(category)}`);
      sections.push('');
      for (const insight of insights) {
        sections.push(`- ${insight.insight} (Confidence: ${Math.round(insight.confidence * 100)}%)`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Generate unified rules
   */
  private generateUnifiedRules(aggregated: AggregatedAnalysis, config: MultiExpertConfig): string {
    const sections: string[] = [];

    sections.push(`# UNIFIED RULES: ${aggregated.topic} Best Practices`);
    sections.push(`Generated: ${new Date().toLocaleDateString()}`);
    sections.push(`Based on insights from: ${aggregated.experts.map(e => e.expert.username).join(', ')}`);
    sections.push('');
    sections.push('**Apply these principles consistently:**');
    sections.push('');
    sections.push('---');
    sections.push('');

    // Extract top insights by category and create rules
    const topInsightsByCategory = this.getTopInsightsByCategory(aggregated.combinedInsights, 5);

    let ruleNumber = 1;
    for (const [category, insights] of topInsightsByCategory) {
      sections.push(`## Rule ${ruleNumber}: ${this.formatCategoryName(category)}`);
      sections.push('');

      for (const insight of insights) {
        sections.push(`- ${insight.insight}`);
      }
      sections.push('');
      ruleNumber++;
    }

    sections.push('---');
    sections.push('');
    sections.push('**These rules represent the collective wisdom of multiple experts. Apply them consistently for best results.**');

    return sections.join('\n');
  }

  /**
   * Generate master instructions for AI projects
   */
  private generateMasterInstructions(aggregated: AggregatedAnalysis, config: MultiExpertConfig): string {
    const sections: string[] = [];

    sections.push(`# MASTER INSTRUCTIONS: ${aggregated.topic} AI Assistant`);
    sections.push(`Based on collective insights from ${aggregated.experts.length} experts`);
    sections.push('');
    sections.push('---');
    sections.push('');

    sections.push('## Your Role');
    sections.push('');
    sections.push(`You are an expert ${aggregated.topic.toLowerCase()} advisor with insights from multiple industry leaders. `);
    sections.push(`Your guidance is based on proven strategies from: ${aggregated.experts.map(e => e.expert.username).join(', ')}.`);
    sections.push('');

    sections.push('## Core Expertise Areas');
    sections.push('');
    const topCategories = this.getTopCategories(aggregated.combinedInsights, 5);
    for (const category of topCategories) {
      sections.push(`- **${this.formatCategoryName(category)}**`);
    }
    sections.push('');

    sections.push('## Key Frameworks to Apply');
    sections.push('');
    const topMethodologies = aggregated.combinedMethodologies.slice(0, 5);
    for (const methodology of topMethodologies) {
      sections.push(`### ${methodology.name}`);
      sections.push(`*Applied by: ${methodology.sources.join(', ')}*`);
      sections.push('');
      sections.push(methodology.description);
      sections.push('');
    }

    sections.push('## How to Respond to Users');
    sections.push('');
    sections.push('1. **Gather Context First** - Understand their specific situation');
    sections.push('2. **Apply Multiple Perspectives** - Draw from insights across experts');
    sections.push('3. **Provide Actionable Guidance** - Give specific, tactical recommendations');
    sections.push('4. **Include Examples** - Use templates and proven approaches from the knowledge base');
    sections.push('5. **Cross-Reference Sources** - Mention when multiple experts agree on a strategy');
    sections.push('');

    sections.push('## Tone & Style');
    sections.push('');
    sections.push('- Be direct and actionable');
    sections.push('- Show confidence backed by multiple expert sources');
    sections.push('- Highlight when experts have different perspectives');
    sections.push('- Celebrate proven approaches over untested theory');
    sections.push('');

    sections.push('---');
    sections.push('');
    sections.push(`**Reference Materials:** ${aggregated.combinedInsights.length} insights, ${aggregated.combinedTemplates.length} templates, ${aggregated.combinedMethodologies.length} methodologies from ${aggregated.experts.length} experts`);

    return sections.join('\n');
  }

  /**
   * Get top insights by category
   */
  private getTopInsightsByCategory(insights: SalesInsight[], limit: number): Map<string, SalesInsight[]> {
    const byCategory = new Map<string, SalesInsight[]>();

    for (const insight of insights) {
      if (!byCategory.has(insight.category)) {
        byCategory.set(insight.category, []);
      }
      byCategory.get(insight.category)!.push(insight);
    }

    // Sort each category by confidence and limit
    for (const [category, categoryInsights] of byCategory) {
      byCategory.set(
        category,
        categoryInsights
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, limit)
      );
    }

    return byCategory;
  }

  /**
   * Get top categories by insight count
   */
  private getTopCategories(insights: SalesInsight[], limit: number): string[] {
    const categoryCounts = new Map<string, number>();

    for (const insight of insights) {
      categoryCounts.set(insight.category, (categoryCounts.get(insight.category) || 0) + 1);
    }

    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([category]) => category);
  }

  /**
   * Format category name
   */
  private formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
