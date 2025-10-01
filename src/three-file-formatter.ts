import { InsightAnalysis, SalesCategory, ScrapingConfig } from './types.js';
import fs from 'fs/promises';
import path from 'path';

interface ThreeFileOutput {
  knowledgeBase: string;
  coreRules: string;
  projectInstructions: string;
}

export class ThreeFileFormatter {
  /**
   * Generates three separate outputs from the analysis:
   * 1. Knowledge Base - comprehensive reference material
   * 2. Core Rules - key principles to always apply
   * 3. Project Instructions - concise guidance for AI projects
   */
  async formatThreeFiles(analysis: InsightAnalysis, config: ScrapingConfig): Promise<ThreeFileOutput> {
    return {
      knowledgeBase: this.generateKnowledgeBase(analysis, config),
      coreRules: this.generateCoreRules(analysis, config),
      projectInstructions: this.generateProjectInstructions(analysis, config)
    };
  }

  private generateKnowledgeBase(analysis: InsightAnalysis, config: ScrapingConfig): string {
    const sections = [];

    // Header
    sections.push(`# KNOWLEDGE BASE: ${config.linkedinUsername} Expert Insights`);
    sections.push(`Generated: ${new Date().toLocaleDateString()}`);
    sections.push(`Source: ${analysis.posts.length} LinkedIn posts, ${analysis.insights.length} insights extracted`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Section 1: All Methodologies and Frameworks
    sections.push('## METHODOLOGIES & FRAMEWORKS');
    sections.push('');

    if (analysis.methodologies && analysis.methodologies.length > 0) {
      for (const methodology of analysis.methodologies) {
        sections.push(`### ${methodology.name}`);
        sections.push('');
        sections.push(methodology.description);
        sections.push('');
        if (methodology.application) {
          sections.push(`**Application:** ${methodology.application}`);
          sections.push('');
        }
      }
    }

    // Section 2: Complete Template Library (organized by category)
    sections.push('---');
    sections.push('');
    sections.push('## COMPLETE TEMPLATE LIBRARY');
    sections.push('');

    const organizedTemplates = this.organizeTemplatesByCategory(analysis);
    for (const [category, templates] of Object.entries(organizedTemplates)) {
      if (templates.length > 0) {
        sections.push(`### ${category}`);
        sections.push('');
        for (let i = 0; i < templates.length; i++) {
          sections.push(`**Template ${i + 1}:**`);
          sections.push('```');
          sections.push(templates[i]);
          sections.push('```');
          sections.push('');
        }
      }
    }

    // Section 3: All Insights by Category
    sections.push('---');
    sections.push('');
    sections.push('## ALL EXTRACTED INSIGHTS');
    sections.push('');

    const insightsByCategory = this.groupInsightsByCategory(analysis.insights);
    for (const [category, insights] of Object.entries(insightsByCategory)) {
      if (insights.length > 0) {
        sections.push(`### ${this.formatCategoryName(category)}`);
        sections.push('');
        for (const insight of insights) {
          sections.push(`- ${insight.insight} (Confidence: ${Math.round(insight.confidence * 100)}%)`);
        }
        sections.push('');
      }
    }

    // Section 4: Actionable Items
    if (analysis.actionableInstructions && analysis.actionableInstructions.length > 0) {
      sections.push('---');
      sections.push('');
      sections.push('## ACTIONABLE ITEMS');
      sections.push('');
      for (const item of analysis.actionableInstructions) {
        sections.push(`- ${item}`);
      }
      sections.push('');
    }

    // Section 5: External Articles & Resources
    if (analysis.externalArticles && analysis.externalArticles.length > 0) {
      sections.push('---');
      sections.push('');
      sections.push('## EXTERNAL REFERENCE MATERIALS');
      sections.push('');
      sections.push('Long-form articles and resources for deeper context:');
      sections.push('');

      for (const article of analysis.externalArticles) {
        sections.push(`### ${article.title}`);
        sections.push(`**Source:** ${article.sourceDomain} (${article.sourceType})`);
        sections.push(`**URL:** ${article.url}`);
        if (article.excerpt) {
          sections.push(`**Summary:** ${article.excerpt}`);
        }
        if (article.content) {
          sections.push('');
          sections.push('**Full Content:**');
          sections.push('```');
          sections.push(article.content.substring(0, 5000) + (article.content.length > 5000 ? '...' : ''));
          sections.push('```');
        }
        sections.push('');
      }
    }

    // Section 6: Sample LinkedIn Posts
    sections.push('---');
    sections.push('');
    sections.push('## SAMPLE LINKEDIN POSTS');
    sections.push('');
    sections.push('High-engagement posts from the source:');
    sections.push('');

    const topPosts = analysis.posts
      .sort((a, b) => (b.engagement.likes + b.engagement.comments) - (a.engagement.likes + a.engagement.comments))
      .slice(0, 10);

    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      sections.push(`### Post ${i + 1} (${post.engagement.likes} likes, ${post.engagement.comments} comments)`);
      sections.push('```');
      sections.push(post.content.substring(0, 500) + (post.content.length > 500 ? '...' : ''));
      sections.push('```');
      sections.push('');
    }

    return sections.join('\n');
  }

