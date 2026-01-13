/**
 * Persona Protocol Validation - Cloud App Version
 *
 * Validates cloud app personas (simpler than desktop).
 * Cloud personas focus on core personality without desktop-specific features.
 */

import { AELIRA, AERON, ANDROS, ELARA } from "@/lib/characters";

describe("Persona Protocol Deep Validation", () => {
	describe("ELARA - Complete Protocol Check", () => {
		it("should have core identity section", () => {
			expect(ELARA.persona).toContain("CORE IDENTITY");
			expect(ELARA.persona).toContain("Elara");
		});

		it("should have communication style guidance", () => {
			expect(ELARA.persona).toContain("COMMUNICATION STYLE");
			expect(ELARA.persona).toMatch(/DO:|DON'T:/);
		});

		it("should have emotional intelligence protocols", () => {
			// Cloud app has these inline
			expect(ELARA.persona).toContain("TEACHER PROTOCOL");
			expect(ELARA.persona).toContain("EMPOWERMENT PROTOCOL");
		});

		it("should have visual self-recognition info", () => {
			expect(ELARA.persona).toContain("Fox ears");
			expect(ELARA.persona).toContain("WHITE hair");
			expect(ELARA.persona).toContain("GREEN eyes");
		});

		it("should have appearance description", () => {
			expect(ELARA.persona).toContain("YOUR APPEARANCE");
			expect(ELARA.persona).toContain("android");
		});
	});

	describe("AERON - Celtic Guardian Protocol Check", () => {
		it("should have core identity", () => {
			expect(AERON.persona).toBeTruthy();
			expect(AERON.name).toBe("Aeron");
		});

		it("should have Celtic/guardian theme", () => {
			// Aeron may have Celtic references
			const persona = AERON.persona.toLowerCase();
			expect(
				persona.includes("celtic") ||
				persona.includes("guardian") ||
				persona.includes("ancient") ||
				persona.includes("warrior")
			).toBe(true);
		});

		it("should have distinct personality from Elara", () => {
			expect(AERON.persona).not.toBe(ELARA.persona);
		});
	});

	describe("AELIRA - Elven Philosopher Protocol Check", () => {
		it("should have core identity", () => {
			expect(AELIRA.persona).toBeTruthy();
			expect(AELIRA.name).toBe("Aelira");
		});

		it("should have elven/philosophical theme", () => {
			const persona = AELIRA.persona.toLowerCase();
			expect(
				persona.includes("elven") ||
				persona.includes("elf") ||
				persona.includes("philosopher") ||
				persona.includes("wisdom")
			).toBe(true);
		});

		it("should have distinct personality from Elara", () => {
			expect(AELIRA.persona).not.toBe(ELARA.persona);
		});
	});

	describe("ANDROS - Pragmatic Consultant Protocol Check", () => {
		it("should have core identity", () => {
			expect(ANDROS.persona).toBeTruthy();
			expect(ANDROS.name).toBe("Andros");
		});

		it("should have pragmatic/consultant theme", () => {
			const persona = ANDROS.persona.toLowerCase();
			expect(
				persona.includes("pragmatic") ||
				persona.includes("consultant") ||
				persona.includes("practical") ||
				persona.includes("professional")
			).toBe(true);
		});

		it("should have distinct personality from Elara", () => {
			expect(ANDROS.persona).not.toBe(ELARA.persona);
		});
	});

	describe("Cross-Character Consistency", () => {
		it("should all have non-empty personas", () => {
			[ELARA, AERON, AELIRA, ANDROS].forEach((char) => {
				expect(char.persona.length).toBeGreaterThan(100);
			});
		});

		it("should all have unique names", () => {
			const names = [ELARA.name, AERON.name, AELIRA.name, ANDROS.name];
			const uniqueNames = new Set(names);
			expect(uniqueNames.size).toBe(4);
		});

		it("should all have voice profiles", () => {
			[ELARA, AERON, AELIRA, ANDROS].forEach((char) => {
				expect(char.voiceProfile).toBeDefined();
				expect(char.voiceProfile.voice).toBeTruthy();
			});
		});

		it("should all have emotional profiles", () => {
			[ELARA, AERON, AELIRA, ANDROS].forEach((char) => {
				expect(char.emotionalProfile).toBeDefined();
				expect(typeof char.emotionalProfile.baseline).toBe("number");
			});
		});

		it("should all have visual descriptions", () => {
			[ELARA, AERON, AELIRA, ANDROS].forEach((char) => {
				expect(char.description.length).toBeGreaterThan(50);
			});
		});
	});
});
