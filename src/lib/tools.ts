/**
 * Simple Tool System for Deep Thought
 *
 * Design Philosophy:
 * - DEAD SIMPLE - Even 4B models can understand
 * - Clear names (search_web NOT exa_neural_discovery)
 * - 1-3 params max per tool
 * - Plain English descriptions
 * - RAG-assisted discovery (LLM can't hallucinate tools)
 *
 * Tool Naming: ALIGNED WITH DESKTOP APP
 * - generate_image (not make_image)
 * - generate_video (not make_video)
 * - generate_persona_selfie (for AI self-portraits)
 *
 * @module
 */

import { logger } from "./logger";

/**
 * UNIFIED ARCHITECTURE:
 * - Tool definitions come from unified-registry.ts (shared with Desktop)
 * - Cloud-specific implementations are here
 * - Desktop uses equivalent implementations via IPC
 */

import { getAPIKeySync } from "./byok";
import { getActiveCharacter } from "./characters";
import { DEFAULT_IMAGE_HEIGHT, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_WIDTH } from "./constants";
import { type ExaResult, powerAnswer, powerRead } from "./exa";
import { type GeneratedImage, generateAgenticVideo, generateImage } from "./mediaGeneration";
import type { Tool as UnifiedTool } from "./unified-registry";
import { UNIFIED_TOOLS } from "./unified-registry";

// Re-export Tool type for backward compatibility
export type Tool = UnifiedTool;

// ============================================================================
// TYPES
// ============================================================================