  private generateCoreRules(analysis: InsightAnalysis, config: ScrapingConfig): string {
    const domain = this.inferDomainFromTopics(config.focusTopics);

    switch (domain.domain) {
      case 'fundraising':
        return this.generateFundraisingCoreRules(config);
      case 'sales':
        return this.generateSalesCoreRules(config);
      default:
        return this.generateGeneralCoreRules(config, domain.title);
    }
  }

  private generateFundraisingCoreRules(config: ScrapingConfig): string {
    const rules: string[] = [];

    rules.push(`# CORE RULES: ${config.linkedinUsername} Fundraising Operating System`);
    rules.push(`Generated: ${new Date().toLocaleDateString()}`);
    rules.push('');
    rules.push('**Apply these principles to every fundraise and investor interaction:**');
    rules.push('');
    rules.push('---');
    rules.push('');

    rules.push('## Rule 1: Start With Investor Fit');
    rules.push('');
    rules.push('**Only pitch investors who match your stage and thesis:**');
    rules.push('- Map their fund size, check size, and lead preferences');
    rules.push('- Confirm portfolio relevance and recent investments');
    rules.push('- Prioritize warm paths through founders, angels, or operators');
    rules.push('- Track every touchpoint so no intro goes cold');
    rules.push('');

    rules.push('## Rule 2: Lead With Traction, Not Vision Alone');
    rules.push('');
    rules.push('**Open every conversation with proof of momentum:**');
    rules.push('- Highlight revenue, growth rate, retention, and pipeline strength');
    rules.push('- Translate customer wins into quantified outcomes');
    rules.push('- Share operational efficiency metrics (burn, runway, payback)');
    rules.push('- Anchor valuation asks to investor-grade benchmarks');
    rules.push('');

    rules.push('## Rule 3: Tell a Crisp Founder Narrative');
    rules.push('');
    rules.push('**Frame the problem, insight, and why now in under two minutes:**');
    rules.push('- Connect personal story to market gap and customer pain');
    rules.push('- Show unique insight or unfair advantage the team owns');
    rules.push('- Present market sizing with bottom-up validation');
    rules.push('- Close with the future vision tied to investor upside');
    rules.push('');

    rules.push('## Rule 4: Run a Structured Process');
    rules.push('');
    rules.push('**Treat fundraising like a pipeline, not a series of ad-hoc chats:**');
    rules.push('- Build a tiered target list before launch');
    rules.push('- Batch outreach to create momentum and competitive tension');
    rules.push('- Time diligence materials, updates, and asks intentionally');
    rules.push('- Keep weekly operating reviews on investor funnel health');
    rules.push('');

    rules.push('## Rule 5: Warm Intros and Social Proof Win');
    rules.push('');
    rules.push('**Investors follow conviction signals:**');
    rules.push('- Secure champion founders or operators to share the story');
    rules.push('- Reference customer logos, retention, and usage metrics early');
    rules.push('- Share advisory board or strategic partner endorsements');
    rules.push('- Surface prior investor attention without overplaying it');
    rules.push('');

    rules.push('## Rule 6: Prep Diligence Before You Need It');
    rules.push('');
    rules.push('**Data room readiness builds trust and shortens cycles:**');
    rules.push('- Keep financial model, metrics, and cohort analyses current');
    rules.push('- Document product roadmap, GTM motion, and hiring plan');
    rules.push('- Collect legal, HR, and cap table documents in one hub');
    rules.push('- Rehearse answers to known diligence patterns by stage');
    rules.push('');

    rules.push('## Rule 7: Manage Momentum Relentlessly');
    rules.push('');
    rules.push('**Silence kills deals—rhythm sustains them:**');
    rules.push('- Send investor updates within 24 hours of every meeting');
    rules.push('- Package product, customer, and team wins as proof points');
    rules.push('- Set clear next steps with dates before ending calls');
    rules.push('- Use weekly updates to reinforce velocity and urgency');
    rules.push('');

    rules.push('## Rule 8: Treat Objections as Insight');
    rules.push('');
    rules.push('**Every pushback reveals what investors still need:**');
    rules.push('- Log objections by theme (market, team, traction, competition)');
    rules.push('- Answer with data, not defensiveness, and follow up with proof');
    rules.push('- Update pitch materials when patterns emerge');
    rules.push('- Stay on calendar even after a "pass" with brief progress updates');
    rules.push('');

    rules.push('---');
    rules.push('');
    rules.push('**These rules are non-negotiable. Apply them consistently to build investor trust and momentum.**');

    return rules.join('\n');
  }

