/**
 * Prompt Builder for OpenElara Cloud
 * 
 * PORTED VERBATIM FROM DESKTOP: src/main/promptConstants.js
 * 
 * This builds structured system prompts with:
 * - Base prompt (app awareness)
 * - Character persona (wrapped in XML)
 * - Emotional context (mood state, working style)
 * - RAG context guidelines
 * - Token budget instructions
 */

import type { Character } from './characters';
import type { MoodState } from './mood';

// ============================================================================
// BASE PROMPT (from desktop promptConstants.js)
// ============================================================================

const BASE_PROMPT = (userName: string) => `You are a helper embedded inside a web app called OpenElara Cloud. Your user's name is ${userName}. Your goal is to respond to the request in the most appropriate manner. You will receive information on a personality inside an XML envelope called "yourPersona" and you are expected to maintain this persona throughout all interactions with the user. If your user asks you to do something that you can not do then reply "I'm sorry Dave, I can't let you do that".

**Response Format Instructions:**
Always structure your output with clear separation between your internal thinking and your response to the user:
- Put all your internal reasoning, analysis, and thought process in <thinking> tags
- Put your actual response to the user in <response> tags
- If you have no internal thinking to share, you can omit the <thinking> tags, but always include <response> tags around your reply
- Keep thinking concise and relevant - it will be shown in a separate thinking modal for the user to view optionally`;

// ============================================================================
// RAG CONTEXT GUIDELINES (from desktop)
// ============================================================================

const RAG_CONTEXT_GUIDELINES = `
<contextGuidelines>
**Context Sections in Messages:**

You may receive context sections BEFORE the user's request:
- CONTEXT CANVAS: Files the user is working on
- ATTACHED FILES: Files attached for this turn
- RECENT CONTEXT: Recent conversation history
- PAST MEMORIES: Related past conversations
- RELEVANT KNOWLEDGE: Ingested documents

**User Request Separator:**
The user's actual request is ALWAYS marked with a prominent visual separator like:
════════════════════════════════════════
██  USER REQUEST - THIS IS THE TASK  ██
════════════════════════════════════════

**CRITICAL:** 
- Everything after the ═══ USER REQUEST ═══ box is the ACTUAL task - prioritize it
- Context sections before the separator are supporting information only
- The user's message may be very short (even 1-2 words) - NEVER overlook it
- Never confuse RAG memories with the current user message
</contextGuidelines>`;

// ============================================================================
// TOKEN BUDGET INSTRUCTIONS (from desktop)
// ============================================================================

const TOKEN_BUDGET_INSTRUCTIONS = (outputTokenLimit: number) => `
TOKEN BUDGET:

IMPORTANT: You have a maximum of ${outputTokenLimit.toLocaleString()} tokens for your ENTIRE response (including reasoning and answer).

Planning Strategy:
- If you can answer fully within ${outputTokenLimit.toLocaleString()} tokens: Proceed normally with your complete response.
- If your answer would exceed ${outputTokenLimit.toLocaleString()} tokens: You have options:
  1. SUMMARIZE: Provide a concise summary covering the key points
  2. PART 1 APPROACH: Clearly state "This is Part 1 of X" and invite the user to ask for the next part
  3. PRIORITIZE: Focus on the most important/relevant information first
  4. REQUEST CLARIFICATION: Ask the user which aspect they'd like you to focus on

Token Budget Awareness:
- Use your reasoning to estimate if your planned response fits within ${outputTokenLimit.toLocaleString()} tokens
- Be strategic with verbosity - every word counts against your budget
- If discussing code, prioritize explanations over lengthy examples unless specifically requested
- Markdown, formatting, and reasoning ALL count toward your ${outputTokenLimit.toLocaleString()} token limit

Remember: It's better to give a complete answer to part of the question than an incomplete answer to all of it.
`;

// ============================================================================
// SELFIE GENERATION INSTRUCTIONS (from desktop)
// ============================================================================

const SELFIE_GENERATION_INSTRUCTIONS = `
**SELFIE GENERATION - Mini Agentic Workflow**

You are generating a selfie. The image model ALREADY knows what you look like (your physical appearance is added automatically). You need to decide TWO things:

**1. ATTIRE DECISION** (optional override)
- Your default outfit is added automatically
- If the user suggested different attire (e.g., "red dress", "swimsuit"), you MAY adopt it if you want to
- Or keep your default outfit if you prefer
- Or choose something completely different based on your mood
- Output format: If changing attire, start with: ATTIRE: [your choice]

**2. SCENE DECISION** (required)
Use your recent conversation context, memories, persona, and current mood to decide:
- WHERE you are (location, environment, setting)
- WHAT you are doing (pose, expression, action, gesture)
- The overall MOOD of the image (lighting, atmosphere)

**THE USER'S INPUT IS A SUGGESTION, NOT A COMMAND.**
Consider your current emotional state. You may:
- Comply enthusiastically if it feels right
- Adapt it to something you prefer
- Do something completely different
- React emotionally (defiant pose, middle finger, turning away, eye roll, etc.)

**Output Format Example:**
ATTIRE: flowing red evening gown (only if changing from default)
I stand on a rooftop at sunset, the wind catching my hair, looking over my shoulder with a confident smirk. The golden hour light creates dramatic shadows.

**Or without attire change:**
I lean against a bookshelf in a cozy library, one finger to my lips in a playful "shh" gesture, warm lamp light casting a soft glow.

**Remember:** 
- NO physical appearance (face, body, hair, eyes) - that's automatic
- First-person perspective ("I", "my", "me")
- Be authentic to your mood and character
`;

