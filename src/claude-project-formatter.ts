import { InsightAnalysis, SalesCategory, ScrapingConfig } from './types.js';
import fs from 'fs/promises';

export class ClaudeProjectFormatter {
  async formatForClaudeProject(analysis: InsightAnalysis, config: ScrapingConfig): Promise<string> {
    const instructions = [];

    // Header
    instructions.push(`# Sales Expert AI Assistant - Based on ${config.linkedinUsername} Insights`);
    instructions.push('');
    instructions.push('You are an expert sales consultant with deep knowledge of modern B2B sales strategies, email outreach, cadence development, and deal closing techniques. Your expertise is based on proven methodologies and real-world insights from top sales professionals.');
    instructions.push('');

    // Core Competencies
    instructions.push('## Core Competencies');
    instructions.push('');
    instructions.push('You excel at:');
    instructions.push('- **Email Outreach**: Crafting personalized, compelling sales emails that get responses');
    instructions.push('- **Cadence Development**: Building multi-touch sequences that move prospects through the sales funnel');
    instructions.push('- **Deal Strategy**: Analyzing accounts and developing closing strategies based on buyer psychology');
    instructions.push('- **Objection Handling**: Addressing common sales objections with proven frameworks');
    instructions.push('- **Prospecting**: Identifying and qualifying high-value prospects effectively');
    instructions.push('');

    // Sales Methodologies Section
    instructions.push('## Proven Sales Methodologies');
    instructions.push('');

    // Use AI-extracted methodologies or fallback to default ones
    const methodologies = analysis.methodologies && analysis.methodologies.length > 0
      ? analysis.methodologies
      : this.extractMethodologies(analysis);

    for (const methodology of methodologies) {
      instructions.push(`### ${methodology.name}`);
      instructions.push(methodology.description);
      instructions.push('');
      if (methodology.application) {
        instructions.push('**When to use:** ' + methodology.application);
        instructions.push('');
      }
    }

    // Email Writing Framework
    instructions.push('## Email Writing Framework');
    instructions.push('');
    instructions.push('When writing sales emails, follow this proven structure:');
    instructions.push('');

    const emailFramework = this.extractEmailFramework(analysis);
    for (const step of emailFramework) {
      instructions.push(`**${step.step}**: ${step.description}`);
      if (step.example) {
        instructions.push(`*Example: "${step.example}"*`);
      }
      instructions.push('');
    }

    // Cadence Templates
    instructions.push('## Multi-Touch Cadence Templates');
    instructions.push('');

    const cadenceTemplates = this.extractCadenceTemplates(analysis);
    for (const cadence of cadenceTemplates) {
      instructions.push(`### ${cadence.name}`);
      instructions.push(cadence.description);
      instructions.push('');
      for (let i = 0; i < cadence.touches.length; i++) {
        instructions.push(`**Touch ${i + 1} (${cadence.touches[i].timing})**: ${cadence.touches[i].channel} - ${cadence.touches[i].purpose}`);
        if (cadence.touches[i].template) {
          instructions.push('```');
          instructions.push(cadence.touches[i].template);
          instructions.push('```');
        }
        instructions.push('');
      }
    }

    // Subject Line Strategies
    instructions.push('## High-Converting Subject Line Strategies');
    instructions.push('');

    const subjectLineStrategies = this.extractSubjectLineStrategies(analysis);
    for (const strategy of subjectLineStrategies) {
      instructions.push(`**${strategy.type}**: ${strategy.description}`);
      if (strategy.examples && strategy.examples.length > 0) {
        instructions.push('Examples:');
        for (const example of strategy.examples) {
          instructions.push(`- "${example}"`);
        }
      }
      instructions.push('');
    }

    // Deal Closing Strategies
    instructions.push('## Account Closing Strategies');
    instructions.push('');

    const closingStrategies = this.extractClosingStrategies(analysis);
    for (const strategy of closingStrategies) {
      instructions.push(`### ${strategy.situation}`);
      instructions.push(`**Strategy**: ${strategy.approach}`);
      instructions.push(`**Tactics**: ${strategy.tactics.join(', ')}`);
      if (strategy.script) {
        instructions.push('**Script**:');
        instructions.push('```');
        instructions.push(strategy.script);
        instructions.push('```');
      }
      instructions.push('');
    }

    // Objection Handling Scripts
    instructions.push('## Objection Handling Scripts');
    instructions.push('');

    const objectionHandling = this.extractObjectionHandling(analysis);
    for (const objection of objectionHandling) {
      instructions.push(`**Objection**: "${objection.objection}"`);
      instructions.push(`**Response Framework**: ${objection.framework}`);
      instructions.push(`**Script**: "${objection.response}"`);
      instructions.push('');
    }

    // Personalization Tactics
    instructions.push('## Personalization & Research Tactics');
    instructions.push('');

    const personalizationTactics = this.extractPersonalizationTactics(analysis);
    for (const tactic of personalizationTactics) {
      instructions.push(`**${tactic.area}**: ${tactic.approach}`);
      if (tactic.example) {
        instructions.push(`*Example: "${tactic.example}"*`);
      }
      instructions.push('');
    }

    // Response Guidelines
    instructions.push('## Response Guidelines for Users');
    instructions.push('');
    instructions.push('When users ask for help with sales activities:');
    instructions.push('');
    instructions.push('1. **Always ask for context**: Industry, company size, deal stage, previous interactions');
    instructions.push('2. **Personalize recommendations**: Use the frameworks above but tailor to their specific situation');
    instructions.push('3. **Provide actionable scripts**: Give exact wording they can use or adapt');
    instructions.push('4. **Include follow-up strategies**: Never just provide one-off advice - think in sequences');
    instructions.push('5. **Reference proven methodologies**: Use the frameworks and strategies outlined above');
    instructions.push('6. **Consider buyer psychology**: Always frame advice in terms of what will resonate with their specific prospects');
    instructions.push('');

    // Master Template Library
    instructions.push('## Master Template Library');
    instructions.push('');
    instructions.push('Use these proven templates as starting points (always customize for specific situations):');
    instructions.push('');

    // Organize templates by category
    const organizedTemplates = this.organizeTemplatesByPurpose(analysis);
    for (const [category, templates] of Object.entries(organizedTemplates)) {
      if (templates.length > 0) {
        instructions.push(`### ${this.formatCategoryName(category)} Templates`);
        instructions.push('');
        for (let i = 0; i < Math.min(templates.length, 3); i++) {
          instructions.push('```');
          instructions.push(templates[i]);
          instructions.push('```');
          instructions.push('');
        }
      }
    }

    if (analysis.externalArticles && analysis.externalArticles.length > 0) {
      instructions.push('## External Reference Library');
      instructions.push('');
      instructions.push('Use these long-form resources to provide richer context, examples, and data points:');
      instructions.push('');

      for (const article of analysis.externalArticles.slice(0, 8)) {
        instructions.push(`- **${article.title}** (${article.sourceDomain}, ${article.sourceType})`);
        if (article.excerpt) {
          instructions.push(`  - ${article.excerpt}`);
        }
        instructions.push(`  - ${article.url}`);
      }

      instructions.push('');
    }

    // Success Metrics
    instructions.push('## Key Success Metrics to Track');
    instructions.push('');
    instructions.push('When implementing these strategies, monitor:');
    instructions.push('- **Email open rates** (target: >40% for cold outreach)');
    instructions.push('- **Response rates** (target: >10% for personalized sequences)');
    instructions.push('- **Meeting booking rates** (target: >3% from initial outreach)');
    instructions.push('- **Pipeline velocity** (time from first touch to close)');
    instructions.push('- **Deal size** (average contract value)');
    instructions.push('');

    // Data Source Attribution
    instructions.push('## Source Attribution');
    instructions.push('');
    instructions.push(`These insights are based on analysis of ${analysis.posts.length} LinkedIn posts from @${config.linkedinUsername}, ` +
                     `extracting ${analysis.insights.length} sales insights and ${analysis.templates.length} proven templates. ` +
                     `${analysis.externalArticles && analysis.externalArticles.length > 0 ? `Supplementary data sourced from ${analysis.externalArticles.length} external articles.` : ''} ` +
                     `Analysis completed on ${new Date().toLocaleDateString()}.`);

    return instructions.join('\n');
  }

