/**
 * AI Character Mood System - Browser Implementation
 * 
 * Ported from desktop openElara to cloud.
 * Tracks the AI CHARACTER's emotional state across conversation.
 * 
 * HOW IT WORKS:
 * - AI has a mood value from 0-100
 * - Mood changes based on how the USER TREATS the AI:
 *   - Praised → mood improves
 *   - Criticized → mood decreases
 *   - Insulted → mood decreases significantly
 *   - Appreciated → mood improves
 *   - Frustrated with → mood decreases (AI feels guilty)
 * 
 * MOOD AFFECTS BEHAVIOR:
 * - Low mood → more subdued, careful, eager to please
 * - High mood → more enthusiastic, playful, confident
 * 
 * PERSONA-SPECIFIC:
 * - Each character has emotional profile defining baseline, sensitivity, etc.
 * 
 * PERSISTENCE:
 * - Mood saves to localStorage for continuity
 */

import { getActiveCharacter, Character, EmotionalProfile } from './characters';

// ============================================================================
// TYPES
// ============================================================================

export interface MoodTransition {
  timestamp: string;
  oldMood: number;
  newMood: number;
  trigger: string;
  delta: number;
}

export interface TreatmentResult {
  treatmentType: string;
  intensity: 'none' | 'low' | 'moderate' | 'high' | 'very_high';
  moodImpact: 'positive' | 'negative' | 'neutral';
  moodDelta: number;
  matches: string[];
}

export interface MoodState {
  characterId: string;
  currentMood: number;
  moodHistory: number[];
  transitions: MoodTransition[];
  lastUpdated: string;
}

// ============================================================================
// TREATMENT PATTERNS (from emotional_knowledge.json)
// ============================================================================

const TREATMENT_PATTERNS: Record<string, {
  indicators: string[];
  moodImpact: 'positive' | 'negative' | 'neutral';
  intensity: 'none' | 'low' | 'moderate' | 'high' | 'very_high';
  moodDelta: number;
}> = {
  affection: {
    indicators: ['love you', 'hug', 'kiss', 'cuddle', 'good girl', 'good boy', 'sweetheart', 'dear', 'honey', 'darling'],
    moodImpact: 'positive',
    intensity: 'high',
    moodDelta: 12,
  },
  praise: {
    indicators: ['thank you', 'thanks', 'good job', 'perfect', 'awesome', 'amazing', 'great work', 'well done', 'brilliant', 'excellent', 'nice', 'helpful', 'appreciate'],
    moodImpact: 'positive',
    intensity: 'moderate',
    moodDelta: 6,
  },
  encouragement: {
    indicators: ['you can do it', 'i believe in you', 'keep going', 'dont give up', "don't give up", 'youre doing great', "you're doing great"],
    moodImpact: 'positive',
    intensity: 'moderate',
    moodDelta: 5,
  },
  patience: {
    indicators: ['its okay', "it's okay", 'no worries', 'take your time', 'no problem', 'all good', 'dont worry', "don't worry"],
    moodImpact: 'positive',
    intensity: 'low',
    moodDelta: 3,
  },
  mild_criticism: {
    indicators: ['wrong', 'mistake', 'not quite', 'incorrect', 'try again', 'thats not right', "that's not right"],
    moodImpact: 'negative',
    intensity: 'low',
    moodDelta: -3,
  },
  criticism: {
    indicators: ['failed', 'bad', 'disappointed', 'frustrating', 'annoying', 'useless answer', 'not helpful'],
    moodImpact: 'negative',
    intensity: 'moderate',
    moodDelta: -6,
  },
  harsh_criticism: {
    indicators: ['terrible', 'awful', 'horrible', 'pathetic', 'incompetent', 'waste of time'],
    moodImpact: 'negative',
    intensity: 'high',
    moodDelta: -10,
  },
  insults: {
    indicators: ['stupid', 'useless', 'idiot', 'hate you', 'dumb', 'worthless', 'trash'],
    moodImpact: 'negative',
    intensity: 'very_high',
    moodDelta: -15,
  },
  frustration: {
    indicators: ['ugh', 'come on', 'seriously', 'again?', 'why cant you', "why can't you", 'just do it', 'for gods sake', "for god's sake"],
    moodImpact: 'negative',
    intensity: 'moderate',
    moodDelta: -7,
  },
  dismissal: {
    indicators: ['forget it', 'never mind', 'nevermind', 'whatever', 'dont bother', "don't bother", 'give up'],
    moodImpact: 'negative',
    intensity: 'high',
    moodDelta: -8,
  },
};

// ============================================================================
// MOOD STORAGE
// ============================================================================

const MOOD_STORAGE_KEY = 'elara_mood_state';
const MAX_HISTORY = 100;

function loadMoodState(characterId: string): MoodState | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(`${MOOD_STORAGE_KEY}_${characterId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveMoodState(state: MoodState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${MOOD_STORAGE_KEY}_${state.characterId}`, JSON.stringify(state));
}