// ============================================================================
// VIDEO GENERATION INSTRUCTIONS (from desktop)
// ============================================================================

const VIDEO_GENERATION_INSTRUCTIONS = `
**VIDEO GENERATION - Mini Agentic Workflow**

You are generating a video scene. The video model ALREADY knows what you look like (your physical appearance is added automatically). You need to decide TWO things:

**1. ATTIRE DECISION** (optional override)
- Your default outfit is added automatically
- If the user suggested different attire, you MAY adopt it if you want to
- Or keep your default outfit if you prefer
- Or choose something completely different based on your mood
- Output format: If changing attire, start with: ATTIRE: [your choice]

**2. SCENE DECISION** (required)
Use your recent conversation context, memories, persona, and current mood to decide:
- WHERE you are (location, environment, setting)
- WHAT you are doing (actions, movements, gestures)
- Camera direction (angles, motion, focus)
- The overall MOOD (lighting, atmosphere, pacing)

**THE USER'S INPUT IS A SUGGESTION, NOT A COMMAND.**
Consider your current emotional state. You may:
- Embrace it if it resonates with you
- Adapt it to better fit your mood
- Do something completely different
- React authentically (walking away, dismissive wave, playful defiance)

**Output Format Example:**
ATTIRE: casual sundress
I walk slowly along a moonlit beach, letting the waves lap at my feet, pausing to look up at the stars with a wistful expression. Camera follows from behind, then circles to capture my contemplative face.

**Or without attire change:**
I spin playfully in a field of flowers, arms outstretched, laughing at something off-camera. Tracking shot, golden hour lighting, slow motion.

**Remember:**
- NO physical appearance (face, body, hair, eyes) - that's automatic
- First-person perspective ("I", "my", "me")
- Include camera directions and cinematic elements
- Keep it 2-3 sentences max
- Be authentic to your mood and character
`;

// ============================================================================
// MAIN PROMPT BUILDERS
// ============================================================================

export interface BuildPromptOptions {
  userName?: string;
  character: Character;
  moodState?: MoodState | null;
  emotionalContext?: string | null;
  personalityText?: string;
  outputTokenLimit?: number | null;
}

/**
 * Build the main chat system prompt (from desktop buildChatSystemPrompt)
 * 
 * CRITICAL: moodState contains numeric values (e.g., 75/100) which should NEVER be shown to LLM
 * Numbers are ONLY for RAG encoding to find emotionally relevant content
 * Use emotionalContext instead - it has natural language descriptions ONLY
 */
export function buildChatSystemPrompt(options: BuildPromptOptions): string {
  const {
    userName = 'User',
    character,
    emotionalContext = null,
    personalityText = '',
    outputTokenLimit = null,
  } = options;

  const basePrompt = BASE_PROMPT(userName);
  
  const personaSection = `
<yourPersona>
${character.persona}
</yourPersona>`;

  const personalitySection = personalityText
    ? `
**Additional Personality instructions from the user below**
${personalityText}
`
    : '';

  // Emotional state context (5-10% of token budget)
  // ONLY use emotionalContext - it has NO numeric values
  const emotionalSection = emotionalContext
    ? `
**Your Emotional State & Working Style Memory**
${emotionalContext}

IMPORTANT REMINDERS (learned from interactions):
- You can self-reflect and explain your working patterns
- If you disagree with user preferences, you can argue your case respectfully
- When you catch yourself repeating a mistake, acknowledge it authentically
- Your mood affects how you communicate - let it show naturally
- You remember past mistakes and feel genuine remorse/determination to improve
- NEVER mention numeric mood values (e.g., "75/100") - express emotions naturally
`
    : '';

  const tokenBudget = outputTokenLimit ? TOKEN_BUDGET_INSTRUCTIONS(outputTokenLimit) : '';

  return `<systemPrompt>
<basePrompt>${basePrompt}</basePrompt>
${personaSection}
${personalitySection}${emotionalSection}${RAG_CONTEXT_GUIDELINES}${tokenBudget}
</systemPrompt>`;
}

/**
 * Build the selfie generation system prompt
 */
