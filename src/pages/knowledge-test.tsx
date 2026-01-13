/**
 * Knowledge Ingestion Test Page
 *
 * Tests:
 * 1. File upload and ingestion
 * 2. Embedding generation
 * 3. Semantic search
 * 4. System docs auto-ingestion
 */

import { useState } from "react";
import { autoIngestSystemDocs, hasSystemDocs } from "../lib/autoIngestDocs";
import { ingestKnowledgeFile, type RAGSearchResult, searchRAG } from "../lib/rag";

export default function KnowledgeTest() {
	const [status, setStatus] = useState<string>("");
	const [testResults, setTestResults] = useState<any[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);
	const [systemDocsExist, setSystemDocsExist] = useState<boolean>(false);

	// Test 1: Check if system docs exist
	const testCheckSystemDocs = async () => {
		setStatus("Checking for system docs...");
		try {
			const exists = await hasSystemDocs();
			setSystemDocsExist(exists);
			setStatus(exists ? "✅ System docs found" : "⚠️ System docs not found");
			setTestResults((prev) => [...prev, { test: "Check System Docs", result: exists }]);
		} catch (error: any) {
			setStatus(`❌ Error: ${error.message}`);
		}
	};

	// Test 2: Auto-ingest system docs
	const testAutoIngest = async () => {
		setStatus("Auto-ingesting system docs...");
		try {
			const result = await autoIngestSystemDocs();
			setStatus(`✅ Ingested: ${result.success} succeeded, ${result.failed} failed`);
			setTestResults((prev) => [...prev, { test: "Auto-Ingest", result }]);
			if (result.errors.length > 0) {
				console.error("Ingest errors:", result.errors);
			}
		} catch (error: any) {
			setStatus(`❌ Error: ${error.message}`);
		}
	};

	// Test 3: Upload and ingest custom file
	const testFileIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		setStatus(`Ingesting ${file.name}...`);
		try {
			const doc = await ingestKnowledgeFile(file, ["test"]);
			setStatus(`✅ Ingested ${file.name} (${doc.tokens} tokens)`);
			setTestResults((prev) => [...prev, { test: "File Ingest", file: file.name, tokens: doc.tokens }]);
		} catch (error: any) {
			setStatus(`❌ Error: ${error.message}`);
		}
	};

	// Test 4: Semantic search
	const testSearch = async () => {
		if (!searchQuery) {
			return;
		}

		setStatus(`Searching for "${searchQuery}"...`);
		try {
			const results = await searchRAG(searchQuery, 5);
			setSearchResults(results);
			setStatus(`✅ Found ${results.length} results`);
			setTestResults((prev) => [
				...prev,
				{
					test: "Semantic Search",
					query: searchQuery,
					results: results.length,
				},
			]);
		} catch (error: any) {
			setStatus(`❌ Error: ${error.message}`);
		}
	};

	return (
		<div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
			<h1>🧪 Knowledge Ingestion Test Suite</h1>

			{/* Status Display */}
			<div
				style={{
					padding: "12px",
					background: "#1a1f2e",
					border: "1px solid rgba(255,255,255,0.1)",
					borderRadius: "8px",
					marginBottom: "20px",
					fontFamily: "monospace",
				}}
			>
				{status || "Ready to test..."}
			</div>

			{/* Test 1: System Docs Check */}
			<section style={{ marginBottom: "30px" }}>
				<h2>Test 1: System Docs Check</h2>
				<button
					onClick={testCheckSystemDocs}
					style={{
						padding: "10px 20px",
						background: "#00d4ff",
						color: "#fff",
						border: "none",
						borderRadius: "8px",
						cursor: "pointer",
					}}
				>
					Check System Docs
				</button>
				<p>Has System Docs: {systemDocsExist ? "✅ Yes" : "❌ No"}</p>
			</section>

			{/* Test 2: Auto-Ingest */}
			<section style={{ marginBottom: "30px" }}>
				<h2>Test 2: Auto-Ingest System Docs</h2>
				<button
					onClick={testAutoIngest}
					style={{
						padding: "10px 20px",
						background: "#a855f7",
						color: "#fff",
						border: "none",
						borderRadius: "8px",
						cursor: "pointer",
					}}
				>
					Auto-Ingest Docs
				</button>
				<p style={{ fontSize: "0.9em", color: "#8a95a6" }}>
					Ingests DEMONSTRATOR.md, README.md, CHANGELOG, USER_MANUAL
				</p>
			</section>

			{/* Test 3: File Upload */}
			<section style={{ marginBottom: "30px" }}>
				<h2>Test 3: Upload Custom File</h2>
				<input
					type="file"
					accept=".txt,.md"
					onChange={testFileIngest}
					style={{
						padding: "10px",
						background: "#1a1f2e",
						color: "#fff",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: "8px",
						cursor: "pointer",
					}}
				/>
				<p style={{ fontSize: "0.9em", color: "#8a95a6" }}>Upload a .txt or .md file to test ingestion</p>
			</section>

			{/* Test 4: Search */}
			<section style={{ marginBottom: "30px" }}>
				<h2>Test 4: Semantic Search</h2>
				<div style={{ display: "flex", gap: "10px" }}>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search query..."
						style={{
							flex: 1,
							padding: "10px",
							background: "#1a1f2e",
							color: "#fff",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: "8px",
						}}
					/>
					<button
						onClick={testSearch}
						style={{
							padding: "10px 20px",
							background: "#00d4ff",
							color: "#fff",
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
						}}
					>
						Search
					</button>
				</div>

				{/* Search Results */}
				{searchResults.length > 0 && (
					<div style={{ marginTop: "20px" }}>
						<h3>Search Results ({searchResults.length})</h3>
						{searchResults.map((result, i) => (
							<div
								key={i}
								style={{
									padding: "12px",
									background: "#1a1f2e",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: "8px",
									marginBottom: "10px",
								}}
							>
								<div style={{ fontWeight: "bold", marginBottom: "8px" }}>{result.document.title}</div>
								<div style={{ fontSize: "0.85em", color: "#8a95a6", marginBottom: "8px" }}>
									Relevance: {(result.relevance * 100).toFixed(1)}% • {result.document.tokens} tokens
								</div>
								<div style={{ fontSize: "0.9em" }}>{result.snippet}</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Test Results Log */}
			<section>
				<h2>Test Results Log</h2>
				<pre
					style={{
						padding: "12px",
						background: "#0a0e17",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: "8px",
						overflow: "auto",
						maxHeight: "400px",
						fontSize: "0.85em",
					}}
				>
					{JSON.stringify(testResults, null, 2)}
				</pre>
			</section>
		</div>
	);
}
