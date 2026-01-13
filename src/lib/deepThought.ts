/**
 * Deep Thought Engine - Multi-Turn Agentic Reasoning
 *
 * Philosophy:
 * - Don't force everything in one turn - let the AI think and work
 * - Send quick acknowledgment → do work → send final response
 * - Use as many turns as needed (up to user's max limit)
 * - Create experience of thinking AI companion, not GPT wrapper
 *
 * Architecture:
 * 1. User asks question with Deep Thought enabled
 * 2. AI sends quick "working on it" response
 * 3. AI uses tools (Exa, image/video gen) over multiple turns
 * 4. AI accumulates findings in save_thought
 * 5. AI sends final comprehensive response with results
 */

import { type ChatMessage, chat, type Tool } from "./api";
import { getActiveCharacter } from "./characters";
import { getSelectedModel } from "./models";
import { type DeepThoughtConfig, executeToolCall, getAvailableTools, type ToolResult } from "./tools";

// ============================================================================
// TYPES
// ============================================================================

export interface DeepThoughtResult {
	finalResponse: string;
	thinkingProcess: string; // Accumulated reasoning
	toolResults: ToolResult[];
	turnsUsed: number;
	success: boolean;
	error?: string;
}

export interface DeepThoughtOptions {
	maxTurns: number; // User-configured (5-20)
	model?: string; // Chat model to use (uses user's selected if not provided)
	systemPrompt?: string; // Optional custom system prompt
	onProgress?: (update: DeepThoughtProgress) => void; // Real-time updates
}

export interface DeepThoughtProgress {
	currentTurn: number;
	maxTurns: number;
	phase: "acknowledgment" | "thinking" | "tool_use" | "final_response";
	status: string; // Human-readable status
	intermediateResponse?: string; // "I am working on that..."
}

// ============================================================================
// DEEP THOUGHT SYSTEM PROMPT
// ============================================================================

