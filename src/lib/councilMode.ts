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

import { chat, ChatMessage } from './api';
import { getActiveCharacter, ELARA, AERON, AELIRA, ANDROS, Character } from './characters';
import { buildChatSystemPrompt } from './promptBuilder';

// ============================================================================
// TYPES
// ============================================================================

export interface CouncilPerspective {
  persona: string;
  role: string;
  focus: string;
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

const COUNCIL_OUTPUT_LIMIT = 1024; // 1k token limit per persona for cost control

const COUNCIL_PERSONAS: Array<{
  id: string;
  character: Character;
  role: string;
  focus: string;
}> = [
  { id: 'elara', character: ELARA, role: 'Guide', focus: 'emotional intelligence and user empathy' },
  { id: 'aelira', character: AELIRA, role: 'Visionary', focus: 'creative possibilities and philosophical depth' },
  { id: 'aeron', character: AERON, role: 'Strategist', focus: 'tactical analysis and long-term planning' },
  { id: 'andros', character: ANDROS, role: 'Builder', focus: 'practical implementation and technical solutions' },
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
  const activePersonaId = activeCharacter.id || 'elara';
  const activePersonaName = activeCharacter.name || 'Elara';
  
  onProgress?.('👥 **Council of Wisdom convening...**\n\n⏳ Assembling the team for consultation...');
  
  try {
    // ========================================================================
    // PHASE 1: THE COUNCIL (Parallel Execution)
    // ========================================================================
    onProgress?.('👥 **Phase 1: Council in Session**\n\n⏳ Gathering perspectives from all team members...\n\n*Each consultant is analyzing with their unique expertise...*');
    
    const perspectivePromises = COUNCIL_PERSONAS.map(async (persona) => {
      // Each persona gets a focused prompt asking for their specific expertise
      const focusedPrompt = `As the team's ${persona.role}, focusing on ${persona.focus}, provide your perspective on this question:

"${userQuestion}"

Be concise and focused. Offer your unique insights based on your specialty.`;

      // Build system prompt for this persona
      // Token limit is SOFT - instruction in prompt, not hard max_tokens
      // This allows model to go slightly over if needed for coherent response
      const systemPrompt = buildChatSystemPrompt({
        userName: 'User',
        character: persona.character,
        outputTokenLimit: COUNCIL_OUTPUT_LIMIT, // Soft limit via prompt instruction
      });
      
      try {
        const response = await chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: focusedPrompt },
        ], {
          // No maxTokens - soft limit only via system prompt
          // Model is TOLD to keep it concise, not FORCED
        });
        
        return {
          persona: persona.id,
          role: persona.role,
          focus: persona.focus,
          success: true,
          answer: response.choices[0]?.message?.content || 'No response',
          thinking: response.choices[0]?.message?.thinking,
        };
      } catch (error: any) {
        return {
          persona: persona.id,
          role: persona.role,
          focus: persona.focus,
          success: false,
          answer: `Error consulting ${persona.role}: ${error.message}`,
        };
      }
    });
    
    const perspectives = await Promise.all(perspectivePromises);
    const successfulPerspectives = perspectives.filter(p => p.success);
    
    if (successfulPerspectives.length === 0) {
      throw new Error('All council members failed to respond');
    }
    
    // ========================================================================
    // PHASE 2: THE SYNTHESIS (Lead Consultant - Active Persona)
    // ========================================================================
    onProgress?.(`👥 **Phase 2: Synthesis in Progress**\n\n🎯 ${activePersonaName} is now leading the synthesis...\n\n*Reviewing ${successfulPerspectives.length} perspectives...*`);
    
    // Build the council perspectives text (PRIORITY 1 - never truncated)
    const perspectivesText = perspectives
      .map(p => {
        const statusIcon = p.success ? '✅' : '⚠️';
        const header = `### ${statusIcon} ${capitalize(p.persona)} (${p.role})`;
        const focusLine = `*Focus: ${p.focus}*`;
        return `${header}\n${focusLine}\n\n${p.answer}`;
      })
      .join('\n\n---\n\n');
    
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

    // Build system prompt for the Lead Consultant
    const synthesisSystemPrompt = buildChatSystemPrompt({
      userName: 'User',
      character: activeCharacter,
      // No output limit for synthesis - Lead Consultant gets full access
    });
    
    const synthesisResponse = await chat([
      { role: 'system', content: synthesisSystemPrompt },
      { role: 'user', content: synthesisPrompt },
    ], {
      // GOD RULE: Council final turn gets FULL TOKEN ACCESS
      maxTokens: 8192,
    });
    
    const synthesis = synthesisResponse.choices[0]?.message?.content || 'The council could not reach a consensus.';
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
      synthesis: '',
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
    .map(p => {
      const icon = p.success ? '✅' : '⚠️';
      return `**${icon} ${capitalize(p.persona)} (${p.role})**\n*Focus: ${p.focus}*\n\n${p.answer}`;
    })
    .join('\n\n---\n\n');
  
  return `<details>
<summary>📜 View Individual Council Perspectives (${result.perspectives.filter(p => p.success).length}/${result.perspectives.length} responded)</summary>

${perspectivesHtml}

</details>

---

**👑 Lead Consultant Synthesis (by ${result.leadConsultant}):**

${result.synthesis}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