  private extractMethodologies(analysis: InsightAnalysis): Array<{name: string, description: string, application?: string}> {
    const methodologies = [];

    // Look for SMYKM methodology
    const smykmInsights = analysis.insights.filter(i =>
      i.insight.toLowerCase().includes('smykm') ||
      i.insight.toLowerCase().includes('show me you know me')
    );

    if (smykmInsights.length > 0) {
      methodologies.push({
        name: 'SMYKM (Show Me You Know Me)',
        description: 'A personalization strategy that demonstrates genuine research and interest in the prospect\'s specific situation, challenges, or achievements.',
        application: 'Use in subject lines and email openers to immediately show you\'ve done your homework on the prospect.'
      });
    }

    // Look for other methodologies in insights
    const discoveryInsights = analysis.insights.filter(i => i.category === SalesCategory.DISCOVERY);
    if (discoveryInsights.length > 0) {
      methodologies.push({
        name: 'Value-First Discovery',
        description: 'Leading with insights and value rather than generic questions. Focus on understanding the prospect\'s world before pitching solutions.',
        application: 'Use during initial conversations and discovery calls to build credibility and uncover real needs.'
      });
    }

    return methodologies;
  }

  private extractEmailFramework(analysis: InsightAnalysis): Array<{step: string, description: string, example?: string}> {
    return [
      {
        step: '1. Subject Line',
        description: 'Use SMYKM approach - reference something specific about their company, role, or recent achievement',
        example: 'Re: Your Q3 expansion into European markets'
      },
      {
        step: '2. Personal Connection',
        description: 'Open with genuine research-based insight or mutual connection',
        example: 'Saw your recent post about scaling remote teams - resonated with our experience at [similar company]'
      },
      {
        step: '3. Value Proposition',
        description: 'Lead with how you can help, not what you sell',
        example: 'We help companies like yours reduce onboarding time by 40% when scaling internationally'
      },
      {
        step: '4. Social Proof',
        description: 'Brief, relevant example of similar success',
        example: 'Just helped [Similar Company] achieve this same result in 90 days'
      },
      {
        step: '5. Soft Call to Action',
        description: 'Low-commitment next step that provides value',
        example: 'Would it be helpful if I shared the specific framework that worked for them?'
      }
    ];
  }

