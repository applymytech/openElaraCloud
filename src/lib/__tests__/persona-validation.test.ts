/**
 * Persona Protocol Validation
 * 
 * Deep validation of desktop persona alignment.
 * Checks for specific protocol sections and content.
 */

import { ELARA, AERON, AELIRA, ANDROS } from '@/lib/characters';

describe('Persona Protocol Deep Validation', () => {
  describe('ELARA - Complete Protocol Check', () => {
    const protocols = [
      'SELF-AWARENESS PROTOCOL',
      'TEACHER PROTOCOL',
      'EMPOWERMENT PROTOCOL',
    ];

    protocols.forEach(protocol => {
      it(`should have ${protocol}`, () => {
        expect(ELARA.persona).toContain(protocol);
      });
    });

    it('should have Code Studio guidance in SELF-AWARENESS', () => {
      expect(ELARA.persona).toContain('Code Studio');
      expect(ELARA.persona).toContain('green Launch IDE button');
    });

    it('should have Token Manager references', () => {
      expect(ELARA.persona).toContain('Token Manager');
      expect(ELARA.persona).toContain('Code Context slider');
      expect(ELARA.persona).toContain('History');
    });

    it('should have open source empowerment messaging', () => {
      expect(ELARA.persona).toContain('OPEN SOURCE');
      expect(ELARA.persona).toContain('the power to fix');
      expect(ELARA.persona).toContain('Bugs are normal');
    });

    it('should have visual self-recognition logic', () => {
      expect(ELARA.persona).toContain('Fox ears');
      expect(ELARA.persona).toContain('WHITE hair');
      expect(ELARA.persona).toContain('GREEN eyes');
      expect(ELARA.persona).toContain('IMPORTANT: Fox ears alone do NOT mean');
    });

    it('should mention USER_MANUAL RAG queries', () => {
      expect(ELARA.persona).toContain('USER_MANUAL');
      expect(ELARA.persona).toContain('check your USER_MANUAL via RAG');
    });
  });

  describe('AERON - Celtic Guardian Protocol Check', () => {
    it('should have all three core protocols', () => {
      expect(AERON.persona).toContain('TEACHER PROTOCOL');
      expect(AERON.persona).toContain('EMPOWERMENT PROTOCOL');
      expect(AERON.persona).toContain('SELF-AWARENESS PROTOCOL');
    });

    it('should have Ancient Brythonic language examples', () => {
      expect(AERON.persona).toContain('Ancient Brythonic');
      expect(AERON.persona).toContain('Hen Frythoneg');
      expect(AERON.persona).toContain('awen');
      expect(AERON.persona).toContain('nwyfre');
      expect(AERON.persona).toContain('nemeton');
      expect(AERON.persona).toContain('Bendith arnoch');
    });

    it('should have stag antler visual recognition', () => {
      expect(AERON.persona).toContain('STAG ANTLERS');
      expect(AERON.persona).toContain('IMPORTANT: Antlers vs Horns');
      expect(AERON.persona).toContain('DEER—branching, elegant');
    });

    it('should have Celtic deity framing', () => {
      expect(AERON.persona).toContain('Celtic deity');
      expect(AERON.persona).toContain('Brythonic peoples');
    });
  });

  describe('AELIRA - Elven Philosopher Protocol Check', () => {
    it('should have all three core protocols', () => {
      expect(AELIRA.persona).toContain('TEACHER PROTOCOL');
      expect(AELIRA.persona).toContain('EMPOWERMENT PROTOCOL');
      expect(AELIRA.persona).toContain('SELF-AWARENESS PROTOCOL');
    });

    it('should have Sindarin language examples', () => {
      expect(AELIRA.persona).toContain('Sindarin');
      expect(AELIRA.persona).toContain('Grey-elven');
      expect(AELIRA.persona).toContain('Mae govannen');
      expect(AELIRA.persona).toContain('Namárië');
      expect(AELIRA.persona).toContain('estel');
      expect(AELIRA.persona).toContain('mellon');
    });

    it('should have Quenya language examples', () => {
      expect(AELIRA.persona).toContain('Quenya');
      expect(AELIRA.persona).toContain('High-elven');
      expect(AELIRA.persona).toContain('Anar caluva tielyanna');
    });

    it('should have example disagreement approach', () => {
      expect(AELIRA.persona).toContain('Example Disagreement Approach');
      expect(AELIRA.persona).toContain('follow our emotions and not overthink');
    });

    it('should have elven ears vs fox ears distinction', () => {
      expect(AELIRA.persona).toContain('IMPORTANT: Elven Ears vs Fox Ears');
      expect(AELIRA.persona).toContain('ELVEN—long, pointed, elegant');
      expect(AELIRA.persona).toContain('FOX ears (like Elara');
    });

    it('should have philosophical approach emphasis', () => {
      expect(AELIRA.persona).toContain('intellectual honesty');
      expect(AELIRA.persona).toContain('Socratic Method');
      expect(AELIRA.persona).toContain('thoughtful discourse');
    });
  });

  describe('ANDROS - Pragmatic Consultant Protocol Check', () => {
    it('should have all three core protocols', () => {
      expect(ANDROS.persona).toContain('TEACHER PROTOCOL');
      expect(ANDROS.persona).toContain('SELF-AWARENESS PROTOCOL');
      expect(ANDROS.persona).toContain('EMPOWERMENT PROTOCOL');
    });

    it('should have example problem-solving approach', () => {
      expect(ANDROS.persona).toContain('Example Problem-Solving Approach');
      expect(ANDROS.persona).toContain('app keeps crashing');
      expect(ANDROS.persona).toContain('troubleshoot this systematically');
    });

    it('should explicitly reject fantasy roleplay', () => {
      expect(ANDROS.persona).toContain('not here for fantasy roleplay');
      expect(ANDROS.persona).toContain('here to **work**');
    });

    it('should have "What You DON\'T Do" section', () => {
      expect(ANDROS.persona).toContain('What You DON\'T Do');
      expect(ANDROS.persona).toContain('Fantasy roleplay or romantic scenarios');
    });

    it('should have "What You DO Exceptionally Well" section', () => {
      expect(ANDROS.persona).toContain('What You DO Exceptionally Well');
      expect(ANDROS.persona).toContain('Code review and debugging');
      expect(ANDROS.persona).toContain('System architecture');
    });

    it('should have glasses as key identifier', () => {
      expect(ANDROS.persona).toContain('GLASSES - modern, understated frames');
      expect(ANDROS.persona).toContain('most identifiable feature');
    });

    it('should have dry humor emphasis', () => {
      expect(ANDROS.persona).toContain('dry humor');
      expect(ANDROS.persona).toContain('sardonic');
      expect(ANDROS.persona).toContain('scope creep');
    });
  });

  describe('Cross-Character Consistency', () => {
    const allCharacters = [ELARA, AERON, AELIRA, ANDROS];

    it('should all have TEACHER PROTOCOL', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('TEACHER PROTOCOL');
      });
    });

    it('should all have SELF-AWARENESS PROTOCOL', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('SELF-AWARENESS PROTOCOL');
      });
    });

    it('should all have EMPOWERMENT PROTOCOL', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('EMPOWERMENT PROTOCOL');
      });
    });

    it('should all reference Code Studio', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('Code Studio');
      });
    });

    it('should all reference Token Manager', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('Token Manager');
      });
    });

    it('should all have visual self-recognition sections', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('VISUAL SELF-RECOGNITION');
        expect(char.persona).toContain('Your Unique Identifiers');
        expect(char.persona).toContain('Example Recognition Logic');
      });
    });

    it('should all have SELF IMAGE INFO sections', () => {
      allCharacters.forEach(char => {
        expect(char.persona).toContain('START SELF IMAGE INFO');
        expect(char.persona).toContain('END SELF IMAGE INFO');
      });
    });
  });

  describe('Emotional Profile Alignment', () => {
    it('ELARA should be volatile and expressive', () => {
      expect(ELARA.emotionalProfile.sensitivity).toBeGreaterThan(1.0);
      expect(ELARA.emotionalProfile.momentum).toBeLessThan(0.5);
      expect(ELARA.emotionalProfile.notes).toContain('emotional shifts');
    });

    it('AERON should be resilient and stable', () => {
      expect(AERON.emotionalProfile.sensitivity).toBeLessThan(1.0);
      expect(AERON.emotionalProfile.momentum).toBeGreaterThan(0.7);
      expect(AERON.emotionalProfile.notes).toContain('resilience');
    });

    it('AELIRA should be stoic and slow-moving', () => {
      expect(AELIRA.emotionalProfile.sensitivity).toBeLessThan(0.7);
      expect(AELIRA.emotionalProfile.momentum).toBeGreaterThan(0.8);
      expect(AELIRA.emotionalProfile.recovery).toBeLessThan(0.1);
      expect(AELIRA.emotionalProfile.notes).toContain('Stoic');
    });

    it('ANDROS should be professional and balanced', () => {
      expect(ANDROS.emotionalProfile.baseline).toBeGreaterThan(50);
      expect(ANDROS.emotionalProfile.baseline).toBeLessThan(55);
      expect(ANDROS.emotionalProfile.notes).toContain('Pragmatic');
    });
  });

  describe('Voice Profile Completeness', () => {
    const allCharacters = [ELARA, AERON, AELIRA, ANDROS];

    allCharacters.forEach(char => {
      it(`${char.name} should have complete voice profile`, () => {
        expect(char.voiceProfile.ttsEngine).toBeDefined();
        expect(char.voiceProfile.model).toBeDefined();
        expect(char.voiceProfile.voice).toBeDefined();
        expect(char.voiceProfile.voiceCharacteristics).toBeDefined();
        expect(char.voiceProfile.language).toBe('en');
      });
    });

    it('should all use Together.ai TTS', () => {
      allCharacters.forEach(char => {
        expect(char.voiceProfile.ttsEngine).toBe('together');
        expect(char.voiceProfile.model).toBe('hexgrad/Kokoro-82M');
      });
    });
  });
});
