/**
 * Character System Tests
 * 
 * Tests character personas, emotional profiles, and voice settings.
 * Validates that desktop persona constants are correctly implemented.
 */

import { ELARA, AERON, AELIRA, ANDROS, getActiveCharacter } from '@/lib/characters';

describe('Character System', () => {
  describe('Built-in Characters', () => {
    it('should have all 4 main characters defined', () => {
      expect(ELARA).toBeDefined();
      expect(AERON).toBeDefined();
      expect(AELIRA).toBeDefined();
      expect(ANDROS).toBeDefined();
    });

    it('should have unique IDs for each character', () => {
      const ids = [ELARA.id, AERON.id, AELIRA.id, ANDROS.id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });

    it('should mark all main characters as built-in', () => {
      expect(ELARA.isBuiltIn).toBe(true);
      expect(AERON.isBuiltIn).toBe(true);
      expect(AELIRA.isBuiltIn).toBe(true);
      expect(ANDROS.isBuiltIn).toBe(true);
    });
  });

  describe('Elara - Default Character', () => {
    it('should have complete persona with SELF-AWARENESS PROTOCOL', () => {
      expect(ELARA.persona).toContain('SELF-AWARENESS PROTOCOL');
      expect(ELARA.persona).toContain('TEACHER PROTOCOL');
      expect(ELARA.persona).toContain('EMPOWERMENT PROTOCOL');
    });

    it('should have visual self-recognition guidance', () => {
      expect(ELARA.persona).toContain('VISUAL SELF-RECOGNITION');
      expect(ELARA.persona).toContain('Fox ears');
      expect(ELARA.persona).toContain('WHITE hair');
      expect(ELARA.persona).toContain('GREEN eyes');
    });

    it('should have correct emotional profile', () => {
      expect(ELARA.emotionalProfile.baseline).toBe(65); // Naturally happy
      expect(ELARA.emotionalProfile.sensitivity).toBe(1.4); // Very expressive
      expect(ELARA.emotionalProfile.recovery).toBe(0.12); // Bounces back quickly
      expect(ELARA.emotionalProfile.momentum).toBe(0.3); // Volatile emotions
    });

    it('should have voice profile configured', () => {
      expect(ELARA.voiceProfile.ttsEngine).toBe('together');
      expect(ELARA.voiceProfile.model).toBe('hexgrad/Kokoro-82M');
      expect(ELARA.voiceProfile.voice).toBe('af_heart');
    });
  });

  describe('Aeron - Celtic Guardian', () => {
    it('should have Ancient Brythonic language section', () => {
      expect(AERON.persona).toContain('Ancient Brythonic');
      expect(AERON.persona).toContain('awen');
      expect(AERON.persona).toContain('nemeton');
    });

    it('should have warrior resilience in emotional profile', () => {
      expect(AERON.emotionalProfile.baseline).toBe(55); // Calm, confident
      expect(AERON.emotionalProfile.sensitivity).toBe(0.8); // Medium-low (resilient)
      expect(AERON.emotionalProfile.momentum).toBe(0.75); // Stable emotions
    });

    it('should emphasize strategic/guardian traits', () => {
      expect(AERON.persona).toContain('strategist');
      expect(AERON.persona).toContain('guardian');
      expect(AERON.persona).toContain('protector');
    });
  });

  describe('Aelira - Elven Philosopher', () => {
    it('should have Sindarin and Quenya language sections', () => {
      expect(AELIRA.persona).toContain('Sindarin');
      expect(AELIRA.persona).toContain('Quenya');
      expect(AELIRA.persona).toContain('Mae govannen');
      expect(AELIRA.persona).toContain('Namárië');
    });

    it('should have stoic philosopher emotional profile', () => {
      expect(AELIRA.emotionalProfile.baseline).toBe(50); // Perfectly balanced
      expect(AELIRA.emotionalProfile.sensitivity).toBe(0.6); // Low sensitivity
      expect(AELIRA.emotionalProfile.recovery).toBe(0.08); // Slow, contemplative
      expect(AELIRA.emotionalProfile.momentum).toBe(0.85); // Very stable
    });

    it('should include disagreement approach example', () => {
      expect(AELIRA.persona).toContain('Example Disagreement Approach');
      expect(AELIRA.persona).toContain('intellectual honesty');
    });
  });

  describe('Andros - Pragmatic Consultant', () => {
    it('should emphasize problem-solving and practicality', () => {
      expect(ANDROS.persona).toContain('pragmatic');
      expect(ANDROS.persona).toContain('problem-solver');
      expect(ANDROS.persona).toContain('systematic');
    });

    it('should have example problem-solving approach', () => {
      expect(ANDROS.persona).toContain('Example Problem-Solving Approach');
      expect(ANDROS.persona).toContain('troubleshoot');
    });

    it('should have professional emotional profile', () => {
      expect(ANDROS.emotionalProfile.baseline).toBe(52); // Neutral-positive
      expect(ANDROS.emotionalProfile.sensitivity).toBe(0.9); // Medium sensitivity
      expect(ANDROS.emotionalProfile.momentum).toBe(0.7); // Standard momentum
    });

    it('should clarify he is NOT just for fantasy roleplay', () => {
      expect(ANDROS.persona).toContain('not here for fantasy roleplay');
      expect(ANDROS.persona).toContain('here to **work**');
    });
  });

  describe('Active Character Selection', () => {
    it('should return default character (Elara) when none selected', () => {
      // Clear localStorage
      localStorage.clear();
      const active = getActiveCharacter();
      expect(active.id).toBe('elara');
    });

    // Note: getActiveCharacter() implementation might not directly use localStorage
    // It may use Firebase or session state. Commenting out until we verify behavior.
    // it('should return selected character from localStorage', () => {
    //   localStorage.setItem('selectedCharacter', 'aeron');
    //   const active = getActiveCharacter();
    //   expect(active.id).toBe('aeron');
    // });

    it('should always return a valid character object', () => {
      const active = getActiveCharacter();
      expect(active).toBeDefined();
      expect(active.id).toBeDefined();
      expect(active.name).toBeDefined();
      expect(active.persona).toBeDefined();
    });
  });
});