export interface DeepThoughtConfig {
	maxTurns: number;
	currentTurn: number;
	userQuery: string;
	notes: string[]; // Accumulated thoughts
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
// TOOL DEFINITIONS - FROM UNIFIED REGISTRY
// ============================================================================

/**
 * DEEP_THOUGHT_TOOLS - Cloud-specific subset of UNIFIED_TOOLS
 *
 * Cloud app supports:
 * - search_web, read_url (web tools)
 * - generate_image, generate_persona_selfie, generate_video (media)
 * - save_thought (internal)
 *
 * Cloud does NOT support (Desktop-only):
 * - search_knowledge_base (local RAG)
 * - search_conversation_memory (local RAG)
 * - search_emotional_context (local RAG)
 * - generate_voice_clip (local TTS/Piper)
 * - analyze_emotion_from_text, update_persona_mood
 *
 * When Cloud gets RAG sync, we'll enable more tools.
 */
export const DEEP_THOUGHT_TOOLS: Tool[] = [
	// Web tools (from unified registry)
	UNIFIED_TOOLS.find((t) => t.function.name === "search_web"),
	UNIFIED_TOOLS.find((t) => t.function.name === "read_url"),
	// Content generation (from unified registry)
	UNIFIED_TOOLS.find((t) => t.function.name === "generate_image"),
	UNIFIED_TOOLS.find((t) => t.function.name === "generate_persona_selfie"),
	UNIFIED_TOOLS.find((t) => t.function.name === "generate_video"),
	// Cloud-only: save_thought (also in unified registry now)
	UNIFIED_TOOLS.find((t) => t.function.name === "save_thought"),
].filter((tool): tool is Tool => tool !== undefined);

// ============================================================================
// TOOL DESCRIPTIONS FOR RAG
// ============================================================================

/**
 * Get tool descriptions formatted for RAG storage
 *
 * This helps the LLM remember what tools exist without hallucinating.
 */
export function getToolDescriptionsForRAG(): string {
	return DEEP_THOUGHT_TOOLS.map((t) => `${t.function.name}: ${t.function.description}`).join("\n\n");
}

/**
 * Get tool list for system prompt (minimal version)
 */
export function getToolListForPrompt(): string {
	return DEEP_THOUGHT_TOOLS.map((t) => `- ${t.function.name}`).join("\n");
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
export async function executeToolCall(toolName: string, args: any, context: DeepThoughtConfig): Promise<ToolResult> {
	const startTime = Date.now();
	const timestamp = new Date().toISOString();

	try {
		let output: any;

		switch (toolName) {
			case "search_web": {
				// Maps to Exa powerAnswer with ALWAYS live crawl
				const result: ExaResult = await powerAnswer(args.query, {
					numResults: 10,
					livecrawl: "always", // CRITICAL: Always use live data
				});

				if (!result.success) {
					throw new Error(result.error || "Search failed");
				}

				output = {
					answer: result.answer,
					sources: result.sourceUrls,
					query: args.query,
				};
				break;
			}

			case "read_url": {
				// Maps to Exa powerRead with ALWAYS live crawl
				const result: ExaResult = await powerRead(args.url, {
					livecrawl: "always", // CRITICAL: Always use live data
				});

				if (!result.success) {
					throw new Error(result.error || "URL read failed");
				}

				output = {
					content: result.answer,
					url: args.url,
				};
				break;
			}

			// ALIGNED: Renamed from make_image to match Desktop toolHandlers.js
			case "generate_image": {
				// LLM already wrote the detailed description
				const result: GeneratedImage = await generateImage({
					prompt: args.prompt,
					model: args.model || DEFAULT_IMAGE_MODEL,
					width: args.width || DEFAULT_IMAGE_WIDTH,
					height: args.height || DEFAULT_IMAGE_HEIGHT,
				});

				output = {
					imageUrl: result.signedContent.dataUrl,
					prompt: args.prompt,
					model: args.model || DEFAULT_IMAGE_MODEL,
					metadata: result.signedContent.metadata,
				};
				break;
			}

			// ALIGNED: Tool name matches Desktop "generate_persona_selfie"
			case "generate_persona_selfie": {
				const character = getActiveCharacter();

				// Build persona-aware prompt using character's first-person description
				const baseAppearance = character.descriptionFirstPerson || character.description;

				// Context-based wardrobe selection (same as Desktop)
				const wardrobeMap: Record<string, string> = {
					gym: "workout clothes, athletic wear, sporty setting",
					workout: "fitness attire, gym environment",
					office: "business attire, professional setting",
					meeting: "professional outfit, conference room",
					party: "elegant party outfit, festive atmosphere",
					casual: "casual comfortable clothes, relaxed setting",
					formal: "formal elegant attire, upscale venue",
					home: "comfortable home wear, cozy domestic setting",
					beach: "beach attire, coastal setting with waves",
					garden: "comfortable outdoor clothes, lush greenery",
				};

				// Determine attire from context or explicit override
				const contextKey = args.context?.toLowerCase() || "";
				const attire =
					args.custom_attire ||
					Object.entries(wardrobeMap).find(([key]) => contextKey.includes(key))?.[1] ||
					character.attire ||
					wardrobeMap.casual;

				// Build the full prompt
				const enhancedPrompt =
					`Portrait photograph: ${baseAppearance}. ${attire}. ` +
					`Scene: ${args.context}. Mood: ${args.mood} expression. ` +
					`High quality, detailed, natural lighting, authentic composition. ` +
					`${character.negativePrompt ? `Avoid: ${character.negativePrompt}` : ""}`;

				const result: GeneratedImage = await generateImage({
					prompt: enhancedPrompt,
					model: DEFAULT_IMAGE_MODEL,
					width: 768, // Portrait ratio
					height: 1024,
				});

				output = {
					imageUrl: result.signedContent.dataUrl,
					persona: character.name,
					context: args.context,
					mood: args.mood,
					attireUsed: attire,
					metadata: result.signedContent.metadata,
				};
				break;
			}

			// ALIGNED: Renamed from make_video to match Desktop toolHandlers.js
			case "generate_video": {
				const result = await generateAgenticVideo({
					sceneSuggestion: args.prompt,
					duration: args.duration || 5,
				});

				output = {
					videoUrl: result.video.url,
					prompt: args.prompt,
					duration: args.duration || 5,
					model: result.video.model,
					aiDecision: result.aiSceneDecision,
				};
				break;
			}

			case "save_thought": {
				// Store thought in context
				context.notes.push(`[Turn ${context.currentTurn}] ${args.thought}`);

				output = {
					saved: args.thought,
					noteCount: context.notes.length,
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
			success: true,
		};

		context.toolResults.push(toolResult);

		const elapsed = Date.now() - startTime;
		logger.debug(`${toolName} completed in ${elapsed}ms`, { component: "Tool" });

		return toolResult;
	} catch (error: any) {
		console.error(`[Tool] ${toolName} failed:`, error);

		const toolResult: ToolResult = {
			turn: context.currentTurn,
			tool: toolName,
			input: args,
			output: {
				error: error.message,
			},
			timestamp,
			success: false,
		};

		context.toolResults.push(toolResult);

		return toolResult;
	}
}

// ============================================================================
// TOOL AVAILABILITY CHECK
// ============================================================================

/**
 * Check which tools are currently available based on API keys
 */
export function getAvailableTools(): {
	tools: Tool[];
	unavailableReasons: string[];
} {
	const tools: Tool[] = [];
	const unavailableReasons: string[] = [];

	// Check if Exa key is available for web search tools
	const hasExaKey = !!getAPIKeySync("exa");

	if (hasExaKey) {
		// Add search_web and read_url if Exa key exists
		const searchWeb = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "search_web");
		const readUrl = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "read_url");
		if (searchWeb) tools.push(searchWeb);
		if (readUrl) tools.push(readUrl);
	} else {
		unavailableReasons.push("🔍 Web search tools (search_web, read_url) require Exa.ai API key");
	}

	// Check if Together key is available for media generation
	const hasTogetherKey = !!getAPIKeySync("together");

	if (hasTogetherKey) {
		// ALIGNED: Tool names now match Desktop (generate_image, generate_video, generate_persona_selfie)
		const genImage = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "generate_image");
		const genSelfie = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "generate_persona_selfie");
		const genVideo = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "generate_video");
		if (genImage) tools.push(genImage);
		if (genSelfie) tools.push(genSelfie);
		if (genVideo) tools.push(genVideo);
	} else {
		unavailableReasons.push(
			"🎨 Media generation tools (generate_image, generate_persona_selfie, generate_video) require Together.ai API key",
		);
	}

	// save_thought is always available (no API key needed)
	const saveThought = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === "save_thought");
	if (saveThought) tools.push(saveThought);

	return {
		tools: tools.filter(Boolean),
		unavailableReasons,
	};
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
	// ALIGNED: Tool names now match Desktop (generate_persona_selfie not generate_persona_image)
	const keywords: Record<string, string[]> = {
		search_web: ["search", "find", "what", "when", "where", "who", "how", "why", "recent", "latest", "current", "news"],
		read_url: ["url", "page", "website", "link", "article"],
		generate_image: ["image", "picture", "photo", "draw", "create", "visualize"],
		generate_persona_selfie: ["selfie", "show me you", "picture of you", "what do you look like", "see you"],
		generate_video: ["video", "animation", "movie", "clip"],
		save_thought: ["remember", "note", "save", "record"],
	};

	const relevantTools: string[] = [];

	for (const [toolName, toolKeywords] of Object.entries(keywords)) {
		if (toolKeywords.some((keyword) => lowerQuery.includes(keyword))) {
			const tool = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === toolName);
			if (tool) {
				relevantTools.push(`${tool.function.name}: ${tool.function.description}`);
			}
		}
	}

	// If no specific match, return all tools
	if (relevantTools.length === 0) {
		return getToolDescriptionsForRAG();
	}

	return relevantTools.join("\n\n");
}

// ============================================================================
// TOOL VALIDATION
// ============================================================================

/**
 * Validate that a tool call has required parameters
 */
export function validateToolCall(toolName: string, args: any): { valid: boolean; error?: string } {
	const tool = DEEP_THOUGHT_TOOLS.find((t) => t.function.name === toolName);

	if (!tool) {
		return {
			valid: false,
			error: `Tool "${toolName}" does not exist. Available: ${getToolListForPrompt()}`,
		};
	}

	const required = tool.function.parameters.required || [];

	for (const param of required) {
		if (!args[param]) {
			return {
				valid: false,
				error: `Tool "${toolName}" requires parameter: ${param}`,
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
	const successful = context.toolResults.filter((r) => r.success).length;

	const toolBreakdown: Record<string, number> = {};
	for (const result of context.toolResults) {
		toolBreakdown[result.tool] = (toolBreakdown[result.tool] || 0) + 1;
	}

	return {
		totalCalls,
		successRate: totalCalls > 0 ? successful / totalCalls : 0,
		toolBreakdown,
		averageTime: 0, // TODO: Calculate from timestamps
	};
}
