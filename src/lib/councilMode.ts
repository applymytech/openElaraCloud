/**
 * Council Mode - "Council of Wisdom" (Consultant Workflow)
 *
 * PORTED FROM DESKTOP: src/handlers/appHandlers.js
 *
 * A sophisticated multi-persona consultation system:
 *
 * PHASE 1: The Council (Parallel Execution)
 *   - Query all personas simultaneously with token-limited outputs
 *   - Each persona provides unique perspective based on their specialty
 *
 * PHASE 2: The Synthesis (Dominant Call)
 *   - Active persona becomes Lead Consultant
 *   - Receives all perspectives and synthesizes into decisive response
 *
 * PHASE 3: Token Handling (The Bypass)
 *   - Council opinions treated as Priority 1 input (never truncated)
 *   - Lead Consultant gets full token access for synthesis
 */

import { type ChatMessage, chat } from "./api";
import { AELIRA, AERON, ANDROS, ARCHITECT, type Character, ELARA, getActiveCharacter } from "./characters";
import { buildChatSystemPrompt } from "./promptBuilder";

// ============================================================================
// TYPES
// ============================================================================

export interface CouncilPerspective {
	persona: string; // Character ID (e.g., 'elara')
	characterName: string; // Display name (e.g., 'Elara')
	success: boolean;
	answer: string;
	thinking?: string;
}

export interface CouncilResult {
	success: boolean;
	synthesis: string;
	perspectives: CouncilPerspective[];
	leadConsultant: string;
	thinking?: string;
	error?: string;
}

export interface CouncilOptions {
	userQuestion: string;
	conversationHistory?: ChatMessage[];
	onProgress?: (status: string) => void;
}

// ============================================================================
// COUNCIL CONFIGURATION
// ============================================================================

/**
 * SOFT TOKEN LIMITS - Tell LLM about budget in system prompt
 *
 * This is NOT a hard API max_tokens limit (which causes truncation).
 * This is guidance IN THE PROMPT so the LLM can plan its response.
 *
 * The LLM sees: "You have ~1024 tokens for your response"
 * The API sees: NO max_tokens parameter (unrestricted)
 *
 * 🔒 GOD RULE (from desktop): Council final turn gets FULL TOKEN ACCESS
 * The synthesis is the most important response - don't limit the Lead Consultant
 */
const COUNCIL_PERSPECTIVE_SOFT_LIMIT = 1024; // Each persona's perspective
// Synthesis has NO soft limit - Lead Consultant gets full access (desktop parity)

/**
 * Council Personas - All 5 characters participate
 *
 * ALIGNMENT NOTE: No hardcoded role/focus labels.
 * Each character's persona definition (in characters.ts) already defines
 * their unique perspective. Let them speak naturally.
 */
const COUNCIL_PERSONAS: Array<{
	id: string;
	character: Character;
}> = [
	{ id: "elara", character: ELARA },
	{ id: "aelira", character: AELIRA },
	{ id: "aeron", character: AERON },
	{ id: "andros", character: ANDROS },
	{ id: "architect", character: ARCHITECT },
];

// ============================================================================
// COUNCIL EXECUTION
// ============================================================================

/**
 * Execute Council Mode: The Consultant Workflow
 *
 * All personas are queried in parallel, then the active persona
 * synthesizes their responses into a single authoritative answer.
 */
