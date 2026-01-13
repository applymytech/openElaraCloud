/**
 * Exa.ai Web Search Service for OpenElara Cloud
 *
 * PORTED FROM DESKTOP: src/main/handlers/exaHandler.js
 *
 * Provides web search and research capabilities:
 * - Power Search: Web search with highlights
 * - Power Read: Crawl and extract content from URLs
 * - Power Similar: Find similar pages
 * - Power Answer: AI-generated answers with sources
 * - Deep Research: Long-running research tasks
 *
 * BYOK: Users provide their own Exa.ai API key (stored in localStorage)
 */

// ============================================================================
// EXA API CONFIGURATION
// ============================================================================

const EXA_API_BASE = "https://api.exa.ai";
const EXA_RESEARCH_BASE = "https://api.exa.ai/research/v1";

// Research polling configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max (60 * 5s)

// ============================================================================
// TYPES
// ============================================================================

export type ExaTaskType = "search" | "crawl" | "similar" | "answer" | "research";

export interface ExaSearchOptions {
	numResults?: number;
	includeDomains?: string[];
	excludeDomains?: string[];
	startDate?: string; // ISO date string
	endDate?: string; // ISO date string
	livecrawl?: "never" | "always" | "fallback";
}

export interface ExaSearchResult {
	title: string;
	url: string;
	score?: number;
	text?: string;
	highlights?: string[];
	publishedDate?: string;
}

export interface ExaResult {
	success: boolean;
	task: ExaTaskType;
	query: string;
	results?: ExaSearchResult[];
	answer?: string;
	sourceUrls?: string[];
	error?: string;
}

export interface ResearchStatus {
	id: string;
	status: "running" | "completed" | "failed";
	progress?: number;
	result?: string;
}

// ============================================================================
// API KEY CHECK
// ============================================================================

import { getAPIKeySync } from "./byok";

/**
 * Check if Exa.ai API key is configured
 */
export function isExaConfigured(): boolean {
	const key = getAPIKeySync("exa");
	return !!key && key.length > 0;
}

/**
 * Get Exa API key (throws if not configured)
 */
function getExaKey(): string {
	const key = getAPIKeySync("exa");
	if (!key) {
		throw new Error("Exa.ai API key not configured. Add your key in Settings → API Keys.");
	}
	return key;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function exaFetch(endpoint: string, body: object): Promise<any> {
	const apiKey = getExaKey();

	const response = await fetch(`${EXA_API_BASE}${endpoint}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Exa API error (${response.status}): ${errorText}`);
	}

	return response.json();
}

