/**
 * Knowledge Panel Component - RAG Document Management
 *
 * ENHANCED VERSION with:
 * - Upload knowledge files (.txt, .md)
 * - View ingested documents (memories + knowledge)
 * - Delete documents
 * - RAG statistics with LIMITS
 * - Alert when over limit
 * - Bulk delete operations
 * - Export all functionality
 */

import { useEffect, useRef, useState } from "react";
import { deleteRAGDocument, getRAGStats, ingestKnowledgeFile, listRAGDocuments, type RAGDocument } from "../lib/rag";

// RAG Limits (in tokens)
const RAG_TOKEN_LIMIT = 500000; // 500k tokens max for RAG
const RAG_TOKEN_WARNING = 400000; // 400k tokens warning

interface KnowledgePanelProps {
	onClose?: () => void;
}

export default function KnowledgePanel({ onClose }: KnowledgePanelProps) {
	const [documents, setDocuments] = useState<RAGDocument[]>([]);
	const [stats, setStats] = useState<{
		totalDocuments: number;
		totalTokens: number;
		byType: Record<string, number>;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [filter, setFilter] = useState<"all" | "conversation" | "knowledge">("all");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Load documents on mount
	const loadDocuments = async () => {
		setLoading(true);
		setError(null);
		try {
			const [docs, ragStats] = await Promise.all([listRAGDocuments(), getRAGStats()]);
			setDocuments(docs);
			setStats(ragStats);
		} catch (e: any) {
			setError(e.message || "Failed to load documents");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDocuments();
	}, []);

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) {
			return;
		}

		setUploading(true);
		setError(null);
		setSuccess(null);

		try {
			const uploadedDocs: string[] = [];
			for (const file of Array.from(files)) {
				// Validate file type
				const validTypes = [".txt", ".md", ".markdown"];
				const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
				if (!validTypes.includes(ext)) {
					throw new Error(`Unsupported file type: ${ext}. Use .txt or .md files.`);
				}

				// Validate file size (max 500KB)
				if (file.size > 500 * 1024) {
					throw new Error(`File too large: ${file.name}. Max 500KB per file.`);
				}

				await ingestKnowledgeFile(file);
				uploadedDocs.push(file.name);
			}

			setSuccess(`Uploaded ${uploadedDocs.length} file(s): ${uploadedDocs.join(", ")}`);
			await loadDocuments();
		} catch (e: any) {
			setError(e.message || "Upload failed");
		} finally {
			setUploading(false);
			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleDelete = async (docId: string, title: string) => {
		if (!confirm(`Delete "${title}"? This will remove it from the AI's knowledge.`)) {
			return;
		}

		try {
			await deleteRAGDocument(docId);
			setSuccess(`Deleted "${title}"`);
			await loadDocuments();
		} catch (e: any) {
			setError(e.message || "Delete failed");
		}
	};

	const handleBulkDelete = async (type: "conversation" | "knowledge" | "old") => {
		let toDelete: RAGDocument[] = [];
		let confirmMsg = "";

		if (type === "conversation") {
			toDelete = documents.filter((d) => d.type === "conversation");
			confirmMsg = `Delete ALL ${toDelete.length} conversation memories? The AI will forget past chats.`;
		} else if (type === "knowledge") {
			toDelete = documents.filter((d) => d.type === "knowledge");
			confirmMsg = `Delete ALL ${toDelete.length} knowledge files?`;
		} else if (type === "old") {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			toDelete = documents.filter((d) => d.type === "conversation" && d.createdAt < thirtyDaysAgo);
			confirmMsg = `Delete ${toDelete.length} conversation memories older than 30 days?`;
		}

		if (toDelete.length === 0) {
			setError("No documents match the criteria");
			return;
		}

		if (!confirm(confirmMsg)) {
			return;
		}

		setProcessing(true);
		try {
			for (const doc of toDelete) {
				await deleteRAGDocument(doc.id);
			}
			setSuccess(`Deleted ${toDelete.length} documents`);
			await loadDocuments();
		} catch (e: any) {
			setError(e.message || "Bulk delete failed");
		} finally {
			setProcessing(false);
		}
	};

	const handleExportAll = () => {
		if (documents.length === 0) {
			setError("No documents to export");
			return;
		}

		// Create a JSON export of all RAG documents
		const exportData = {
			exportDate: new Date().toISOString(),
			totalDocuments: documents.length,
			totalTokens: stats?.totalTokens || 0,
			documents: documents.map((d) => ({
				id: d.id,
				type: d.type,
				title: d.title,
				content: d.content,
				tokens: d.tokens,
				createdAt: d.createdAt.toISOString(),
				metadata: d.metadata,
			})),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `elara_knowledge_backup_${new Date().toISOString().split("T")[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		setSuccess("Knowledge base exported successfully");
	};

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	const formatTokens = (tokens: number) => {
		if (tokens >= 1000000) {
			return `${(tokens / 1000000).toFixed(1)}M`;
		}
		if (tokens >= 1000) {
			return `${(tokens / 1000).toFixed(1)}k`;
		}
		return tokens.toString();
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "conversation":
				return "💬";
			case "knowledge":
				return "📚";
			case "manual":
				return "📖";
			default:
				return "📄";
		}
	};

	const getTypeLabel = (type: string) => {
		switch (type) {
			case "conversation":
				return "Memory";
			case "knowledge":
				return "Knowledge";
			case "manual":
				return "Manual";
			default:
				return type;
		}
	};

	// Compute warning levels
	const tokenPercent = stats ? Math.round((stats.totalTokens / RAG_TOKEN_LIMIT) * 100) : 0;
	const isOverLimit = stats && stats.totalTokens > RAG_TOKEN_LIMIT;
	const isWarning = stats && stats.totalTokens > RAG_TOKEN_WARNING;

	// Filter documents
	const filteredDocs = filter === "all" ? documents : documents.filter((d) => d.type === filter);

	return (
		<div className="knowledge-panel">
			<div className="panel-header">
				<h3>🧠 Knowledge Base</h3>
				{onClose && (
					<button onClick={onClose} className="close-btn">
						✕
					</button>
				)}
			</div>

			{/* Token Usage Bar */}
			<div className="usage-section">
				<div className="usage-header">
					<span className="usage-label">RAG Token Usage</span>
					<span className="usage-value">
						{formatTokens(stats?.totalTokens || 0)} / {formatTokens(RAG_TOKEN_LIMIT)}
					</span>
				</div>
				<div className="usage-bar-container">
					<div
						className={`usage-bar ${isOverLimit ? "critical" : isWarning ? "warning" : "ok"}`}
						style={{ width: `${Math.min(tokenPercent, 100)}%` }}
					/>
				</div>
				<div className="usage-percent">{tokenPercent}% used</div>
			</div>

			{/* Alerts */}
			{isOverLimit && (
				<div className="alert alert-critical">
					⚠️ <strong>Over Token Limit!</strong> RAG search quality may be degraded. Delete old memories or export &amp;
					clear.
				</div>
			)}

			{isWarning && !isOverLimit && (
				<div className="alert alert-warning">
					📦 Approaching token limit. Consider clearing old conversation memories.
				</div>
			)}

			{/* Stats Summary */}
			{stats && (
				<div className="stats-ribbon">
					<div className="stat">
						<span className="stat-value">{stats.totalDocuments}</span>
						<span className="stat-label">Documents</span>
					</div>
					<div className="stat">
						<span className="stat-value">{formatTokens(stats.totalTokens)}</span>
						<span className="stat-label">Tokens</span>
					</div>
					<div className="stat">
						<span className="stat-value">{stats.byType.conversation || 0}</span>
						<span className="stat-label">Memories</span>
					</div>
					<div className="stat">
						<span className="stat-value">{stats.byType.knowledge || 0}</span>
						<span className="stat-label">Files</span>
					</div>
				</div>
			)}

			{/* Upload Section */}
			<div className="upload-section">
				<input
					ref={fileInputRef}
					type="file"
					accept=".txt,.md,.markdown"
					multiple
					onChange={handleFileUpload}
					style={{ display: "none" }}
					id="knowledge-file-input"
				/>
				<button
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="nexus-btn nexus-btn-primary"
				>
					{uploading ? (
						<>
							<span className="nexus-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
							Uploading...
						</>
					) : (
						"📤 Upload Knowledge File"
					)}
				</button>
				<p className="upload-hint">Supports .txt and .md files up to 500KB. Files are embedded for semantic search.</p>
			</div>

			{/* Messages */}
			{error && <div className="message error">⚠️ {error}</div>}
			{success && <div className="message success">✅ {success}</div>}

			{/* Management Actions */}
			<div className="management-section">
				<h4>🛠️ Manage Knowledge</h4>
				<div className="action-buttons">
					<button
						onClick={handleExportAll}
						className="nexus-btn nexus-btn-secondary nexus-btn-sm"
						disabled={processing || documents.length === 0}
					>
						📥 Export All
					</button>
					<button
						onClick={() => handleBulkDelete("old")}
						className="nexus-btn nexus-btn-secondary nexus-btn-sm"
						disabled={processing}
					>
						🗑️ Clear Old (30d+)
					</button>
					<button
						onClick={() => handleBulkDelete("conversation")}
						className="nexus-btn nexus-btn-secondary nexus-btn-sm"
						disabled={processing}
					>
						🗑️ Clear All Memories
					</button>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="filter-tabs">
				<button className={`filter-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
					All ({documents.length})
				</button>
				<button
					className={`filter-tab ${filter === "conversation" ? "active" : ""}`}
					onClick={() => setFilter("conversation")}
				>
					💬 Memories ({stats?.byType.conversation || 0})
				</button>
				<button
					className={`filter-tab ${filter === "knowledge" ? "active" : ""}`}
					onClick={() => setFilter("knowledge")}
				>
					📚 Knowledge ({stats?.byType.knowledge || 0})
				</button>
			</div>

			{/* Document List */}
			<div className="documents-section">
				{loading ? (
					<div className="loading">
						<span className="nexus-spinner" />
						Loading documents...
					</div>
				) : filteredDocs.length === 0 ? (
					<div className="empty-state">
						<p>No documents {filter !== "all" ? `of type "${filter}"` : ""} yet.</p>
						<p className="hint">
							{filter === "conversation"
								? "Chat with the AI to build memories automatically."
								: "Upload knowledge files to give the AI persistent knowledge."}
						</p>
					</div>
				) : (
					<div className="document-list">
						{filteredDocs.map((doc) => (
							<div key={doc.id} className="document-item">
								<div className="doc-icon">{getTypeIcon(doc.type)}</div>
								<div className="doc-info">
									<div className="doc-title">{doc.title}</div>
									<div className="doc-meta">
										<span className="doc-type">{getTypeLabel(doc.type)}</span>
										<span className="doc-tokens">{formatTokens(doc.tokens)} tokens</span>
										<span className="doc-date">{formatDate(doc.updatedAt)}</span>
									</div>
								</div>
								<button onClick={() => handleDelete(doc.id, doc.title)} className="delete-btn" title="Delete document">
									🗑️
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			{/* How It Works */}
			<div className="info-section">
				<details>
					<summary>ℹ️ How RAG Memory Works</summary>
					<div className="info-content">
						<p>
							<strong>Automatic Memories:</strong> Your conversations are automatically saved and embedded for semantic
							search. The AI can recall past discussions.
						</p>
						<p>
							<strong>Knowledge Files:</strong> Upload .txt or .md files to give the AI persistent knowledge. Great for:
						</p>
						<ul>
							<li>Personal notes or preferences</li>
							<li>Project documentation</li>
							<li>Reference materials</li>
							<li>Custom instructions</li>
						</ul>
						<p>
							<strong>Semantic Search:</strong> Uses Together.ai embeddings (M2-BERT) for intelligent retrieval based on
							meaning, not just keywords.
						</p>
						<p>
							<strong>Token Limits:</strong> RAG has a {formatTokens(RAG_TOKEN_LIMIT)} token limit. When exceeded,
							search quality degrades. Clear old memories or export + clear to make room.
						</p>
					</div>
				</details>
			</div>

			<style jsx>{`
        .knowledge-panel {
          background: var(--glass-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
          max-width: 650px;
          max-height: 85vh;
          overflow-y: auto;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          font-size: 1.25rem;
          cursor: pointer;
        }

        .close-btn:hover {
          color: var(--main-text-color);
        }

        .usage-section {
          margin-bottom: var(--spacing-lg);
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--spacing-xs);
          font-size: 0.875rem;
        }

        .usage-label {
          color: var(--secondary-text-color);
        }

        .usage-value {
          font-weight: 600;
        }

        .usage-bar-container {
          height: 8px;
          background: var(--glass-bg-secondary);
          border-radius: 4px;
          overflow: hidden;
        }

        .usage-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .usage-bar.ok {
          background: linear-gradient(90deg, var(--accent-color), var(--color-secondary));
        }

        .usage-bar.warning {
          background: linear-gradient(90deg, #f59e0b, #f97316);
        }

        .usage-bar.critical {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }

        .usage-percent {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          text-align: right;
          margin-top: 2px;
        }

        .alert {
          padding: var(--spacing-md);
          border-radius: var(--border-radius);
          margin-bottom: var(--spacing-md);
          font-size: 0.875rem;
        }

        .alert-critical {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }

        .alert-warning {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.5);
          color: #fcd34d;
        }

        .stats-ribbon {
          display: flex;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          margin-bottom: var(--spacing-lg);
        }

        .stat {
          flex: 1;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent-color);
        }

        .stat-label {
          font-size: 0.625rem;
          color: var(--secondary-text-color);
          text-transform: uppercase;
        }

        .upload-section {
          margin-bottom: var(--spacing-lg);
        }

        .upload-hint {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          margin-top: var(--spacing-xs);
        }

        .message {
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--border-radius);
          margin-bottom: var(--spacing-md);
          font-size: 0.875rem;
        }

        .message.error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .message.success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
        }

        .management-section {
          margin-bottom: var(--spacing-lg);
        }

        .management-section h4 {
          margin: 0 0 var(--spacing-sm);
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .action-buttons {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .filter-tabs {
          display: flex;
          gap: var(--spacing-xs);
          margin-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: var(--spacing-sm);
        }

        .filter-tab {
          background: none;
          border: none;
          padding: var(--spacing-xs) var(--spacing-sm);
          color: var(--secondary-text-color);
          cursor: pointer;
          font-size: 0.75rem;
          border-radius: var(--border-radius);
        }

        .filter-tab:hover {
          background: var(--glass-bg-secondary);
        }

        .filter-tab.active {
          background: var(--accent-color);
          color: white;
        }

        .documents-section {
          margin-bottom: var(--spacing-lg);
        }

        .loading {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-lg);
          justify-content: center;
          color: var(--secondary-text-color);
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-xl);
          color: var(--secondary-text-color);
        }

        .empty-state .hint {
          font-size: 0.875rem;
          opacity: 0.7;
        }

        .document-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          max-height: 250px;
          overflow-y: auto;
        }

        .document-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          transition: all var(--transition-fast);
        }

        .document-item:hover {
          border-color: var(--accent-color);
        }

        .doc-icon {
          font-size: 1.25rem;
        }

        .doc-info {
          flex: 1;
          min-width: 0;
        }

        .doc-title {
          font-weight: 500;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .doc-meta {
          display: flex;
          gap: var(--spacing-sm);
          font-size: 0.625rem;
          color: var(--secondary-text-color);
        }

        .doc-type {
          background: var(--accent-color-subtle);
          color: var(--accent-color);
          padding: 0 var(--spacing-xs);
          border-radius: 3px;
        }

        .delete-btn {
          background: none;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity var(--transition-fast);
        }

        .delete-btn:hover {
          opacity: 1;
        }

        .info-section {
          margin-top: var(--spacing-lg);
        }

        .info-section summary {
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 0.875rem;
        }

        .info-content {
          margin-top: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          font-size: 0.875rem;
        }

        .info-content p {
          margin: 0 0 var(--spacing-sm) 0;
        }

        .info-content ul {
          margin: var(--spacing-xs) 0;
          padding-left: var(--spacing-lg);
        }

        .info-content li {
          margin: var(--spacing-xs) 0;
        }
      `}</style>
		</div>
	);
}
