import fs from 'fs/promises';
import { InsightAnalysis, SalesCategory, ScrapingConfig } from './types.js';

export class OutputFormatter {
  async formatOutput(analysis: InsightAnalysis, config: ScrapingConfig): Promise<string> {
    switch (config.outputFormat) {
      case 'json':
        return this.formatAsJSON(analysis);
      case 'markdown':
        return this.formatAsMarkdown(analysis, config);
      case 'instructions':
        return this.formatAsInstructions(analysis, config);
      default:
        return this.formatAsJSON(analysis);
    }
  }

  async saveOutput(content: string, filename: string): Promise<void> {
    await fs.writeFile(filename, content, 'utf-8');
    console.log(`Output saved to ${filename}`);
  }

  private formatAsJSON(analysis: InsightAnalysis): string {
    return JSON.stringify(analysis, null, 2);
  }

  private formatAsMarkdown(analysis: InsightAnalysis, config: ScrapingConfig): string {
    const md = [];

    md.push(`# LinkedIn Insights Analysis for @${config.linkedinUsername}`);
    md.push('');
    md.push(`**Generated:** ${new Date().toISOString()}`);
    md.push(`**Posts Analyzed:** ${analysis.posts.length}`);
    md.push(`**Insights Extracted:** ${analysis.insights.length}`);
    md.push('');

    // Summary
    md.push('## Summary');
    md.push(analysis.summary);
    md.push('');

    // Insights by Category
    const categories = Object.values(SalesCategory);
    for (const category of categories) {
      const categoryInsights = analysis.insights.filter(i => i.category === category);
      if (categoryInsights.length === 0) continue;

      md.push(`## ${this.formatCategoryName(category)} (${categoryInsights.length} insights)`);
      md.push('');

      for (const insight of categoryInsights) {
        md.push(`### Insight (Confidence: ${Math.round(insight.confidence * 100)}%)`);
        md.push(insight.insight);
        md.push('');

        if (insight.actionableItems && insight.actionableItems.length > 0) {
          md.push('**Actionable Items:**');
          for (const item of insight.actionableItems) {
            md.push(`- ${item}`);
          }
          md.push('');
        }

        if (insight.templates && insight.templates.length > 0) {
          md.push('**Templates/Scripts:**');
          for (const template of insight.templates) {
            md.push(`\`\`\`\n${template}\n\`\`\``);
          }
          md.push('');
        }

        md.push(`**Source:** [LinkedIn Post](${insight.sourcePost.url})`);
        md.push('---');
        md.push('');
      }
    }

    // All Templates Section
    if (analysis.templates.length > 0) {
      md.push('## 📝 Extracted Templates & Scripts');
      md.push('');
      for (let i = 0; i < analysis.templates.length; i++) {
        md.push(`### Template ${i + 1}`);
        md.push('```');
        md.push(analysis.templates[i]);
        md.push('```');
        md.push('');
      }
    }

    // Actionable Instructions
    if (analysis.actionableInstructions.length > 0) {
      md.push('## 🎯 Actionable Instructions');
      md.push('');
      for (let i = 0; i < analysis.actionableInstructions.length; i++) {
        md.push(`${i + 1}. ${analysis.actionableInstructions[i]}`);
      }
      md.push('');
    }

    if (analysis.externalArticles && analysis.externalArticles.length > 0) {
      md.push('## 🌐 External Resources');
      md.push('');
      for (const article of analysis.externalArticles) {
        md.push(`- **${article.title}** — ${article.sourceDomain} (${article.sourceType})`);
        if (article.excerpt) {
          md.push(`  - ${article.excerpt}`);
        }
        md.push(`  - [Read more](${article.url})`);
      }
      md.push('');
    }

    return md.join('\n');
  }

