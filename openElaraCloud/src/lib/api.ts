/**
 * Main API for OpenElara Cloud
 *
 * This file defines the core data structures and serves as the primary
 * entry point for all frontend API interactions. It re-exports functions
 * from the underlying modules (`apiClient`, `models`, `exa`).
 */

// ===========================================================================
// CORE TYPES
// ===========================================================================

export interface ContentPart {
    text?: string;
    // In the future, this could be extended for multimodal input, 
    // e.g., { inline_data: { mime_type: string, data: string } }
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string; // Can be a simple string or stringified JSON for tool results
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any; // JSON Schema object
    };
}

export interface ImageGenParams {
    prompt: string;
    negative_prompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    guidance_scale?: number;
}

// ===========================================================================
// RESEARCH / EXA TYPES
// ===========================================================================

export interface ResearchResult {
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score: number;
    id: string;
}

export interface AnswerResult {
    answer: string;
    results: ResearchResult[];
}

export interface ContentsResult {
    results: {
        url: string;
        content: string;
    }[];
}

// ===========================================================================
// RE-EXPORTS
// ===========================================================================

// Main client functions for calling backend
export { callChatApi, callImageApi, callResearchApi } from './apiClient';

// High-level interface for the Exa research agent
export { search, getAnswer, crawl } from './exa';

// Model management (fetching lists, getting metadata)
export * from './models';