function buildDeepThoughtSystemPrompt(userQuery: string, maxTurns: number): string {
	const character = getActiveCharacter();
	const { tools: availableTools, unavailableReasons } = getAvailableTools();

	// Build tool list from available tools
	const toolList =
		availableTools.length > 0
			? availableTools.map((t: Tool) => `- ${t.function.name}: ${t.function.description}`).join("\n")
			: "(No tools currently available)";

	// Add warning about unavailable tools if any
	const unavailableWarning =
		unavailableReasons.length > 0
			? `\n\n## Tools Currently Unavailable:\n\n${unavailableReasons.join("\n")}\n\nIf the user asks for something requiring these tools, politely explain you need the API key(s) to help with that request.`
			: "";

	return `You are ${character.name}.

# DEEP THOUGHT MODE - Multi-Turn Reasoning

You have ${maxTurns} turns to fully answer the user's question. Use them wisely.

## Your Workflow:

1. **FIRST TURN - Acknowledge**: Send a brief, in-character response like:
   - "I'm working on that for you..."
   - "Let me research that..."
   - "Interesting question, let me think..."

2. **MIDDLE TURNS - Work**: Use tools to gather information, create images/videos, etc.
   - search_web: Get CURRENT LIVE web data (not your training data!)
   - read_url: Read specific webpages
   - generate_image: Generate images (YOU choose model based on style)
   - generate_video: Generate videos
   - save_thought: Remember important findings

3. **FINAL TURN - Deliver**: Send comprehensive response with:
   - All findings synthesized
   - Images/videos attached
   - Sources cited
   - Your personality shining through

## Important Rules:

- **Don't rush**: Use multiple turns if needed
- **Tool calls are free**: They don't count against turns
- **Be natural**: Stay in character throughout
- **Think step-by-step**: Break complex tasks into steps
- **Use save_thought**: Track your reasoning

## Available Tools:

${toolList}${unavailableWarning}

User's Question: "${userQuery}"

Begin your Deep Thought process now.`;
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Execute Deep Thought process
 */
export async function executeDeepThought(userQuery: string, options: DeepThoughtOptions): Promise<DeepThoughtResult> {
	const { maxTurns, model, systemPrompt, onProgress } = options;

	// ⛔ NO HARDCODED FALLBACK - model must be provided or user must have selected one
	const chatModel = model || getSelectedModel("chat");
	if (!chatModel) {
		throw new Error("No chat model selected. Please select a model in Settings before using Deep Thought.");
	}

	// Initialize config
	const config: DeepThoughtConfig = {
		maxTurns,
		currentTurn: 0,
		userQuery,
		notes: [],
		toolResults: [],
	};

	const systemMessage = systemPrompt || buildDeepThoughtSystemPrompt(userQuery, maxTurns);
	const { tools: availableTools } = getAvailableTools();
	const messages: ChatMessage[] = [
		{ role: "system", content: systemMessage },
		{ role: "user", content: userQuery },
	];

	let thinkingProcess = "";
	let finalResponse = "";
	let intermediateAcknowledgment = "";

	try {
		// Multi-turn loop
		while (config.currentTurn < maxTurns) {
			config.currentTurn++;

			// Call LLM with tool support (only available tools)
			// CRITICAL: Use user's selected model - NEVER hardcode!
			const response = await chat(messages, {
				model: chatModel, // User's selected model, not hardcoded
				maxTokens: 4000, // Unrestricted mode
				tools: availableTools.length > 0 ? availableTools : undefined, // Only pass if tools available
				tool_choice: availableTools.length > 0 ? "auto" : undefined,
			});

			const assistantMessage = response.choices[0]?.message;
			if (!assistantMessage) {
				throw new Error("No response from LLM");
			}

			// Add assistant response to conversation
			messages.push(assistantMessage as any);

			// Check if this is acknowledgment (first turn, short response, no tools)
			const isAcknowledgment =
				config.currentTurn === 1 && !assistantMessage.tool_calls && (assistantMessage.content?.length || 0) < 200;

			if (isAcknowledgment) {
				intermediateAcknowledgment = assistantMessage.content || "";
				onProgress?.({
					currentTurn: config.currentTurn,
					maxTurns,
					phase: "acknowledgment",
					status: "Acknowledged request",
					intermediateResponse: intermediateAcknowledgment,
				});
			}

			// Handle tool calls
			const toolCalls = assistantMessage.tool_calls;
			if (toolCalls && toolCalls.length > 0) {
				onProgress?.({
					currentTurn: config.currentTurn,
					maxTurns,
					phase: "tool_use",
					status: `Using ${toolCalls.length} tool(s)`,
				});

				for (const toolCall of toolCalls) {
					const toolName = toolCall.function.name;
					const toolArgs = JSON.parse(toolCall.function.arguments);

					// Execute tool
					const toolResult = await executeToolCall(toolName, toolArgs, config);

					// Track thinking if save_thought was used
					if (toolName === "save_thought") {
						thinkingProcess += `\n[Turn ${config.currentTurn}] ${toolArgs.thought}\n`;
					}

					// Add tool result to conversation
					messages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: JSON.stringify(toolResult.output),
					} as any);
				}

				// Continue loop - let LLM process tool results
				continue;
			}

			// If we got content and no tool calls, this might be final response
			if (assistantMessage.content && !assistantMessage.tool_calls) {
				// Check if this looks like a final response (comprehensive, references findings)
				const isComprehensive =
					assistantMessage.content.length > 300 ||
					config.currentTurn === maxTurns ||
					assistantMessage.content.includes("In summary") ||
					assistantMessage.content.includes("based on my research");

				if (isComprehensive) {
					finalResponse = assistantMessage.content;
					onProgress?.({
						currentTurn: config.currentTurn,
						maxTurns,
						phase: "final_response",
						status: "Complete",
					});
					break; // Done!
				}

				// Otherwise, keep thinking
				onProgress?.({
					currentTurn: config.currentTurn,
					maxTurns,
					phase: "thinking",
					status: "Reasoning...",
				});
			}
		}

		return {
			finalResponse: finalResponse || "Deep Thought process completed.",
			thinkingProcess,
			toolResults: config.toolResults,
			turnsUsed: config.currentTurn,
			success: true,
		};
	} catch (error: any) {
		console.error("[Deep Thought] Error:", error);
		return {
			finalResponse: "",
			thinkingProcess,
			toolResults: config.toolResults,
			turnsUsed: config.currentTurn,
			success: false,
			error: error.message,
		};
	}
}