async function exaResearchFetch(endpoint: string, method: "GET" | "POST" = "GET", body?: object): Promise<any> {
	const apiKey = getExaKey();

	const options: RequestInit = {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	};

	if (body) {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(`${EXA_RESEARCH_BASE}${endpoint}`, options);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Exa Research API error (${response.status}): ${errorText}`);
	}

	return response.json();
}

// ============================================================================
// POWER SEARCH
// ============================================================================

/**
 * Power Search - Standard web search with highlights
 */
export async function powerSearch(query: string, options: ExaSearchOptions = {}): Promise<ExaResult> {
	try {
		const body: any = {
			query,
			numResults: options.numResults || 5,
			text: true,
			highlights: true,
		};

		if (options.includeDomains?.length) {
			body.includeDomains = options.includeDomains;
		}
		if (options.excludeDomains?.length) {
			body.excludeDomains = options.excludeDomains;
		}
		if (options.startDate) {
			body.startPublishedDate = options.startDate;
		}
		if (options.endDate) {
			body.endPublishedDate = options.endDate;
		}

		const data = await exaFetch("/search", body);

		return {
			success: true,
			task: "search",
			query,
			results:
				data.results?.map((r: any) => ({
					title: r.title || "Untitled",
					url: r.url,
					score: r.score,
					text: r.text,
					highlights: r.highlights,
					publishedDate: r.publishedDate,
				})) || [],
		};
	} catch (error: any) {
		return {
			success: false,
			task: "search",
			query,
			error: error.message,
		};
	}
}

// ============================================================================
// POWER READ (CRAWL)
// ============================================================================

/**
 * Power Read - Crawl and extract content from a URL
 */
export async function powerRead(url: string, options: ExaSearchOptions = {}): Promise<ExaResult> {
	try {
		const body: any = {
			urls: [url],
		};

		if (options.livecrawl) {
			body.livecrawl = options.livecrawl;
		}

		const data = await exaFetch("/contents", body);

		const content = data.results?.[0];
		return {
			success: true,
			task: "crawl",
			query: url,
			answer: content?.text || "No content extracted",
			sourceUrls: [url],
		};
	} catch (error: any) {
		return {
			success: false,
			task: "crawl",
			query: url,
			error: error.message,
		};
	}
}

// ============================================================================
// POWER SIMILAR
// ============================================================================

/**
 * Power Similar - Find pages similar to a given URL
 */
export async function powerSimilar(url: string, options: ExaSearchOptions = {}): Promise<ExaResult> {
	try {
		const body: any = {
			url,
			numResults: options.numResults || 5,
		};

		const data = await exaFetch("/findSimilar", body);

		return {
			success: true,
			task: "similar",
			query: url,
			results:
				data.results?.map((r: any) => ({
					title: r.title || "Untitled",
					url: r.url,
					score: r.score,
				})) || [],
		};
	} catch (error: any) {
		return {
			success: false,
			task: "similar",
			query: url,
			error: error.message,
		};
	}
}

// ============================================================================
// POWER ANSWER
// ============================================================================

/**
 * Power Answer - Get AI-generated answer with sources
 */
export async function powerAnswer(query: string, options: ExaSearchOptions = {}): Promise<ExaResult> {
	try {
		const body: any = {
			query,
			numResults: options.numResults || 10,
			text: true,
			highlights: true,
			model: "exa",
			type: "auto",
		};

		if (options.includeDomains?.length) {
			body.includeDomains = options.includeDomains;
		}
		if (options.excludeDomains?.length) {
			body.excludeDomains = options.excludeDomains;
		}
		if (options.startDate) {
			body.startPublishedDate = options.startDate;
		}

		const data = await exaFetch("/answer", body);

		return {
			success: true,
			task: "answer",
			query,
			answer: data.answer || "No answer generated",
			sourceUrls: data.results?.map((r: any) => r.url) || [],
			results:
				data.results?.map((r: any) => ({
					title: r.title || "Untitled",
					url: r.url,
					text: r.text,
					highlights: r.highlights,
				})) || [],
		};
	} catch (error: any) {
		return {
			success: false,
			task: "answer",
			query,
			error: error.message,
		};
	}
}

// ============================================================================
// DEEP RESEARCH
// ============================================================================

/**
 * Deep Research - Long-running research task with polling
 *
 * @param query - Research instructions/question
 * @param onProgress - Optional callback for progress updates
 */
export async function deepResearch(query: string, onProgress?: (status: ResearchStatus) => void): Promise<ExaResult> {
	try {
		// Create research task
		const createResponse = await exaResearchFetch("", "POST", {
			instructions: query,
			model: "exa-research",
		});

		const researchId = createResponse.id;
		if (!researchId) {
			throw new Error("Failed to create research task");
		}

		onProgress?.({
			id: researchId,
			status: "running",
			progress: 0,
		});

		// Poll for completion
		let attempts = 0;
		while (attempts < MAX_POLL_ATTEMPTS) {
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
			attempts++;

			const statusResponse = await exaResearchFetch(`/${researchId}`);

			const progress = Math.min((attempts / MAX_POLL_ATTEMPTS) * 100, 95);

			if (statusResponse.status === "completed") {
				onProgress?.({
					id: researchId,
					status: "completed",
					progress: 100,
					result: statusResponse.result,
				});

				return {
					success: true,
					task: "research",
					query,
					answer: statusResponse.result || "Research completed",
					sourceUrls: statusResponse.sources?.map((s: any) => s.url) || [],
				};
			}

			if (statusResponse.status === "failed") {
				throw new Error(statusResponse.error || "Research task failed");
			}

			onProgress?.({
				id: researchId,
				status: "running",
				progress,
			});
		}

		throw new Error("Research task timed out after 5 minutes");
	} catch (error: any) {
		return {
			success: false,
			task: "research",
			query,
			error: error.message,
		};
	}
}

// ============================================================================
// UNIFIED TASK RUNNER
// ============================================================================

/**
 * Run any Exa task type
 */
export async function runExaTask(
	task: ExaTaskType,
	query: string,
	options: ExaSearchOptions = {},
	onProgress?: (status: ResearchStatus) => void,
): Promise<ExaResult> {
	switch (task) {
		case "search":
			return powerSearch(query, options);
		case "crawl":
			return powerRead(query, options);
		case "similar":
			return powerSimilar(query, options);
		case "answer":
			return powerAnswer(query, options);
		case "research":
			return deepResearch(query, onProgress);
		default:
			return {
				success: false,
				task,
				query,
				error: `Unknown task type: ${task}`,
			};
	}
}

// ============================================================================
// CHAT INTEGRATION HELPER
// ============================================================================

/**
 * Format Exa result for injection into chat context
 */
export function formatExaResultForChat(result: ExaResult): string {
	if (!result.success) {
		return `[Web Search Error: ${result.error}]`;
	}

	let formatted = "";

	if (result.answer) {
		formatted += `## Web Research Result\n\n${result.answer}\n\n`;
	}

	if (result.results && result.results.length > 0) {
		formatted += `## Sources\n\n`;
		result.results.forEach((r, i) => {
			formatted += `${i + 1}. **${r.title}**\n`;
			formatted += `   ${r.url}\n`;
			if (r.highlights && r.highlights.length > 0) {
				formatted += `   > ${r.highlights[0]}\n`;
			}
			formatted += "\n";
		});
	}

	if (result.sourceUrls && result.sourceUrls.length > 0 && !result.results) {
		formatted += `## Sources\n\n`;
		result.sourceUrls.forEach((url, i) => {
			formatted += `${i + 1}. ${url}\n`;
		});
	}

	return formatted || "[No results found]";
}