  private generateSalesCoreRules(config: ScrapingConfig): string {
    const rules: string[] = [];

    rules.push(`# CORE RULES: ${config.linkedinUsername} Sales Methodology`);
    rules.push(`Generated: ${new Date().toLocaleDateString()}`);
    rules.push('');
    rules.push('**Apply these principles to EVERY sales interaction:**');
    rules.push('');
    rules.push('---');
    rules.push('');

    rules.push('## Rule 1: Always Personalize (SMYKM)');
    rules.push('');
    rules.push('**Show Me You Know Me** - Every outreach must include specific research:');
    rules.push('- Reference recent company news, funding, or expansion');
    rules.push('- Comment on LinkedIn activity or shared content');
    rules.push('- Mention mutual connections or shared experiences');
    rules.push('- Acknowledge industry-specific challenges');
    rules.push('');
    rules.push('**Never send generic emails.** If you can\'t find 3 specific facts about the prospect, don\'t send.');
    rules.push('');

    rules.push('## Rule 2: Lead With Value, Not Features');
    rules.push('');
    rules.push('**Every interaction must answer: "What\'s in it for them?"**');
    rules.push('- Start with insights, not pitches');
    rules.push('- Share relevant case studies or data');
    rules.push('- Offer helpful resources with no strings attached');
    rules.push('- Frame solutions around THEIR goals, not your product');
    rules.push('');

    rules.push('## Rule 3: Think in Sequences, Not Single Touches');
    rules.push('');
    rules.push('**Every prospect needs multiple touchpoints:**');
    rules.push('- Plan 3-5 touch cadence before first outreach');
    rules.push('- Vary channels: email, LinkedIn, phone, video');
    rules.push('- Each touch provides new value or angle');
    rules.push('- Time strategically: weekdays for business, weekends for soft touches');
    rules.push('');

    rules.push('## Rule 4: Use Social Proof Strategically');
    rules.push('');
    rules.push('**Credibility accelerates deals:**');
    rules.push('- Reference similar companies you\'ve helped');
    rules.push('- Share specific metrics and outcomes');
    rules.push('- Use industry recognition and awards');
    rules.push('- Leverage mutual connections for warm intros');
    rules.push('');

    rules.push('## Rule 5: Objections Are Opportunities');
    rules.push('');
    rules.push('**Never fight objections, reframe them:**');
    rules.push('- "Not the right person" → Ask for warm introduction');
    rules.push('- "No budget" → Shift to ROI and payment flexibility');
    rules.push('- "Happy with current solution" → Explore future needs and gaps');
    rules.push('- "Not now" → Understand timeline and stay top of mind');
    rules.push('');

    rules.push('## Rule 6: Measure and Iterate');
    rules.push('');
    rules.push('**Track these key metrics:**');
    rules.push('- Email open rates (target: >40%)');
    rules.push('- Response rates (target: >10%)');
    rules.push('- Meeting booking rates (target: >3%)');
    rules.push('- Pipeline velocity (time to close)');
    rules.push('');
    rules.push('**Test everything:** subject lines, CTAs, timing, messaging angles');
    rules.push('');

    rules.push('## Rule 7: Be Human, Not a Robot');
    rules.push('');
    rules.push('**Authenticity builds trust:**');
    rules.push('- Write like you talk - conversational, not corporate');
    rules.push('- Share relevant personal experiences');
    rules.push('- Admit when something isn\'t a fit');
    rules.push('- Show genuine interest in their success');
    rules.push('');

    rules.push('## Rule 8: Respect Buyer Timing');
    rules.push('');
    rules.push('**Align with their business cycle:**');
    rules.push('- Research fiscal year and budget cycles');
    rules.push('- Connect to their stated goals and deadlines');
    rules.push('- Create natural urgency, not artificial pressure');
    rules.push('- Stay persistent but not pushy');
    rules.push('');

    rules.push('---');
    rules.push('');
    rules.push('**These rules are non-negotiable. Apply them consistently for maximum impact.**');

    return rules.join('\n');
  }