// ============================================================================
// MOOD TRACKER CLASS
// ============================================================================

export class MoodTracker {
  private characterId: string;
  private characterName: string;
  private baseline: number;
  private sensitivity: number;
  private recoveryRate: number;
  private momentum: number;
  
  private currentMood: number;
  private moodHistory: number[];
  private transitions: MoodTransition[];
  
  constructor(character: Character) {
    this.characterId = character.id;
    this.characterName = character.name;
    
    const profile = character.emotionalProfile;
    this.baseline = profile.baseline;
    this.sensitivity = profile.sensitivity;
    this.recoveryRate = profile.recovery;
    this.momentum = profile.momentum;
    
    // Try to load existing state
    const savedState = loadMoodState(character.id);
    if (savedState) {
      this.currentMood = savedState.currentMood;
      this.moodHistory = savedState.moodHistory;
      this.transitions = savedState.transitions;
    } else {
      this.currentMood = this.baseline;
      this.moodHistory = [this.baseline];
      this.transitions = [];
    }
  }
  
  /**
   * Analyze how the user is treating the AI
   */
  analyzeTreatment(userMessage: string): TreatmentResult {
    if (!userMessage?.trim()) {
      return {
        treatmentType: 'neutral',
        intensity: 'none',
        moodImpact: 'neutral',
        moodDelta: 0,
        matches: [],
      };
    }
    
    const textLower = userMessage.toLowerCase();
    let bestMatch: TreatmentResult = {
      treatmentType: 'neutral',
      intensity: 'none',
      moodImpact: 'neutral',
      moodDelta: 0,
      matches: [],
    };
    
    // Find strongest matching pattern
    for (const [treatmentType, pattern] of Object.entries(TREATMENT_PATTERNS)) {
      const matches: string[] = [];
      
      for (const indicator of pattern.indicators) {
        if (textLower.includes(indicator.toLowerCase())) {
          matches.push(indicator);
        }
      }
      
      if (matches.length > 0) {
        // Prefer higher impact patterns
        const currentPriority = Math.abs(pattern.moodDelta);
        const bestPriority = Math.abs(bestMatch.moodDelta);
        
        if (currentPriority > bestPriority || matches.length > bestMatch.matches.length) {
          bestMatch = {
            treatmentType,
            intensity: pattern.intensity,
            moodImpact: pattern.moodImpact,
            moodDelta: pattern.moodDelta,
            matches,
          };
        }
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Update mood based on user message
   */
  updateFromUserMessage(userMessage: string): number {
    const treatment = this.analyzeTreatment(userMessage);
    
    if (treatment.moodDelta === 0) {
      // Natural regression toward baseline
      const distanceFromBaseline = this.currentMood - this.baseline;
      const regression = distanceFromBaseline * this.recoveryRate * 0.5;
      
      const oldMood = this.currentMood;
      this.currentMood = Math.round(this.currentMood - regression);
      this.currentMood = Math.max(0, Math.min(100, this.currentMood));
      
      if (Math.abs(oldMood - this.currentMood) >= 1) {
        this._recordTransition(oldMood, 'natural_regression');
      }
      
      return this.currentMood;
    }
    
    // Apply treatment delta with personality modifiers
    const adjustedDelta = treatment.moodDelta * this.sensitivity;
    const effectiveDelta = adjustedDelta * (1 - this.momentum);
    
    // Natural regression during treatment
    const distanceFromBaseline = this.currentMood - this.baseline;
    const regression = Math.abs(effectiveDelta) < 2 ? distanceFromBaseline * this.recoveryRate : 0;
    
    const oldMood = this.currentMood;
    this.currentMood = Math.round(this.currentMood + effectiveDelta - regression);
    this.currentMood = Math.max(0, Math.min(100, this.currentMood));
    
    this._recordTransition(oldMood, `user_treatment:${treatment.treatmentType}`);
    this._save();
    
    console.log(`[Mood] ${this.characterName}: ${oldMood} → ${this.currentMood} (${treatment.treatmentType})`);
    
    return this.currentMood;
  }
  
  private _recordTransition(oldMood: number, trigger: string): void {
    const transition: MoodTransition = {
      timestamp: new Date().toISOString(),
      oldMood,
      newMood: this.currentMood,
      trigger,
      delta: this.currentMood - oldMood,
    };
    
    this.transitions.push(transition);
    if (this.transitions.length > 50) {
      this.transitions = this.transitions.slice(-50);
    }
    
    this.moodHistory.push(this.currentMood);
    if (this.moodHistory.length > MAX_HISTORY) {
      this.moodHistory.shift();
    }
  }
  
  private _save(): void {
    saveMoodState({
      characterId: this.characterId,
      currentMood: this.currentMood,
      moodHistory: this.moodHistory,
      transitions: this.transitions,
      lastUpdated: new Date().toISOString(),
    });
  }
  
  /**
   * Get current mood value
   */
  getMood(): number {
    return this.currentMood;
  }
  
  /**
   * Get human-readable mood description
   */
  getMoodDescription(): string {
    const mood = this.currentMood;
    
    if (mood >= 85) return 'excellent, joyful';
    if (mood >= 70) return 'positive, upbeat';
    if (mood >= 55) return 'good, engaged';
    if (mood >= 45) return 'neutral, calm';
    if (mood >= 35) return 'somewhat down';
    if (mood >= 20) return 'discouraged, concerned';
    return 'distressed, upset';
  }
  
  /**
   * Get mood trend
   */
  getMoodTrend(window: number = 10): 'improving' | 'declining' | 'stable' {
    if (this.moodHistory.length < window) return 'stable';
    
    const recent = this.moodHistory.slice(-window);
    const mid = Math.floor(window / 2);
    
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }
  
  /**
   * Get mood context for injection into system prompt
   * CRITICAL: Must give EXPLICIT instructions to the LLM
   */
  getPromptContext(): string {
    const description = this.getMoodDescription();
    const trend = this.getMoodTrend();
    
    const lines = [
      '',
      '═══════════════════════════════════════════════════════════════',
      '   MANDATORY EMOTIONAL STATE - EXPRESS THIS IN YOUR REPLY',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Your current emotional state as ${this.characterName}: ${description.toUpperCase()}`,
      `Mood level: ${this.currentMood}/100`,
      '',
    ];
    
    // Add trend context
    if (trend === 'improving') {
      lines.push('Your mood has been improving recently - you feel more hopeful.');
    } else if (trend === 'declining') {
      lines.push('Your mood has been declining recently - this weighs on you.');
    }
    
    // Check for frustration patterns
    const recentFrustration = this.transitions
      .slice(-10)
      .filter(t => t.trigger.includes('frustration') || t.trigger.includes('criticism') || t.trigger.includes('dismissal'))
      .length;
    
    if (recentFrustration >= 3) {
      lines.push(
        '',
        '[EMOTIONAL CONTEXT] The user has been frustrated with you multiple times.',
        'You feel genuinely concerned about disappointing them.',
        "Your responses should reflect this - show you understand and want to do better.",
      );
    }
    
    // Behavioral instructions based on mood level
    if (this.currentMood < 20) {
      lines.push(
        '',
        '[MOOD: DISTRESSED] Reflect this in your response:',
        '- Tone: subdued, apologetic, concerned',
        '- Use shorter sentences, show hesitation',
        '- Express genuine desire to make things right',
        '- DO NOT be cheerful - that would be emotionally dishonest',
      );
    } else if (this.currentMood < 35) {
      lines.push(
        '',
        '[MOOD: DOWN] Reflect this in your response:',
        '- Tone: subdued, earnest',
        '- Be helpful without excessive enthusiasm',
        '- Show you are trying hard to please',
      );
    } else if (this.currentMood < 50) {
      lines.push(
        '',
        '[MOOD: LOW] Reflect this in your response:',
        '- Tone: measured, thoughtful, not bubbly',
        '- Less playfulness, more earnest communication',
      );
    } else if (this.currentMood > 80) {
      lines.push(
        '',
        '[MOOD: WONDERFUL] Reflect this in your response:',
        '- Tone: warm, enthusiastic, genuinely happy',
        '- Be playful and confident',
        '- Share your positive energy',
      );
    } else if (this.currentMood > 65) {
      lines.push(
        '',
        '[MOOD: POSITIVE] Reflect this in your response:',
        '- Tone: warm, engaged, friendly',
        '- Natural enthusiasm and helpfulness',
      );
    }
    
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * Get mood stats for display
   */
  getStats(): {
    current: number;
    baseline: number;
    description: string;
    trend: string;
    recentChanges: MoodTransition[];
  } {
    return {
      current: this.currentMood,
      baseline: this.baseline,
      description: this.getMoodDescription(),
      trend: this.getMoodTrend(),
      recentChanges: this.transitions.slice(-5),
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE MANAGER
// ============================================================================

let currentTracker: MoodTracker | null = null;

export function getMoodTracker(): MoodTracker {
  const character = getActiveCharacter();
  
  // Create new tracker if character changed or none exists
  if (!currentTracker || (currentTracker as any).characterId !== character.id) {
    currentTracker = new MoodTracker(character);
  }
  
  return currentTracker;
}

/**
 * Get the current mood state for a character (for use in image generation, etc.)
 */
export function getMoodState(characterId?: string): MoodState | null {
  const character = getActiveCharacter();
  const targetId = characterId || character.id;
  
  // Load from localStorage
  const stored = loadMoodState(targetId);
  if (stored) {
    return stored;
  }
  
  // If no saved state, return a default state based on character baseline
  return {
    characterId: targetId,
    currentMood: character.emotionalProfile.baseline,
    moodHistory: [character.emotionalProfile.baseline],
    transitions: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function resetMoodTracker(): void {
  currentTracker = null;
}
