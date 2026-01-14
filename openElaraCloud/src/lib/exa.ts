/**
 * Exa.ai API Library for OpenElara Cloud
 *
 * This library provides a high-level interface for interacting with the 
 * backend researchAgent function, which is powered by Exa.ai.
 */

import { callResearchApi } from './apiClient';

// ===========================================================================
// TYPE DEFINITIONS (mirroring Exa.ai SDK)
// ===========================================================================

export interface SearchResult {
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score: number;
    id: string;
}

export interface AnswerResult {
    answer: string;
    results: SearchResult[];
}

export interface ContentsResult {
    results: {
        url: string;
        content: string;
    }[];
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

/**
 * Performs a web search using the Exa.ai backend.
 * 
 * @param query The search query.
 * @param maxResults The maximum number of results to return.
 * @returns A list of search results.
 */
export async function search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    const response = await callResearchApi({
        type: 'search',
        query,
        maxResults,
    });
    return (response as any).results.results;
}

/**
 * Gets a direct answer to a query using Exa.ai's answer feature.
 * 
 * @param query The question to ask.
 * @returns The answer and supporting results.
 */
export async function getAnswer(query: string): Promise<AnswerResult> {
    const response = await callResearchApi({
        type: 'answer',
        query,
    });
    return response as AnswerResult;
}

/**
 * Crawls a specific URL and returns its content.
 * 
 * @param url The URL to crawl.
 * @returns The content of the URL.
 */
export async function crawl(url: string): Promise<string> {
    const response = await callResearchApi({
        type: 'crawl',
        url,
    });
    return (response as any).contents.results[0].content;
}