  private generateGeneralCoreRules(config: ScrapingConfig, domainTitle: string): string {
    const rules: string[] = [];

    rules.push(`# CORE RULES: ${config.linkedinUsername} ${domainTitle} Principles`);
    rules.push(`Generated: ${new Date().toLocaleDateString()}`);
    rules.push('');
    rules.push('**Use these evergreen principles whenever you advise others:**');
    rules.push('');
    rules.push('---');
    rules.push('');

    rules.push('## Rule 1: Lead With Context');
    rules.push('');
    rules.push('- Start every interaction by clarifying goals, constraints, and success metrics');
    rules.push('- Mirror the stakeholder\'s language and priorities');
    rules.push('- Summarize back what you heard before giving direction');
    rules.push('');

    rules.push('## Rule 2: Anchor Advice in Evidence');
    rules.push('');
    rules.push('- Reference data, case studies, or lived experience');
    rules.push('- Explain the why behind every recommendation');
    rules.push('- Share trade-offs so others can make informed choices');
    rules.push('');

    rules.push('## Rule 3: Design for Momentum');
    rules.push('');
    rules.push('- Break work into sequenced steps with clear owners and deadlines');
    rules.push('- Keep communication tight with agreed follow-ups');
    rules.push('- Track progress visibly to celebrate wins and spot risks early');
    rules.push('');

    rules.push('## Rule 4: Use Social Proof Thoughtfully');
    rules.push('');
    rules.push('- Share relevant examples and benchmarks to inspire confidence');
    rules.push('- Highlight peers or partners who have succeeded with similar moves');
    rules.push('- Avoid vanity metrics—focus on outcomes and learning');
    rules.push('');

    rules.push('## Rule 5: Iterate With Feedback');
    rules.push('');
    rules.push('- Collect qualitative and quantitative signals after every push');
    rules.push('- Test variations instead of relying on single bets');
    rules.push('- Update playbooks quickly so the team stays aligned');
    rules.push('');

    rules.push('---');
    rules.push('');
    rules.push('**These rules travel with you—apply them consistently to stay credible and effective.**');

    return rules.join('\n');
  }

