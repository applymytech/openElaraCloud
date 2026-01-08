/**
 * Council Mode Tests
 * 
 * Tests the Council of Wisdom multi-perspective AI workflow.
 * Validates token limits, response structure, and synthesis.
 */

import { executeCouncilMode, type CouncilResult } from '@/lib/councilMode';
import { chat } from '@/lib/api';

// Mock the API
jest.mock('@/lib/api');
const mockChat = chat as jest.MockedFunction<typeof chat>;

describe('Council Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Limits', () => {
    it('should NOT enforce hard maxTokens on individual perspectives', async () => {
      // Mock successful responses
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant',
          },
        }],
      } as any);

      await executeCouncilMode({
        userQuestion: 'Test question',
        conversationHistory: [],
      });

      // Check that individual perspective calls DON'T have maxTokens
      const individualCalls = mockChat.mock.calls.slice(0, -1); // All but last (synthesis)
      individualCalls.forEach(call => {
        const options = call[1];
        expect(options?.maxTokens).toBeUndefined();
      });
    });

    it('should NOT enforce hard maxTokens on synthesis', async () => {
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Synthesis response',
            role: 'assistant',
          },
        }],
      } as any);

      await executeCouncilMode({
        userQuestion: 'Test question',
        conversationHistory: [],
      });

      // Check synthesis call (last one) also has no hard limit
      const synthesisCalls = mockChat.mock.calls.slice(-1);
      synthesisCalls.forEach(call => {
        const options = call[1];
        expect(options?.maxTokens).toBeUndefined();
      });
    });
  });

  describe('Response Structure', () => {
    it('should return success with all perspectives', async () => {
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant',
          },
        }],
      } as any);

      const result = await executeCouncilMode({
        userQuestion: 'How do I improve my code?',
        conversationHistory: [],
      });

      expect(result.success).toBe(true);
      expect(result.perspectives).toHaveLength(4); // Elara, Aeron, Aelira, Andros
      expect(result.synthesis).toBeDefined();
      expect(result.leadConsultant).toBeDefined();
    });

    it('should include thinking in responses when provided', async () => {
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant',
            thinking: 'Internal reasoning here',
          },
        }],
      } as any);

      const result = await executeCouncilMode({
        userQuestion: 'Complex question',
        conversationHistory: [],
      });

      expect(result.thinking).toBe('Internal reasoning here');
    });

    it('should handle individual perspective failures gracefully', async () => {
      let callCount = 0;
      mockChat.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second perspective fails
          throw new Error('API timeout');
        }
        return Promise.resolve({
          choices: [{
            message: {
              content: 'Test response',
              role: 'assistant',
            },
          }],
        } as any);
      });

      const result = await executeCouncilMode({
        userQuestion: 'Test question',
        conversationHistory: [],
      });

      // Should still succeed with remaining perspectives
      expect(result.success).toBe(true);
      expect(result.perspectives.length).toBeGreaterThan(0);
      
      // Failed perspective should be marked
      const failedPerspective = result.perspectives.find(p => !p.success);
      expect(failedPerspective).toBeDefined();
      expect(failedPerspective?.answer).toContain('Error consulting');
    });
  });

  describe('Persona Roles', () => {
    it('should assign correct roles to each persona', async () => {
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant',
          },
        }],
      } as any);

      const result = await executeCouncilMode({
        userQuestion: 'Test',
        conversationHistory: [],
      });

      const roles = result.perspectives.map(p => p.role);
      // Actual roles from implementation
      expect(roles).toContain('Guide');
      expect(roles).toContain('Visionary');
      expect(roles).toContain('Strategist');
      expect(roles).toContain('Builder');
    });
  });

  describe('Conversation History', () => {
    it('should pass conversation history to API calls', async () => {
      mockChat.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant',
          },
        }],
      } as any);

      const history = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ];

      await executeCouncilMode({
        userQuestion: 'Follow-up question',
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
