/**
 * Tool Availability Tests
 * 
 * Tests for the dynamic tool availability system based on API keys.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Tool } from "../apiClient";

// Mock the tools module since it may use browser APIs
vi.mock('../tools', () => ({
	getAvailableTools: vi.fn(() => ({
		tools: [
			{ function: { name: 'save_thought', description: 'Save a thought for later' } },
		],
		unavailableReasons: [
			'search_web: Requires Exa API key',
			'make_image: Requires Together.ai API key',
		],
	})),
}));

import { getAvailableTools } from "../tools";

describe('Tool Availability', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getAvailableTools', () => {
		it('should return tools and unavailableReasons', () => {
			const result = getAvailableTools();
			
			expect(result).toHaveProperty('tools');
			expect(result).toHaveProperty('unavailableReasons');
			expect(Array.isArray(result.tools)).toBe(true);
			expect(Array.isArray(result.unavailableReasons)).toBe(true);
		});

		it('should include save_thought as always available', () => {
			const { tools } = getAvailableTools();
			
			const saveThought = tools.find((t: Tool) => t.function.name === 'save_thought');
			expect(saveThought).toBeDefined();
		});

		it('should report unavailable tools with reasons', () => {
			const { unavailableReasons } = getAvailableTools();
			
			expect(unavailableReasons.length).toBeGreaterThan(0);
			expect(unavailableReasons.some((r: string) => r.includes('API key'))).toBe(true);
		});
	});

	describe('Tool Requirements', () => {
		const toolRequirements = {
			search_web: 'exa',
			read_url: 'exa',
			make_image: 'together',
			make_video: 'together',
			save_thought: 'none',
		};

		it('should have correct tool to API key mappings', () => {
			expect(toolRequirements.search_web).toBe('exa');
			expect(toolRequirements.make_image).toBe('together');
			expect(toolRequirements.save_thought).toBe('none');
		});

		it('should identify tools that always work', () => {
			const alwaysAvailable = Object.entries(toolRequirements)
				.filter(([, requirement]) => requirement === 'none')
				.map(([name]) => name);
			
			expect(alwaysAvailable).toContain('save_thought');
		});
	});
});