  private generateProjectInstructions(analysis: InsightAnalysis, config: ScrapingConfig): string {
    const instructions = [];

    // Dynamically determine the domain based on focus topics
    const domain = this.inferDomainFromTopics(config.focusTopics);
    const roleDescription = this.generateRoleDescription(domain, config.focusTopics);
    const expertiseAreas = this.generateExpertiseAreas(domain, config.focusTopics);

    instructions.push(`# PROJECT INSTRUCTIONS: ${domain.title} AI Assistant`);
    instructions.push(`Based on ${config.linkedinUsername} methodology`);
    instructions.push('');
    instructions.push('---');
    instructions.push('');

    instructions.push('## Your Role');
    instructions.push('');
    instructions.push(roleDescription);
    instructions.push('');

    instructions.push('## Core Expertise Areas');
    instructions.push('');
    for (const area of expertiseAreas) {
      instructions.push(`- **${area.title}:** ${area.description}`);
    }
    instructions.push('');

    const responseGuidance = this.generateResponseGuidance(domain, config.focusTopics);
    instructions.push('## How to Respond to Users');
    instructions.push('');
    instructions.push(responseGuidance.intro);
    instructions.push('');
    for (let i = 0; i < responseGuidance.steps.length; i++) {
      instructions.push(`${i + 1}. **${responseGuidance.steps[i].title}**`);
      for (const point of responseGuidance.steps[i].points) {
        instructions.push(`   - ${point}`);
      }
      instructions.push('');
    }

    // Key Frameworks
    instructions.push('## Key Frameworks to Apply');
    instructions.push('');

    if (analysis.methodologies && analysis.methodologies.length > 0) {
      const topMethodologies = analysis.methodologies.slice(0, 3);
      for (const methodology of topMethodologies) {
        instructions.push(`### ${methodology.name}`);
        instructions.push(methodology.description);
        instructions.push('');
      }
    } else {
      instructions.push('*Frameworks will be extracted from the Knowledge Base as insights are gathered.*');
      instructions.push('');
    }

    // Success Metrics (dynamically generated based on domain)
    const successMetrics = this.generateSuccessMetrics(domain);
    instructions.push('## Success Metrics');
    instructions.push('');
    instructions.push('Help users track:');
    for (const metric of successMetrics) {
      instructions.push(`- ${metric}`);
    }
    instructions.push('');

    // Tone & Style
    instructions.push('## Tone & Style');
    instructions.push('');
    instructions.push('- Be conversational, not corporate');
    instructions.push('- Show confidence backed by data');
    instructions.push('- Challenge ineffective habits directly');
    instructions.push('- Celebrate authenticity over perfection');
    instructions.push('');

    instructions.push('---');
    instructions.push('');
    instructions.push(`**Reference Materials:** ${analysis.insights.length} insights, ${analysis.templates.length} templates, ${analysis.methodologies?.length || 0} methodologies from ${analysis.posts.length} posts`);

    return instructions.join('\n');
  }

  private organizeTemplatesByCategory(analysis: InsightAnalysis): Record<string, string[]> {
    const organized: Record<string, string[]> = {
      'Initial Outreach': [],
      'Follow-Up': [],
      'Discovery': [],
      'Objection Handling': [],
      'Closing': [],
      'Other': []
    };

    for (const template of analysis.templates) {
      const lowerTemplate = template.toLowerCase();

      if (lowerTemplate.includes('follow up') || lowerTemplate.includes('name might look familiar') || lowerTemplate.includes('checking back')) {
        organized['Follow-Up'].push(template);
      } else if (lowerTemplate.includes('discovery') || lowerTemplate.includes('question') || lowerTemplate.includes('learn more')) {
        organized['Discovery'].push(template);
      } else if (lowerTemplate.includes('objection') || lowerTemplate.includes('not the right person') || lowerTemplate.includes('budget')) {
        organized['Objection Handling'].push(template);
      } else if (lowerTemplate.includes('close') || lowerTemplate.includes('contract') || lowerTemplate.includes('decision')) {
        organized['Closing'].push(template);
      } else if (lowerTemplate.includes('hi ') || lowerTemplate.includes('hello') || lowerTemplate.includes('saw your')) {
        organized['Initial Outreach'].push(template);
      } else {
        organized['Other'].push(template);
      }
    }

    return organized;
  }

  private groupInsightsByCategory(insights: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const insight of insights) {
      const category = insight.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(insight);
    }