  private formatAsInstructions(analysis: InsightAnalysis, config: ScrapingConfig): string {
    const instructions = [];

    instructions.push(`# AI Project Instructions: ${config.linkedinUsername} Sales Insights`);
    instructions.push('');
    instructions.push(`## Context`);
    instructions.push(`Based on analysis of ${analysis.posts.length} LinkedIn posts from @${config.linkedinUsername}, ` +
                     `the following sales insights and strategies have been extracted for implementation in AI sales and marketing projects.`);
    instructions.push('');

    // Key Strategies by Category
    const strategiesByCategory = this.groupInsightsByCategory(analysis.insights);

    for (const [category, insights] of Object.entries(strategiesByCategory)) {
      if (insights.length === 0) continue;

      instructions.push(`## ${this.formatCategoryName(category)} Strategy`);
      instructions.push('');

      // High-level strategy
      const highConfidenceInsights = insights.filter(i => i.confidence > 0.7);
      if (highConfidenceInsights.length > 0) {
        instructions.push('### Core Principles:');
        for (const insight of highConfidenceInsights.slice(0, 3)) {
          instructions.push(`- ${this.extractKeyPrinciple(insight.insight)}`);
        }
        instructions.push('');
      }

      // Actionable tactics
      const allActionableItems = insights.flatMap(i => i.actionableItems || []);
      if (allActionableItems.length > 0) {
        instructions.push('### Implementation Tactics:');
        const uniqueItems = [...new Set(allActionableItems)].slice(0, 5);
        for (const item of uniqueItems) {
          instructions.push(`- ${item}`);
        }
        instructions.push('');
      }

      // Templates for this category
      const templates = insights.flatMap(i => i.templates || []).filter(t => t.length > 0);
      if (templates.length > 0) {
        instructions.push('### Templates to Use:');
        for (const template of templates.slice(0, 3)) {
          instructions.push('```');
          instructions.push(template);
          instructions.push('```');
          instructions.push('');
        }
      }
    }

    // Master Template Library
    if (analysis.templates.length > 0) {
      instructions.push('## Master Template Library');
      instructions.push('');
      instructions.push('Use these proven templates in your AI sales projects:');
      instructions.push('');

      for (let i = 0; i < Math.min(analysis.templates.length, 10); i++) {
        instructions.push(`### Template ${i + 1}:`);
        instructions.push('```');
        instructions.push(analysis.templates[i]);
        instructions.push('```');
        instructions.push('');
      }
    }

    if (analysis.externalArticles && analysis.externalArticles.length > 0) {
      instructions.push('## External Content Repository');
      instructions.push('');
      instructions.push('Reference these long-form resources for deeper context:');
      instructions.push('');

      for (const article of analysis.externalArticles.slice(0, 10)) {
        instructions.push(`- **${article.title}** (${article.sourceDomain} / ${article.sourceType})`);
        if (article.excerpt) {
          instructions.push(`  - ${article.excerpt}`);
        }
        instructions.push(`  - Source: ${article.url}`);
      }
      instructions.push('');
    }

    // Project Implementation Guidelines
    instructions.push('## AI Project Implementation Guidelines');
    instructions.push('');
    instructions.push('When implementing these insights in your AI projects:');
    instructions.push('');

    const implementationGuidelines = [
      'Prioritize high-confidence insights (>70%) for core features',
      'Use extracted templates as starting points for AI-generated content',
      'Implement actionable tactics as specific project requirements',
      'Test approaches with highest engagement metrics first',
      'Maintain the authentic voice and style patterns identified'
    ];

    for (const guideline of implementationGuidelines) {
      instructions.push(`- ${guideline}`);
    }
    instructions.push('');

    // Quick Reference
    instructions.push('## Quick Reference');
    instructions.push('');
    instructions.push(`**Total Posts Analyzed:** ${analysis.posts.length}`);
    instructions.push(`**Insights Extracted:** ${analysis.insights.length}`);
    instructions.push(`**Templates Available:** ${analysis.templates.length}`);
    instructions.push(`**Actionable Items:** ${analysis.actionableInstructions.length}`);
    instructions.push(`**External Resources:** ${analysis.externalArticles?.length || 0}`);
    instructions.push('');
    instructions.push(`**Analysis Date:** ${new Date().toISOString()}`);

    return instructions.join('\n');
  }

  private groupInsightsByCategory(insights: any[]): Record<string, any[]> {
    return insights.reduce((acc, insight) => {
      if (!acc[insight.category]) {
        acc[insight.category] = [];
      }
      acc[insight.category].push(insight);
      return acc;
    }, {});
  }

  private extractKeyPrinciple(insight: string): string {
    // Extract the most important sentence or concept
    const sentences = insight.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences[0]?.trim() || insight.slice(0, 100);
  }

  private formatCategoryName(category: string): string {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
}
