/**
 * Simple Tool System for Deep Thought
 * 
 * Design Philosophy:
 * - DEAD SIMPLE - Even 4B models can understand
 * - Max 5-6 tools (cognitive load management)
 * - Clear names (search_web NOT exa_neural_discovery)
 * - 1-3 params max per tool
 * - Plain English descriptions
 * - RAG-assisted discovery (LLM can't hallucinate tools)
 */

import { powerAnswer, powerRead, type ExaResult } from './exa';
import { generateImage, generateAgenticVideo, type GeneratedImage } from './mediaGeneration';
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT } from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface DeepThoughtConfig {
  maxTurns: number;
  currentTurn: number;
  userQuery: string;
  notes: string[];         // Accumulated thoughts
  toolResults: ToolResult[];
}

export interface ToolResult {
  turn: number;
  tool: string;
  input: any;
  output: any;
  timestamp: string;
  success: boolean;
}

// ============================================================================
// TOOL DEFINITIONS (SIMPLE & FOCUSED)
// ============================================================================

/**
 * ONLY 5 tools - keep it simple!
 * 
 * Rule: If you're tempted to add more tools, you're doing it wrong.
 * Instead, make existing tools more flexible.
 */
export const DEEP_THOUGHT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for current information. Returns an AI-generated answer with sources. Use this for any factual question, news, or recent events.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "What to search for (plain English question)" 
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_url",
      description: "Read the full content of a specific webpage. Use this when you found a URL and need to know what's on that page.",
      parameters: {
        type: "object",
        properties: {
          url: { 
            type: "string", 
            description: "The URL to read" 
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "make_image",
      description: "Create an image based on a description. You write the description with all creative details.",
      parameters: {
        type: "object",
        properties: {
          description: { 
            type: "string", 
            description: "Detailed description of the image (you write this, not the user)" 
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "make_video",
      description: "Create a short video based on a description. You write the description with all creative details.",
      parameters: {
        type: "object",
        properties: {
          description: { 
            type: "string", 
            description: "Detailed description of the video (you write this, not the user)" 
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_thought",
      description: "Save an important finding or reasoning step. Use this to remember things for later turns.",
      parameters: {
        type: "object",
        properties: {
          thought: { 
            type: "string", 
            description: "What you learned or figured out" 
          }
        },
        required: ["thought"]
      }
    }
  }
];

// ============================================================================
// TOOL DESCRIPTIONS FOR RAG
// ============================================================================

/**
 * Get tool descriptions formatted for RAG storage
 * 
 * This helps the LLM remember what tools exist without hallucinating.
 */
export function getToolDescriptionsForRAG(): string {
  return DEEP_THOUGHT_TOOLS
    .map(t => `${t.function.name}: ${t.function.description}`)
    .join('\n\n');
}

/**
 * Get tool list for system prompt (minimal version)
 */
export function getToolListForPrompt(): string {
  return DEEP_THOUGHT_TOOLS
    .map(t => `- ${t.function.name}`)
    .join('\n');
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Execute a tool call
 * 
 * Maps simple tool names to complex implementations.
 * This abstraction keeps the LLM interface simple.
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  context: DeepThoughtConfig
): Promise<ToolResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    let output: any;
    
    switch (toolName) {
      case "search_web": {
        // Maps to Exa powerAnswer with ALWAYS live crawl
        const result: ExaResult = await powerAnswer(args.query, { 
          numResults: 10,
          livecrawl: 'always'  // CRITICAL: Always use live data
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Search failed');
        }
        
        output = {
          answer: result.answer,
          sources: result.sourceUrls,
          query: args.query
        };
        break;
      }
      
      case "read_url": {
        // Maps to Exa powerRead with ALWAYS live crawl
        const result: ExaResult = await powerRead(args.url, {
          livecrawl: 'always'  // CRITICAL: Always use live data
        });
        
        if (!result.success) {
          throw new Error(result.error || 'URL read failed');
        }
        
        output = {
          content: result.answer,
          url: args.url
        };
        break;
      }
      
      case "make_image": {
        // LLM already wrote the detailed description
        const result: GeneratedImage = await generateImage({
          prompt: args.description,
          model: DEFAULT_IMAGE_MODEL,
          width: DEFAULT_IMAGE_WIDTH,
          height: DEFAULT_IMAGE_HEIGHT,
        });
        
        output = {
          imageUrl: result.signedContent.dataUrl,
          description: args.description,
          metadata: result.signedContent.metadata
        };
        break;
      }
      
      case "make_video": {
        const result = await generateAgenticVideo({
          sceneSuggestion: args.description,
          duration: 5
        });
        
        output = {
          videoUrl: result.video.url,
          description: args.description,
          aiDecision: result.aiSceneDecision
        };
        break;
      }
      
      case "save_thought": {
        // Store thought in context
        context.notes.push(`[Turn ${context.currentTurn}] ${args.thought}`);
        
        output = {
          saved: args.thought,
          noteCount: context.notes.length
        };
        break;
      }
      
      default:
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${getToolListForPrompt()}`);
    }
    
    const toolResult: ToolResult = {
      turn: context.currentTurn,
      tool: toolName,
      input: args,
      output,
      timestamp,
      success: true
    };
    
    context.toolResults.push(toolResult);
    
    const elapsed = Date.now() - startTime;
    console.log(`[Tool] ${toolName} completed in ${elapsed}ms`);
    
    return toolResult;
    
  } catch (error: any) {
    console.error(`[Tool] ${toolName} failed:`, error);
    
    const toolResult: ToolResult = {
      turn: context.currentTurn,
      tool: toolName,
      input: args,
      output: {
        error: error.message
      },
      timestamp,
      success: false
    };
    
    context.toolResults.push(toolResult);
    
    return toolResult;
  }
}

// ============================================================================
// RAG-ASSISTED TOOL DISCOVERY
// ============================================================================

/**
 * Retrieve relevant tools for a given query
 * 
 * This prevents the LLM from:
 * 1. Forgetting what tools exist
 * 2. Hallucinating non-existent tools
 * 3. Using wrong tool for the task
 * 
 * TODO: Integrate with actual RAG system when available
 */
export function getRelevantTools(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword matching (replace with RAG later)
  const keywords = {
    search_web: ['search', 'find', 'what', 'when', 'where', 'who', 'how', 'why', 'recent', 'latest', 'current', 'news'],
    read_url: ['url', 'page', 'website', 'link', 'article'],
    make_image: ['image', 'picture', 'photo', 'draw', 'create', 'visualize', 'show me'],
    make_video: ['video', 'animation', 'movie', 'clip'],
    save_thought: ['remember', 'note', 'save', 'record']
  };
  
  const relevantTools: string[] = [];
  
  for (const [toolName, toolKeywords] of Object.entries(keywords)) {
    if (toolKeywords.some(keyword => lowerQuery.includes(keyword))) {
      const tool = DEEP_THOUGHT_TOOLS.find(t => t.function.name === toolName);
      if (tool) {
        relevantTools.push(`${tool.function.name}: ${tool.function.description}`);
      }
    }
  }
  
  // If no specific match, return all tools
  if (relevantTools.length === 0) {
    return getToolDescriptionsForRAG();
  }
  
  return relevantTools.join('\n\n');
}

// ============================================================================
// TOOL VALIDATION
// ============================================================================

/**
 * Validate that a tool call has required parameters
 */
export function validateToolCall(toolName: string, args: any): { valid: boolean; error?: string } {
  const tool = DEEP_THOUGHT_TOOLS.find(t => t.function.name === toolName);
  
  if (!tool) {
    return {
      valid: false,
      error: `Tool "${toolName}" does not exist. Available: ${getToolListForPrompt()}`
    };
  }
  
  const required = tool.function.parameters.required || [];
  
  for (const param of required) {
    if (!args[param]) {
      return {
        valid: false,
        error: `Tool "${toolName}" requires parameter: ${param}`
      };
    }
  }
  
  return { valid: true };
}

// ============================================================================
// TOOL STATISTICS
// ============================================================================

/**
 * Get statistics about tool usage in a Deep Thought session
 */
export function getToolStats(context: DeepThoughtConfig): {
  totalCalls: number;
  successRate: number;
  toolBreakdown: Record<string, number>;
  averageTime: number;
} {
  const totalCalls = context.toolResults.length;
  const successful = context.toolResults.filter(r => r.success).length;
  
  const toolBreakdown: Record<string, number> = {};
  for (const result of context.toolResults) {
    toolBreakdown[result.tool] = (toolBreakdown[result.tool] || 0) + 1;
  }
  
  return {
    totalCalls,
    successRate: totalCalls > 0 ? successful / totalCalls : 0,
    toolBreakdown,
    averageTime: 0  // TODO: Calculate from timestamps
  };
}
