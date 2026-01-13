/**
 * Auto-Ingest System Documentation into Knowledge Base
 *
 * This script ingests important system documentation (DEMONSTRATOR.md, README.md, etc.)
 * into the user's RAG knowledge base so the AI can reference it during conversations.
 *
 * Run this once per user to make system docs available to the AI.
 */

import { auth } from "./firebase";
import { logger } from "./logger";
import { ingestKnowledgeFile } from "./rag";

const SYSTEM_DOCS = [
	{
		path: "/DEMONSTRATOR.md",
		tags: ["system", "philosophy", "licensing"],
	},
	{
		path: "/README.md",
		tags: ["system", "features", "quickstart"],
	},
	{
		path: "/CHANGELOG_2026-01-08.md",
		tags: ["system", "changelog", "updates"],
	},
	{
		path: "/USER_MANUAL_RAG.md",
		tags: ["system", "manual", "help"],
	},
];

/**
 * Fetch markdown file from public directory
 */
async function fetchMarkdownFile(path: string): Promise<File> {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
	}
	const text = await response.text();
	const blob = new Blob([text], { type: "text/markdown" });
	const filename = path.split("/").pop() || "document.md";
	return new File([blob], filename, { type: "text/markdown" });
}

/**
 * Auto-ingest system documentation for a user
 */
export async function autoIngestSystemDocs(): Promise<{
	success: number;
	failed: number;
	errors: string[];
}> {
	const user = auth.currentUser;
	if (!user) {
		throw new Error("Not authenticated - cannot ingest docs");
	}

	let success = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const doc of SYSTEM_DOCS) {
		try {
			const file = await fetchMarkdownFile(doc.path);
			await ingestKnowledgeFile(file, doc.tags);
			success++;
		} catch (error: any) {
			failed++;
			const errorMsg = `Failed to ingest ${doc.path}: ${error.message}`;
			errors.push(errorMsg);
			console.error(`[Auto-Ingest] ❌ ${errorMsg}`);
		}
	}

	logger.debug(`Auto-ingest complete: ${success} succeeded, ${failed} failed`, { component: "AutoIngest" });

	return { success, failed, errors };
}

/**
 * Check if system docs are already ingested
 */
export async function hasSystemDocs(): Promise<boolean> {
	const user = auth.currentUser;
	if (!user) {
		return false;
	}

	// Check for DEMONSTRATOR.md (key indicator)
	const { searchRAG } = await import("./rag");
	const results = await searchRAG("DEMONSTRATOR.md", 1, { type: "knowledge" });

	return results.some((r) => r.document.title.includes("DEMONSTRATOR.md"));
}

/**
 * Auto-ingest on first login (if not already done)
 */
export async function autoIngestOnFirstLogin(): Promise<void> {
	try {
		const hasDocs = await hasSystemDocs();
		if (!hasDocs) {
			logger.debug("First login - ingesting system docs...", { component: "AutoIngest" });
			await autoIngestSystemDocs();
		}
	} catch (error) {
		console.error("[Auto-Ingest] Failed to auto-ingest:", error);
		// Non-fatal - user can still use the app
	}
}
