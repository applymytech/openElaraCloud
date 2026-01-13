/**
 * Character System Tests - Cloud App Version
 *
 * Tests character personas, emotional profiles, and voice settings.
 * Cloud app personas are simpler than desktop versions.
 */

import { AELIRA, AERON, ANDROS, ELARA, getActiveCharacter } from "@/lib/characters";

describe("Character System", () => {
	describe("Built-in Characters", () => {
		it("should have all 4 main characters defined", () => {
			expect(ELARA).toBeDefined();
			expect(AERON).toBeDefined();
			expect(AELIRA).toBeDefined();
			expect(ANDROS).toBeDefined();
		});

		it("should have unique IDs for each character", () => {
			const ids = [ELARA.id, AERON.id, AELIRA.id, ANDROS.id];
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(4);
		});

		it("should mark all main characters as built-in", () => {
			expect(ELARA.isBuiltIn).toBe(true);
			expect(AERON.isBuiltIn).toBe(true);
			expect(AELIRA.isBuiltIn).toBe(true);
			expect(ANDROS.isBuiltIn).toBe(true);
		});
	});

	describe("Elara - Default Character", () => {
		it("should have complete persona with core protocols", () => {
			// Cloud app has TEACHER and EMPOWERMENT protocols inline
			expect(ELARA.persona).toContain("TEACHER PROTOCOL");
			expect(ELARA.persona).toContain("EMPOWERMENT PROTOCOL");
		});

		it("should have visual self-recognition guidance", () => {
			// Cloud app has appearance section
			expect(ELARA.persona).toContain("Fox ears");
			expect(ELARA.persona).toContain("WHITE hair");
			expect(ELARA.persona).toContain("GREEN eyes");
		});

		it("should have correct emotional profile", () => {
			expect(ELARA.emotionalProfile.baseline).toBe(65); // Naturally happy
			expect(ELARA.emotionalProfile.sensitivity).toBe(1.4); // Very expressive
			expect(ELARA.emotionalProfile.recovery).toBe(0.12); // Bounces back quickly
			expect(ELARA.emotionalProfile.momentum).toBe(0.3); // Volatile emotions
		});

		it("should have voice profile configured", () => {
			expect(ELARA.voiceProfile.ttsEngine).toBe("together");
			expect(ELARA.voiceProfile.model).toBe("hexgrad/Kokoro-82M");
			expect(ELARA.voiceProfile.voice).toBe("af_heart");
		});
	});

	describe("Aeron - Celtic Guardian", () => {
		it("should have warrior/guardian theme", () => {
			const persona = AERON.persona.toLowerCase();
			expect(
				persona.includes("guardian") ||
				persona.includes("warrior") ||
				persona.includes("celtic") ||
				persona.includes("ancient")
			).toBe(true);
		});

		it("should have distinct emotional profile", () => {
			// Aeron should be calmer, more stable than Elara
			expect(AERON.emotionalProfile.baseline).toBeDefined();
			expect(AERON.emotionalProfile.sensitivity).toBeDefined();
		});

		it("should have voice profile", () => {
			expect(AERON.voiceProfile.voice).toBeTruthy();
		});
	});

	describe("Aelira - Elven Philosopher", () => {
		it("should have elven/philosophical theme", () => {
			const persona = AELIRA.persona.toLowerCase();
			expect(
				persona.includes("elven") ||
				persona.includes("elf") ||
				persona.includes("philosopher") ||
				persona.includes("wisdom")
			).toBe(true);
		});

		it("should have contemplative emotional profile", () => {
			expect(AELIRA.emotionalProfile.baseline).toBeDefined();
			// Philosophers should be calmer
			expect(AELIRA.emotionalProfile.sensitivity).toBeLessThanOrEqual(1.0);
		});

		it("should have voice profile", () => {
			expect(AELIRA.voiceProfile.voice).toBeTruthy();
		});
	});

	describe("Andros - Pragmatic Consultant", () => {
		it("should have pragmatic/professional theme", () => {
			const persona = ANDROS.persona.toLowerCase();
			expect(
				persona.includes("pragmatic") ||
				persona.includes("consultant") ||
				persona.includes("practical") ||
				persona.includes("professional")
			).toBe(true);
		});

		it("should have professional emotional profile", () => {
			expect(ANDROS.emotionalProfile.baseline).toBeDefined();
		});

		it("should have voice profile", () => {
			expect(ANDROS.voiceProfile.voice).toBeTruthy();
		});
	});

	describe("Active Character Selection", () => {
		it("should return default character (Elara) when none selected", () => {
			// Clear localStorage
			localStorage.clear();
			const active = getActiveCharacter();
			expect(active.id).toBe("elara");
		});

		it("should always return a valid character object", () => {
			const active = getActiveCharacter();
			expect(active).toBeDefined();
			expect(active.id).toBeDefined();
			expect(active.name).toBeDefined();
			expect(active.persona).toBeDefined();
		});
	});
});