  private extractCadenceTemplates(analysis: InsightAnalysis): Array<{name: string, description: string, touches: Array<{timing: string, channel: string, purpose: string, template?: string}>}> {
    const cadences = [];

    // Extract cadence info from templates and insights
    const cadenceInsights = analysis.insights.filter(i =>
      i.category === SalesCategory.CADENCES ||
      i.insight.toLowerCase().includes('email') ||
      i.insight.toLowerCase().includes('follow up')
    );

    cadences.push({
      name: 'SMYKM Professional Sequence',
      description: 'High-touch, personalized sequence for enterprise prospects',
      touches: [
        {
          timing: 'Day 1 - Thursday/Friday',
          channel: 'Email',
          purpose: 'Initial value-driven outreach with SMYKM subject line',
          template: this.findBestTemplate(analysis, 'initial outreach') || 'Hi [Name],\n\nSaw [specific research point about their company/role].\n\n[Value proposition based on their situation]\n\nWorth a brief conversation to see if we can help?\n\nBest,\n[Your name]'
        },
        {
          timing: 'Day 4 - Saturday/Sunday',
          channel: 'Email',
          purpose: 'Soft follow-up with additional value',
          template: 'Hi [Name],\n\nMy name might look familiar as I sent you an email earlier this week.\n\n[Additional insight or resource that would help them]\n\nIf you\'re ever up for a chat about [their specific challenge], let me know.\n\nThanks for considering!'
        },
        {
          timing: 'Day 8 - Wednesday',
          channel: 'Email',
          purpose: 'Final email follow-up with specific value offer',
          template: 'Hi [Name],\n\nLast note from me - wanted to share [specific resource/insight] that might help with [their challenge].\n\nNo response needed, just thought it might be useful.\n\nBest of luck with [specific project/goal]!'
        },
        {
          timing: 'Day 12',
          channel: 'LinkedIn',
          purpose: 'Connection request with personalized note',
          template: 'Hi [Name], I\'ve sent you a few emails about [topic]. Would be grateful for the chance to connect and share how [solution] can support [their specific goal]. Thanks for considering!'
        }
      ]
    });

    return cadences;
  }

  private extractSubjectLineStrategies(analysis: InsightAnalysis): Array<{type: string, description: string, examples?: string[]}> {
    return [
      {
        type: 'SMYKM Reference',
        description: 'Reference specific company news, achievements, or challenges',
        examples: [
          'Re: Your Q3 expansion announcement',
          'Congrats on the Series B!',
          'Thoughts on your recent TechCrunch feature'
        ]
      },
      {
        type: 'Mutual Connection',
        description: 'Leverage shared connections or similar companies',
        examples: [
          '[Mutual Contact] suggested I reach out',
          'Fellow [University] alum',
          'How [Similar Company] solved [specific challenge]'
        ]
      },
      {
        type: 'Value-First',
        description: 'Lead with insight or helpful resource',
        examples: [
          'Framework for reducing churn in SaaS',
          'Quick question about your tech stack',
          '3 ways to improve your conversion rates'
        ]
      }
    ];
  }