export async function executeCouncilMode(options: CouncilOptions): Promise<CouncilResult> {
	const { userQuestion, conversationHistory = [], onProgress } = options;

	// Get the active character (Lead Consultant for synthesis)
	const activeCharacter = getActiveCharacter();
	const _activePersonaId = activeCharacter.id || "elara";
	const activePersonaName = activeCharacter.name || "Elara";

	onProgress?.("👥 **Council of Wisdom convening...**\n\n⏳ Assembling the team for consultation...");

	try {
		// ========================================================================
		// PHASE 1: THE COUNCIL (Parallel Execution)
		// ========================================================================
		onProgress?.(
			"👥 **Phase 1: Council in Session**\n\n⏳ Gathering perspectives from all team members...\n\n*Each consultant is analyzing with their unique expertise...*",
		);

		const perspectivePromises = COUNCIL_PERSONAS.map(async (persona) => {
			// Each persona uses their own system prompt personality - no imposed roles
			const focusedPrompt = `Provide your perspective on this question:

"${userQuestion}"

Be concise and focused. Offer your unique insights.`;

			// Build system prompt with SOFT token limit
			// This tells the LLM about their budget IN THE PROMPT (not as API max_tokens)
			// The LLM can plan accordingly; no hard truncation occurs
			const systemPrompt = buildChatSystemPrompt({
				userName: "User",
				character: persona.character,
				outputTokenLimit: COUNCIL_PERSPECTIVE_SOFT_LIMIT, // Soft limit via prompt instruction
			});

			try {
				const response = await chat(
					[
						{ role: "system", content: systemPrompt },
						{ role: "user", content: focusedPrompt },
					],
					{
						// NO max_tokens here - that would cause hard truncation
						// The soft limit in the system prompt is sufficient guidance
					},
				);

				return {
					persona: persona.id,
					characterName: persona.character.name,
					success: true,
					answer: response.choices[0]?.message?.content || "No response",
					thinking: response.choices[0]?.message?.thinking,
				};
			} catch (error: any) {
				return {
					persona: persona.id,
					characterName: persona.character.name,
					success: false,
					answer: `Error consulting ${persona.character.name}: ${error.message}`,
				};
			}
		});

		const perspectives = await Promise.all(perspectivePromises);
		const successfulPerspectives = perspectives.filter((p) => p.success);

		if (successfulPerspectives.length === 0) {
			throw new Error("All council members failed to respond");
		}

		// ========================================================================
		// PHASE 2: THE SYNTHESIS (Lead Consultant - Active Persona)
		// ========================================================================
		onProgress?.(
			`👥 **Phase 2: Synthesis in Progress**\n\n🎯 ${activePersonaName} is now leading the synthesis...\n\n*Reviewing ${successfulPerspectives.length} perspectives...*`,
		);

		// Build the council perspectives text (PRIORITY 1 - never truncated)
		const perspectivesText = perspectives
			.map((p) => {
				const statusIcon = p.success ? "✅" : "⚠️";
				const header = `### ${statusIcon} ${p.characterName}`;
				return `${header}\n\n${p.answer}`;
			})
			.join("\n\n---\n\n");

		// The Lead Consultant synthesis prompt
		const synthesisPrompt = `You are the **Lead Consultant** synthesizing advice from your team.

**The User's Original Question:**
"${userQuestion}"

---

**Your Team's Perspectives:**

${perspectivesText}

---

**Your Task as Lead Consultant:**

1. **Review** all perspectives carefully - each team member has unique expertise
2. **Identify** the key insights, agreements, and any conflicting viewpoints  
3. **Synthesize** the best elements into a single, decisive recommendation
4. **Acknowledge** which perspectives you're prioritizing and why
5. You may **accept or reject** individual advice, but you must **consider all of it**

Provide your synthesized response now. Be comprehensive but clear.`;

		// 🔒 GOD RULE (from desktop): Lead Consultant gets FULL TOKEN ACCESS
		// No soft limit for synthesis - this is the most important response
		const synthesisSystemPrompt = buildChatSystemPrompt({
			userName: "User",
			character: activeCharacter,
			// No outputTokenLimit - Lead Consultant can write as much as needed
		});

		const synthesisResponse = await chat(
			[
				{ role: "system", content: synthesisSystemPrompt },
				{ role: "user", content: synthesisPrompt },
			],
			{
				// NO max_tokens - Lead Consultant has full access
				// Hard max_tokens would cause truncation of important synthesis
			},
		);

		const synthesis = synthesisResponse.choices[0]?.message?.content || "The council could not reach a consensus.";
		const synthesisThinking = synthesisResponse.choices[0]?.message?.thinking;

		return {
			success: true,
			synthesis,
			perspectives,
			leadConsultant: activePersonaName,
			thinking: synthesisThinking,
		};
	} catch (error: any) {
		return {
			success: false,
			synthesis: "",
			perspectives: [],
			leadConsultant: activePersonaName,
			error: error.message,
		};
	}
}

/**
 * Format council result for display
 */
export function formatCouncilResult(result: CouncilResult): string {
	if (!result.success) {
		return `**Council Error:**\n\nThe Council of Wisdom encountered an error: ${result.error}\n\n*Tip: Ensure you have a valid API key configured and the model is accessible.*`;
	}

	const perspectivesHtml = result.perspectives
		.map((p) => {
			const icon = p.success ? "✅" : "⚠️";
			return `**${icon} ${p.characterName}**\n\n${p.answer}`;
		})
		.join("\n\n---\n\n");

	return `<details>
<summary>📜 View Individual Council Perspectives (${result.perspectives.filter((p) => p.success).length}/${result.perspectives.length} responded)</summary>

${perspectivesHtml}

</details>

---

**👑 Lead Consultant Synthesis (by ${result.leadConsultant}):**

${result.synthesis}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function _capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
