/**
 * Document Template System
 * 
 * Provides structured templates for common document types.
 * Each template guides the AI through creating professional documents
 * section by section with proper structure.
 */

export interface DocumentTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  sections: DocumentSection[];
  estimatedTime: string;
  category: 'business' | 'technical' | 'creative' | 'academic';
}

export interface DocumentSection {
  id: string;
  title: string;
  guidancePrompt: string;
  placeholder?: string;
  requiredContent?: string[];
  estimatedTokens: number;
}

export const DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
  'business-plan': {
    id: 'business-plan',
    name: 'Business Plan',
    icon: '📊',
    description: 'Comprehensive business plan with market analysis and financial projections',
    category: 'business',
    estimatedTime: '10-15 minutes',
    sections: [
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        guidancePrompt: 'Write a compelling executive summary that captures the business opportunity, solution, and key metrics. Keep it concise (1-2 pages).',
        placeholder: 'Brief overview of the business...',
        estimatedTokens: 500,
      },
      {
        id: 'problem-solution',
        title: 'Problem & Solution',
        guidancePrompt: 'Describe the problem your business solves and your unique solution. Be specific about pain points and how you address them.',
        estimatedTokens: 400,
      },
      {
        id: 'market-analysis',
        title: 'Market Analysis',
        guidancePrompt: 'Analyze the target market, size, trends, and growth potential. Include competitor analysis.',
        requiredContent: ['Market size', 'Target audience', 'Competition'],
        estimatedTokens: 600,
      },
      {
        id: 'business-model',
        title: 'Business Model',
        guidancePrompt: 'Explain how the business makes money. Include pricing strategy, revenue streams, and unit economics.',
        estimatedTokens: 400,
      },
      {
        id: 'go-to-market',
        title: 'Go-to-Market Strategy',
        guidancePrompt: 'Outline the marketing and sales strategy. How will you acquire customers?',
        estimatedTokens: 400,
      },
      {
        id: 'financial-projections',
        title: 'Financial Projections',
        guidancePrompt: 'Provide 3-5 year financial projections including revenue, expenses, and profitability timeline.',
        estimatedTokens: 500,
      },
      {
        id: 'team',
        title: 'Team & Operations',
        guidancePrompt: 'Describe key team members, organizational structure, and operational plans.',
        estimatedTokens: 300,
      },
    ],
  },
  
  'research-report': {
    id: 'research-report',
    name: 'Research Report',
    icon: '🔬',
    description: 'Academic-style research report with citations and methodology',
    category: 'academic',
    estimatedTime: '8-12 minutes',
    sections: [
      {
        id: 'abstract',
        title: 'Abstract',
        guidancePrompt: 'Write a concise abstract (150-250 words) summarizing the research question, methodology, key findings, and implications.',
        estimatedTokens: 300,
      },
      {
        id: 'introduction',
        title: 'Introduction',
        guidancePrompt: 'Introduce the research topic, background, and research question. Explain why this research matters.',
        estimatedTokens: 500,
      },
      {
        id: 'literature-review',
        title: 'Literature Review',
        guidancePrompt: 'Review existing research on this topic. Identify gaps that your research addresses.',
        estimatedTokens: 700,
      },
      {
        id: 'methodology',
        title: 'Methodology',
        guidancePrompt: 'Describe the research methodology, data collection methods, and analysis approach.',
        estimatedTokens: 500,
      },
      {
        id: 'results',
        title: 'Results',
        guidancePrompt: 'Present the research findings clearly. Use tables, charts, or structured data where appropriate.',
        estimatedTokens: 600,
      },
      {
        id: 'discussion',
        title: 'Discussion',
        guidancePrompt: 'Interpret the results, discuss implications, and compare with existing literature.',
        estimatedTokens: 600,
      },
      {
        id: 'conclusion',
        title: 'Conclusion',
        guidancePrompt: 'Summarize key findings, limitations, and recommendations for future research.',
        estimatedTokens: 400,
      },
    ],
  },
  
  'technical-doc': {
    id: 'technical-doc',
    name: 'Technical Documentation',
    icon: '📚',
    description: 'Software or system documentation with architecture and API reference',
    category: 'technical',
    estimatedTime: '10-15 minutes',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        guidancePrompt: 'Provide a high-level overview of the system, its purpose, and key features.',
        estimatedTokens: 400,
      },
      {
        id: 'getting-started',
        title: 'Getting Started',
        guidancePrompt: 'Write a quick start guide with installation instructions and basic usage.',
        estimatedTokens: 500,
      },
      {
        id: 'architecture',
        title: 'Architecture',
        guidancePrompt: 'Describe the system architecture, components, and how they interact.',
        estimatedTokens: 600,
      },
      {
        id: 'api-reference',
        title: 'API Reference',
        guidancePrompt: 'Document key APIs, endpoints, or functions with parameters and examples.',
        estimatedTokens: 800,
      },
      {
        id: 'configuration',
        title: 'Configuration',
        guidancePrompt: 'Explain configuration options, environment variables, and settings.',
        estimatedTokens: 400,
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        guidancePrompt: 'List common issues and their solutions.',
        estimatedTokens: 400,
      },
    ],
  },
  
  'blog-post': {
    id: 'blog-post',
    name: 'Blog Post',
    icon: '✍️',
    description: 'Engaging blog post with SEO optimization',
    category: 'creative',
    estimatedTime: '5-8 minutes',
    sections: [
      {
        id: 'headline',
        title: 'Headline & Hook',
        guidancePrompt: 'Create an attention-grabbing headline and opening paragraph that hooks the reader.',
        estimatedTokens: 200,
      },
      {
        id: 'introduction',
        title: 'Introduction',
        guidancePrompt: 'Set up the problem or topic. Why should the reader care?',
        estimatedTokens: 300,
      },
      {
        id: 'main-content',
        title: 'Main Content',
        guidancePrompt: 'Deliver the core value. Use subheadings, examples, and actionable insights.',
        estimatedTokens: 1000,
      },
      {
        id: 'conclusion',
        title: 'Conclusion & CTA',
        guidancePrompt: 'Summarize key takeaways and include a call-to-action.',
        estimatedTokens: 200,
      },
    ],
  },
  
  'meeting-minutes': {
    id: 'meeting-minutes',
    name: 'Meeting Minutes',
    icon: '📝',
    description: 'Professional meeting minutes with action items',
    category: 'business',
    estimatedTime: '3-5 minutes',
    sections: [
      {
        id: 'header',
        title: 'Meeting Header',
        guidancePrompt: 'Document meeting date, time, attendees, and purpose.',
        estimatedTokens: 150,
      },
      {
        id: 'agenda',
        title: 'Agenda Items',
        guidancePrompt: 'List topics discussed with brief summaries.',
        estimatedTokens: 400,
      },
      {
        id: 'decisions',
        title: 'Decisions Made',
        guidancePrompt: 'Document key decisions and rationale.',
        estimatedTokens: 300,
      },
      {
        id: 'action-items',
        title: 'Action Items',
        guidancePrompt: 'List action items with owners and deadlines.',
        requiredContent: ['Action', 'Owner', 'Deadline'],
        estimatedTokens: 300,
      },
      {
        id: 'next-steps',
        title: 'Next Steps',
        guidancePrompt: 'Outline what happens next and when the next meeting is.',
        estimatedTokens: 150,
      },
    ],
  },
  
  'project-proposal': {
    id: 'project-proposal',
    name: 'Project Proposal',
    icon: '🎯',
    description: 'Project proposal with scope, timeline, and budget',
    category: 'business',
    estimatedTime: '8-10 minutes',
    sections: [
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        guidancePrompt: 'Briefly summarize the project, its objectives, and expected outcomes.',
        estimatedTokens: 300,
      },
      {
        id: 'background',
        title: 'Background & Context',
        guidancePrompt: 'Explain the background and why this project is needed.',
        estimatedTokens: 400,
      },
      {
        id: 'objectives',
        title: 'Project Objectives',
        guidancePrompt: 'List specific, measurable objectives.',
        estimatedTokens: 300,
      },
      {
        id: 'scope',
        title: 'Scope of Work',
        guidancePrompt: 'Define what is included and excluded from the project scope.',
        estimatedTokens: 500,
      },
      {
        id: 'timeline',
        title: 'Timeline & Milestones',
        guidancePrompt: 'Provide a project timeline with key milestones.',
        estimatedTokens: 400,
      },
      {
        id: 'budget',
        title: 'Budget & Resources',
        guidancePrompt: 'Outline estimated costs and required resources.',
        estimatedTokens: 400,
      },
      {
        id: 'risks',
        title: 'Risks & Mitigation',
        guidancePrompt: 'Identify potential risks and how they will be mitigated.',
        estimatedTokens: 400,
      },
    ],
  },
};