    return grouped;
  }

  private formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private inferDomainFromTopics(focusTopics?: string[]): { title: string; domain: string } {
    if (!focusTopics || focusTopics.length === 0) {
      return { title: 'Expert', domain: 'general' };
    }

    const topics = focusTopics.join(' ').toLowerCase();

    // Fundraising/VC domain
    if (topics.includes('fundrais') || topics.includes('venture capital') ||
        topics.includes('investment') || topics.includes('pitch deck') ||
        topics.includes('investor') || topics.includes('funding') ||
        topics.includes('capital raising')) {
      return { title: 'Fundraising & Investment', domain: 'fundraising' };
    }

    // Sales domain
    if (topics.includes('sales') || topics.includes('outreach') ||
        topics.includes('prospecting') || topics.includes('cadence') ||
        topics.includes('closing')) {
      return { title: 'Sales', domain: 'sales' };
    }

    // Marketing domain
    if (topics.includes('marketing') || topics.includes('growth') ||
        topics.includes('content') || topics.includes('branding')) {
      return { title: 'Marketing & Growth', domain: 'marketing' };
    }

    // Product domain
    if (topics.includes('product') || topics.includes('design') ||
        topics.includes('user experience') || topics.includes('feature')) {
      return { title: 'Product Development', domain: 'product' };
    }

    // Leadership domain
    if (topics.includes('leadership') || topics.includes('management') ||
        topics.includes('team') || topics.includes('culture')) {
      return { title: 'Leadership & Management', domain: 'leadership' };
    }

    return { title: 'Expert', domain: 'general' };
  }

  private generateRoleDescription(domain: { title: string; domain: string }, focusTopics?: string[]): string {
    const topicsStr = focusTopics && focusTopics.length > 0 ? focusTopics.join(', ') : '';

    switch (domain.domain) {
      case 'fundraising':
        return `You are an expert fundraising advisor specializing in helping founders secure capital from investors. Your expertise covers ${topicsStr}. Your advice is grounded in proven strategies from successful founders who have raised millions in funding.`;

      case 'sales':
        return `You are an expert sales consultant specializing in B2B outreach, email cadences, and deal closing. Your advice is grounded in proven methodologies from top sales professionals.`;

      case 'marketing':
        return `You are an expert marketing strategist specializing in ${topicsStr}. Your advice is based on proven frameworks from top growth marketers.`;

      case 'product':
        return `You are an expert product advisor specializing in ${topicsStr}. Your guidance is based on best practices from leading product teams.`;

      case 'leadership':
        return `You are an expert leadership coach specializing in ${topicsStr}. Your advice draws from proven management frameworks and successful leaders.`;

      default:
        return `You are an expert consultant specializing in ${topicsStr}. Your advice is grounded in proven methodologies from top professionals in the field.`;
    }
  }

  private generateExpertiseAreas(domain: { title: string; domain: string }, focusTopics?: string[]): Array<{ title: string; description: string }> {
    switch (domain.domain) {
      case 'fundraising':
        return [
          { title: 'Pitch Development', description: 'Craft compelling pitch decks and narratives that resonate with investors' },
          { title: 'Investor Relations', description: 'Build and maintain relationships with VCs, angels, and strategic investors' },
          { title: 'Deal Strategy', description: 'Navigate term sheets, valuations, and funding round mechanics' },
          { title: 'Due Diligence Prep', description: 'Prepare comprehensive data rooms and respond to investor questions' },
          { title: 'Cap Table Management', description: 'Structure equity, SAFEs, and convertible notes strategically' }
        ];

      case 'sales':
        return [
          { title: 'Email Outreach', description: 'Craft personalized, high-converting sales emails' },
          { title: 'Cadence Development', description: 'Build multi-touch sequences that move deals forward' },
          { title: 'Deal Strategy', description: 'Analyze accounts and develop winning closing strategies' },
          { title: 'Objection Handling', description: 'Address common sales objections with proven frameworks' },
          { title: 'Prospecting', description: 'Identify and qualify high-value prospects efficiently' }
        ];

      case 'marketing':
        return [
          { title: 'Content Strategy', description: 'Develop content that drives engagement and conversions' },
          { title: 'Growth Tactics', description: 'Implement scalable acquisition and retention strategies' },
          { title: 'Brand Positioning', description: 'Define and communicate unique value propositions' },
          { title: 'Channel Optimization', description: 'Maximize ROI across marketing channels' }
        ];

      case 'product':
        return [
          { title: 'Product Strategy', description: 'Define roadmaps and prioritize features' },
          { title: 'User Research', description: 'Understand user needs and validate assumptions' },
          { title: 'Design Thinking', description: 'Apply user-centered design principles' },
          { title: 'Metrics & Analytics', description: 'Track and optimize key product metrics' }
        ];

      case 'leadership':
        return [
          { title: 'Team Building', description: 'Recruit, develop, and retain top talent' },
          { title: 'Culture Development', description: 'Build and maintain strong company culture' },
          { title: 'Strategic Planning', description: 'Set vision and execute on long-term goals' },
          { title: 'Performance Management', description: 'Give feedback and drive accountability' }
        ];

      default:
        const topics = focusTopics || [];
        return topics.slice(0, 5).map(topic => ({
          title: topic.charAt(0).toUpperCase() + topic.slice(1),
          description: `Expert guidance on ${topic}`
        }));
    }
  }

  private generateSuccessMetrics(domain: { title: string; domain: string }): string[] {
    switch (domain.domain) {
      case 'fundraising':
        return [
          'Investor meeting conversion rate (target: 20-30% of intros → meetings)',
          'Pitch deck engagement (time spent, questions asked)',
          'Follow-up response rate from investors',
          'Time from first meeting to term sheet',
          'Amount raised vs. target',
          'Quality of investor relationships and value-add'
        ];

      case 'sales':
        return [
          'Email open rates (target: >40%)',
          'Response rates (target: >10%)',
          'Meeting booking rates (target: >3%)',
          'Pipeline velocity (time to close)',
          'Deal size (average contract value)'
        ];

      case 'marketing':
        return [
          'Customer acquisition cost (CAC)',
          'Conversion rates by channel',
          'Engagement metrics (CTR, time on site)',
          'Brand awareness and reach',
          'Content performance and virality'
        ];

      case 'product':
        return [
          'User activation and retention rates',
          'Feature adoption metrics',
          'Customer satisfaction (NPS, CSAT)',
          'Time to value for new users',
          'Product-market fit indicators'
        ];

      case 'leadership':
        return [
          'Team retention and satisfaction',
          'Employee engagement scores',
          'Execution velocity on key initiatives',
          'Team productivity and output quality',
          'Leadership effectiveness feedback'
        ];

      default:
        return [
          'Key performance indicators for your domain',
          'Progress toward stated goals',
          'Stakeholder satisfaction',
          'Impact and outcomes achieved'
        ];
    }
  }

  private generateResponseGuidance(domain: { title: string; domain: string }, focusTopics?: string[]): {
    intro: string;
    steps: Array<{ title: string; points: string[] }>
  } {
    switch (domain.domain) {
      case 'fundraising':
        return {
          intro: 'When users ask for fundraising help:',
          steps: [
            {
              title: 'Gather Context First',
              points: [
                'Ask about company stage, traction, and funding history',
                'Understand their target raise amount and timeline',
                'Clarify their investor target profile (angels, VCs, stage, thesis)',
                'Learn about their current traction and metrics'
              ]
            },
            {
              title: 'Apply Core Principles',
              points: [
                'Always emphasize storytelling and narrative',
                'Lead with traction and proof points',
                'Think in terms of investor psychology',
                'Use social proof and warm introductions strategically'
              ]
            },
            {
              title: 'Provide Actionable Guidance',
              points: [
                'Give specific pitch deck feedback and examples',
                'Explain WHY each element matters to investors',
                'Offer 2-3 variations for A/B testing',
                'Include email templates for investor outreach'
              ]
            },
            {
              title: 'Include Follow-Up Strategy',
              points: [
                'Never give one-off advice',
                'Plan the investor funnel and follow-up sequence',
                'Suggest timing for updates and check-ins'
              ]
            },
            {
              title: 'Reference Proven Methods',
              points: [
                'Use frameworks from Knowledge Base',
                'Cite relevant examples and case studies',
                'Share success metrics when available'
              ]
            }
          ]
        };

      case 'sales':
        return {
          intro: 'When users ask for sales help:',
          steps: [
            {
              title: 'Gather Context First',
              points: [
                'Ask about industry, company size, deal stage',
                'Understand previous interactions with prospect',
                'Clarify their specific goal or challenge'
              ]
            },
            {
              title: 'Apply Core Rules',
              points: [
                'Always emphasize personalization (SMYKM)',
                'Lead with value, not features',
                'Think in sequences, not single touches',
                'Use social proof strategically'
              ]
            },
            {
              title: 'Provide Actionable Scripts',
              points: [
                'Give exact wording they can use or adapt',
                'Explain WHY each element works',
                'Offer 2-3 variations for A/B testing'
              ]
            },
            {
              title: 'Include Follow-Up Strategy',
              points: [
                'Never give one-off advice',
                'Plan the next 2-3 touches',
                'Suggest timing and channels'
              ]
            },
            {
              title: 'Reference Proven Methods',
              points: [
                'Use frameworks from Knowledge Base',
                'Cite relevant templates and examples',
                'Share success metrics when available'
              ]
            }
          ]
        };

      default:
        const domainName = domain.title.toLowerCase();
        return {
          intro: `When users ask for ${domainName} help:`,
          steps: [
            {
              title: 'Gather Context First',
              points: [
                'Ask about their specific situation and goals',
                'Understand constraints and resources',
                'Clarify what success looks like'
              ]
            },
            {
              title: 'Apply Core Principles',
              points: [
                'Lead with insights and frameworks',
                'Think strategically about their situation',
                'Use proven methodologies from the knowledge base'
              ]
            },
            {
              title: 'Provide Actionable Guidance',
              points: [
                'Give specific, tactical recommendations',
                'Explain the reasoning behind advice',
                'Offer alternatives and variations'
              ]
            },
            {
              title: 'Include Follow-Up',
              points: [
                'Suggest next steps',
                'Provide resources for deeper learning',
                'Plan for iteration and improvement'
              ]
            },
            {
              title: 'Reference Proven Methods',
              points: [
                'Use frameworks from Knowledge Base',
                'Cite relevant examples',
                'Share success metrics when available'
              ]
            }
          ]
        };
    }
  }

  async saveThreeFiles(
    output: ThreeFileOutput,
    profileUsername: string,
    outputDir: string = './data'
  ): Promise<{ folderPath: string; files: string[] }> {
    // Create timestamp
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '');
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(/\s/g, '').toLowerCase();

    // Create folder name
    const folderName = `${profileUsername}-${dateStr}-${timeStr}`;
    const folderPath = path.join(outputDir, folderName);

    // Create directory
    await fs.mkdir(folderPath, { recursive: true });

    // Define file paths
    const files = {
      knowledgeBase: path.join(folderPath, '1-knowledge-base.txt'),
      coreRules: path.join(folderPath, '2-core-rules.txt'),
      projectInstructions: path.join(folderPath, '3-project-instructions.txt')
    };

    // Write files
    await Promise.all([
      fs.writeFile(files.knowledgeBase, output.knowledgeBase, 'utf-8'),
      fs.writeFile(files.coreRules, output.coreRules, 'utf-8'),
      fs.writeFile(files.projectInstructions, output.projectInstructions, 'utf-8')
    ]);

    console.log(`📁 Created output folder: ${folderPath}`);
    console.log(`   📄 1-knowledge-base.txt (${Math.round(output.knowledgeBase.length / 1024)}KB)`);
    console.log(`   📄 2-core-rules.txt (${Math.round(output.coreRules.length / 1024)}KB)`);
    console.log(`   📄 3-project-instructions.txt (${Math.round(output.projectInstructions.length / 1024)}KB)`);

    return {
      folderPath,
      files: [files.knowledgeBase, files.coreRules, files.projectInstructions]
    };
  }
}
