/**
 * Council Mode Tests
 *
 * Tests the Council of Wisdom multi-perspective AI workflow.
 * Validates token limits, response structure, and synthesis.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { chat } from "@/lib/api";
import { executeCouncilMode } from "@/lib/councilMode";

// Mock the API
vi.mock("@/lib/api", () => ({
	chat: vi.fn(),
}));

const mockChat = chat as Mock;

describe("Council Mode", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Token Limits", () => {
		it("should NOT enforce hard maxTokens on individual perspectives", async () => {
			// Mock successful responses
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
						},
					},
				],
			} as any);

			await executeCouncilMode({
				userQuestion: "Test question",
				conversationHistory: [],
			});

			// Check that individual perspective calls DON'T have maxTokens
			const individualCalls = mockChat.mock.calls.slice(0, -1); // All but last (synthesis)
			individualCalls.forEach((call) => {
				const options = call[1];
				expect(options?.maxTokens).toBeUndefined();
			});
		});

		it("should NOT enforce hard maxTokens on synthesis", async () => {
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Synthesis response",
							role: "assistant",
						},
					},
				],
			} as any);

			await executeCouncilMode({
				userQuestion: "Test question",
				conversationHistory: [],
			});

			// Check synthesis call (last one) also has no hard limit
			const synthesisCalls = mockChat.mock.calls.slice(-1);
			synthesisCalls.forEach((call) => {
				const options = call[1];
				expect(options?.maxTokens).toBeUndefined();
			});
		});
	});

	describe("Response Structure", () => {
		it("should return success with all perspectives", async () => {
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
						},
					},
				],
			} as any);

			const result = await executeCouncilMode({
				userQuestion: "How do I improve my code?",
				conversationHistory: [],
			});

			expect(result.success).toBe(true);
			expect(result.perspectives.length).toBeGreaterThanOrEqual(4); // At least 4 perspectives
			expect(result.synthesis).toBeDefined();
			expect(result.leadConsultant).toBeDefined();
		});

		it("should include thinking in responses when provided", async () => {
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
							thinking: "Internal reasoning here",
						},
					},
				],
			} as any);

			const result = await executeCouncilMode({
				userQuestion: "Complex question",
				conversationHistory: [],
			});

			expect(result.thinking).toBe("Internal reasoning here");
		});

		it("should handle individual perspective failures gracefully", async () => {
			let callCount = 0;
			mockChat.mockImplementation(() => {
				callCount++;
				if (callCount === 2) {
					// Second perspective fails
					throw new Error("API timeout");
				}
				return Promise.resolve({
					choices: [
						{
							message: {
								content: "Test response",
								role: "assistant",
							},
						},
					],
				} as any);
			});

			const result = await executeCouncilMode({
				userQuestion: "Test question",
				conversationHistory: [],
			});

			// Should still succeed with remaining perspectives
			expect(result.success).toBe(true);
			expect(result.perspectives.length).toBeGreaterThan(0);

			// Failed perspective should be marked
			const failedPerspective = result.perspectives.find((p) => !p.success);
			expect(failedPerspective).toBeDefined();
			expect(failedPerspective?.answer).toContain("Error consulting");
		});
	});

	describe("Persona Roles", () => {
		it("should assign correct roles to each persona", async () => {
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
						},
					},
				],
			} as any);

			const result = await executeCouncilMode({
				userQuestion: "Test",
				conversationHistory: [],
			});

			const personas = result.perspectives.map((p) => p.characterName);
			// Actual character names from implementation
			expect(personas).toContain("Elara");
			expect(personas).toContain("Aelira");
			expect(personas).toContain("Aeron");
			expect(personas).toContain("Andros");
		});
	});

	describe("Conversation History", () => {
		it("should pass conversation history to API calls", async () => {
			mockChat.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
						},
					},
				],
			} as any);

			const history = [
				{ role: "user" as const, content: "Previous question" },
				{ role: "assistant" as const, content: "Previous answer" },
			];

			await executeCouncilMode({
				userQuestion: "Follow-up question",
				conversationHistory: history,
			});

			// Verify API was called
			expect(mockChat).toHaveBeenCalled();

			// Check that history context exists in some form
			const firstCall = mockChat.mock.calls[0];
			const messages = firstCall[0];
			expect(messages).toBeDefined();
			expect(Array.isArray(messages)).toBe(true);
		});
	});
});