/**
 * Get all available templates
 */
export function getAllTemplates(): DocumentTemplate[] {
  return Object.values(DOCUMENT_TEMPLATES);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): DocumentTemplate | null {
  return DOCUMENT_TEMPLATES[id] || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): DocumentTemplate[] {
  return getAllTemplates().filter(t => t.category === category);
}

/**
 * Build a prompt for generating a section
 */
export function buildSectionPrompt(
  template: DocumentTemplate,
  section: DocumentSection,
  userInput: string,
  previousSections: Array<{ title: string; content: string }>
): string {
  let prompt = `You are creating a ${template.name}. Currently working on the "${section.title}" section.\n\n`;
  
  prompt += `**Guidance:** ${section.guidancePrompt}\n\n`;
  
  if (section.requiredContent && section.requiredContent.length > 0) {
    prompt += `**Required Content:** ${section.requiredContent.join(', ')}\n\n`;
  }
  
  if (previousSections.length > 0) {
    prompt += `**Previous Sections (for context):**\n`;
    previousSections.forEach(s => {
      prompt += `\n### ${s.title}\n${s.content.substring(0, 300)}${s.content.length > 300 ? '...' : ''}\n`;
    });
    prompt += '\n';
  }
  
  prompt += `**User Input:** ${userInput}\n\n`;
  prompt += `Now write the "${section.title}" section:`;
  
  return prompt;
}