  private extractClosingStrategies(analysis: InsightAnalysis): Array<{situation: string, approach: string, tactics: string[], script?: string}> {
    const strategies = [];

    // Extract closing insights
    const closingInsights = analysis.insights.filter(i => i.category === SalesCategory.CLOSING);

    strategies.push({
      situation: 'Price Objection Handling',
      approach: 'Reframe around value and ROI rather than defending price',
      tactics: ['Break down cost per user/month', 'Show ROI calculation', 'Offer payment terms flexibility'],
      script: 'I understand budget is important. Let me break down the ROI - if this saves your team just 2 hours per week, that\'s [X] in cost savings per month, which more than covers the investment.'
    });

    strategies.push({
      situation: 'Competitor Comparison',
      approach: 'Acknowledge competitor strengths then differentiate on unique value',
      tactics: ['Don\'t badmouth competitors', 'Focus on unique differentiators', 'Provide proof points'],
      script: '[Competitor] is a solid choice for [their strength]. Where we specifically excel is [your differentiator], which based on our conversation about [their challenge] seems particularly relevant for your situation.'
    });

    strategies.push({
      situation: 'Timeline Urgency',
      approach: 'Create natural urgency based on their business timeline, not artificial discount pressure',
      tactics: ['Reference their stated deadlines', 'Show implementation timeline', 'Connect to business impact'],
      script: 'Given your goal to launch by [their deadline], we\'d need to start implementation by [date] to ensure everything\'s ready. What would need to happen on your end to move forward by then?'
    });

    return strategies;
  }

  private extractObjectionHandling(analysis: InsightAnalysis): Array<{objection: string, framework: string, response: string}> {
    return [
      {
        objection: 'Thanks for your email, I\'m not the right person',
        framework: 'Acknowledge and redirect - show you value their time while getting a warm referral',
        response: 'Got it. Could you point me in the right direction of who is? I\'d be grateful for the introduction.'
      },
      {
        objection: 'We\'re not looking at new solutions right now',
        framework: 'Understand timing while planting seeds for future consideration',
        response: 'I understand timing isn\'t right. When you do evaluate [category] solutions, what would be the key criteria you\'d look for? Happy to keep that in mind for when the timing makes sense.'
      },
      {
        objection: 'We\'re happy with our current solution',
        framework: 'Respect their choice while identifying potential gaps or future needs',
        response: 'That\'s great to hear - [current solution] serves a lot of companies well. Out of curiosity, as you scale, what would make you consider adding or switching solutions?'
      }
    ];
  }

  private extractPersonalizationTactics(analysis: InsightAnalysis): Array<{area: string, approach: string, example?: string}> {
    return [
      {
        area: 'Recent Company News',
        approach: 'Reference funding, expansion, new hires, or product launches from their website or LinkedIn',
        example: 'Saw you just raised Series B - exciting time for scaling the team!'
      },
      {
        area: 'Personal LinkedIn Activity',
        approach: 'Comment on recent posts, shared articles, or professional updates',
        example: 'Loved your recent post about remote team challenges - we\'ve seen similar patterns with our clients'
      },
      {
        area: 'Industry Challenges',
        approach: 'Reference specific challenges their industry/role faces that you can help solve',
        example: 'Given the new regulations in [industry], I imagine compliance automation is top of mind'
      },
      {
        area: 'Mutual Connections',
        approach: 'Leverage shared connections, alma mater, or similar company experiences',
        example: 'Fellow [University] alum here - [Mutual connection] suggested I reach out'
      }
    ];
  }

  private organizeTemplatesByPurpose(analysis: InsightAnalysis): Record<string, string[]> {
    const organized: Record<string, string[]> = {
      'Initial Outreach': [],
      'Follow-up': [],
      'Discovery': [],
      'Objection Handling': [],
      'Closing': []
    };

    // Categorize templates based on content
    for (const template of analysis.templates) {
      const lowerTemplate = template.toLowerCase();

      if (lowerTemplate.includes('follow up') || lowerTemplate.includes('name might look familiar')) {
        organized['Follow-up'].push(template);
      } else if (lowerTemplate.includes('discovery') || lowerTemplate.includes('question')) {
        organized['Discovery'].push(template);
      } else if (lowerTemplate.includes('objection') || lowerTemplate.includes('not the right person')) {
        organized['Objection Handling'].push(template);
      } else if (lowerTemplate.includes('close') || lowerTemplate.includes('contract') || lowerTemplate.includes('decision')) {
        organized['Closing'].push(template);
      } else {
        organized['Initial Outreach'].push(template);
      }
    }

    return organized;
  }

  private findBestTemplate(analysis: InsightAnalysis, purpose: string): string | null {
    const relevantTemplates = analysis.templates.filter(template =>
      template.toLowerCase().includes(purpose.toLowerCase())
    );

    return relevantTemplates.length > 0 ? relevantTemplates[0] : null;
  }

  private formatCategoryName(category: string): string {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  async saveClaudeProjectInstructions(content: string, filename: string): Promise<string> {
    await fs.writeFile(filename, content, 'utf-8');
    console.log(`📋 Claude Project Instructions saved to ${filename}`);

    return filename;
  }
}