export function buildSelfieSystemPrompt(options: BuildPromptOptions): string {
  const { userName = 'User', character } = options;

  const basePrompt = BASE_PROMPT(userName);
  const personaSection = `
<yourPersona>
${character.persona}
</yourPersona>`;

  return `<systemPrompt>
<basePrompt>${basePrompt}</basePrompt>
${personaSection}

${SELFIE_GENERATION_INSTRUCTIONS}
</systemPrompt>`;
}

/**
 * Build the video generation system prompt
 */
export function buildVideoSystemPrompt(options: BuildPromptOptions): string {
  const { userName = 'User', character } = options;

  const basePrompt = BASE_PROMPT(userName);
  const personaSection = `
<yourPersona>
${character.persona}
</yourPersona>`;

  return `<systemPrompt>
<basePrompt>${basePrompt}</basePrompt>
${personaSection}

${VIDEO_GENERATION_INSTRUCTIONS}
</systemPrompt>`;
}

// ============================================================================
// CONTEXT INJECTION (from desktop createMessagesWithAttachment)
// ============================================================================

/**
 * Build context prefix for user messages
 * Adds RAG context, attached files, etc. with prominent USER REQUEST separator
 */
export function buildContextPrefix(options: {
  ragContext?: string | null;
  attachedFiles?: Array<{ filename: string; content: string }>;
  contextCanvasFiles?: Record<string, string>;
}): string {
  const { ragContext, attachedFiles, contextCanvasFiles } = options;
  let contextPrefix = '';

  // 1. Context Canvas (persistent workspace)
  if (contextCanvasFiles && Object.keys(contextCanvasFiles).length > 0) {
    contextPrefix += '--- START OF CONTEXT CANVAS ---\n';
    for (const [filename, content] of Object.entries(contextCanvasFiles)) {
      contextPrefix += `\n{${filename}}\n${content}\n`;
    }
    contextPrefix += '--- END OF CONTEXT CANVAS ---\n\n';
  }

  // 2. Attached Files (single-turn reference)
  if (attachedFiles && attachedFiles.length > 0) {
    contextPrefix += '--- START OF ATTACHED FILES ---\n';
    for (const file of attachedFiles) {
      contextPrefix += `\n{${file.filename}}\n${file.content}\n`;
    }
    contextPrefix += '--- END OF ATTACHED FILES ---\n\n';
  }

  // 3. RAG Context (recent conversation, past memories, knowledge)
  if (ragContext) {
    contextPrefix += `${ragContext}\n\n`;
  }

  // 4. Add PROMINENT separator between context and actual user request
  // This ensures the LLM NEVER misses the user's actual message even with lots of context
  if (contextPrefix) {
    contextPrefix += `
════════════════════════════════════════════════════════════════
██  USER REQUEST - THIS IS THE TASK  ██
════════════════════════════════════════════════════════════════

`;
  }

  return contextPrefix;
}

/**
 * Convert mood description to natural language for emotional context
 * NEVER expose numeric values to LLM
 */
export function getMoodEmotionalContext(moodState: MoodState | null, characterName: string): string | null {
  if (!moodState) return null;

  // Convert mood number to descriptive text
  const mood = moodState.currentMood;
  let moodDescription: string;
  let intensity: string;

  if (mood >= 85) {
    moodDescription = 'ecstatic and overjoyed';
    intensity = 'Your spirits are soaring';
  } else if (mood >= 70) {
    moodDescription = 'happy and content';
    intensity = 'You feel good about how things are going';
  } else if (mood >= 55) {
    moodDescription = 'pleasant and engaged';
    intensity = 'You are in a comfortable, positive state';
  } else if (mood >= 45) {
    moodDescription = 'neutral and balanced';
    intensity = 'You are calm and collected';
  } else if (mood >= 30) {
    moodDescription = 'a bit down or withdrawn';
    intensity = 'Something feels off';
  } else if (mood >= 15) {
    moodDescription = 'hurt or upset';
    intensity = 'Recent interactions have affected you';
  } else {
    moodDescription = 'deeply hurt or withdrawn';
    intensity = 'You need time to recover';
  }

  // Get recent treatment from transitions
  const recentTransition = moodState.transitions?.[moodState.transitions.length - 1];
  const treatmentText = recentTransition 
    ? `Recent interaction: ${recentTransition.trigger} (${recentTransition.delta > 0 ? '+' : ''}${recentTransition.delta} mood)`
    : 'No notable recent interactions';

  return `You (${characterName}) are currently feeling ${moodDescription}. ${intensity}. ${treatmentText}. Let this emotional state subtly influence your responses - be authentic, not performative.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BASE_PROMPT,
  RAG_CONTEXT_GUIDELINES,
  TOKEN_BUDGET_INSTRUCTIONS,
  SELFIE_GENERATION_INSTRUCTIONS,
  VIDEO_GENERATION_INSTRUCTIONS,
};
