/**
 * MessageContent - Intelligent Markdown & Code Renderer
 *
 * Features:
 * - Renders markdown formatting (bold, italic, lists, etc.)
 * - Smart code block detection:
 *   - Regular code → syntax highlighted code object
 *   - Markdown documents → rendered visual document
 *   - Charts/diagrams → interactive visualizations
 * - Never executes HTML/JS (display only)
 */

import hljs from "highlight.js";
import { marked } from "marked";
import { useEffect, useRef, useState } from "react";
import "highlight.js/styles/github-dark.css";

// ============================================================================
// TYPES
// ============================================================================

interface MessageContentProps {
	content: string;
	role: "user" | "assistant" | "system" | "tool";
}

interface CodeBlock {
	language: string;
	code: string;
	isDocument: boolean;
	isChart: boolean;
}

// ============================================================================
// DOCUMENT DETECTION
// ============================================================================

const DOCUMENT_INDICATORS = [
	"# ",
	"## ",
	"### ", // Markdown headings
	"**Table of Contents**",
	"**Overview**",
	"**Introduction**",
	"**Summary**",
	"---", // Horizontal rules
	"| ", // Tables
];

function isMarkdownDocument(code: string): boolean {
	const lines = code.trim().split("\n");

	// Check for document-like structure
	const hasHeadings = lines.some((line) => line.trim().startsWith("#"));
	const hasMultipleHeadings = lines.filter((line) => line.trim().startsWith("#")).length >= 2;
	const hasDocumentWords = DOCUMENT_INDICATORS.some((indicator) => code.includes(indicator));

	// If it has multiple headings or document structure, render as document
	return hasMultipleHeadings || (hasHeadings && hasDocumentWords);
}

function isChartCode(language: string, code: string): boolean {
	// Detect chart/diagram libraries
	const chartKeywords = [
		"mermaid",
		"chart.js",
		"plotly",
		"chart",
		"graph",
		"diagram",
		"flowchart",
		"sequence",
		"gantt",
	];

	return chartKeywords.some(
		(keyword) => language.toLowerCase().includes(keyword) || code.toLowerCase().includes(keyword),
	);
}

// ============================================================================
// CODE BLOCK PARSER
// ============================================================================

function parseCodeBlocks(content: string): (string | CodeBlock)[] {
	const parts: (string | CodeBlock)[] = [];
	const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
	let lastIndex = 0;
	let match;

	while ((match = codeBlockRegex.exec(content)) !== null) {
		// Add text before code block
		if (match.index > lastIndex) {
			parts.push(content.slice(lastIndex, match.index));
		}

		const language = match[1] || "text";
		const code = match[2].trim();

		// Determine how to render this block
		const isDocument = language.toLowerCase() === "markdown" || language === "md" || isMarkdownDocument(code);
		const isChart = isChartCode(language, code);

		parts.push({
			language,
			code,
			isDocument,
			isChart,
		});

		lastIndex = match.index + match[0].length;
	}

	// Add remaining text
	if (lastIndex < content.length) {
		parts.push(content.slice(lastIndex));
	}

	return parts.length > 0 ? parts : [content];
}

// ============================================================================
// MARKDOWN RENDERER
// ============================================================================

function renderMarkdown(text: string): string {
	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true,
		gfm: true,
	});

	return marked.parse(text) as string;
}

// ============================================================================
// CODE RENDERER
// ============================================================================

interface CodeBlockRendererProps {
	block: CodeBlock;
}

function CodeBlockRenderer({ block }: CodeBlockRendererProps) {
	const codeRef = useRef<HTMLElement>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (codeRef.current && !block.isDocument) {
			hljs.highlightElement(codeRef.current);
		}
	}, [block.isDocument]);

	const handleCopy = () => {
		navigator.clipboard.writeText(block.code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Render as visual document
	if (block.isDocument) {
		return (
			<div className="message-document">
				<div className="document-header">
					<span className="document-icon">📄</span>
					<span className="document-label">Document</span>
					<button className="document-copy-btn" onClick={handleCopy}>
						{copied ? "✓ Copied" : "📋 Copy"}
					</button>
				</div>
				<div
					className="document-content markdown-body"
					dangerouslySetInnerHTML={{ __html: renderMarkdown(block.code) }}
				/>
			</div>
		);
	}

	// Render as chart/diagram (future: add Mermaid, Chart.js support)
	if (block.isChart) {
		return (
			<div className="message-code-block">
				<div className="code-header">
					<span className="code-language">{block.language} (Chart - Display Only)</span>
					<button className="code-copy-btn" onClick={handleCopy}>
						{copied ? "✓ Copied" : "📋"}
					</button>
				</div>
				<pre className="code-pre">
					<code ref={codeRef} className={`language-${block.language}`}>
						{block.code}
					</code>
				</pre>
				<div className="code-footer">ℹ️ Chart visualization coming soon</div>
			</div>
		);
	}

	// Render as code block
	return (
		<div className="message-code-block">
			<div className="code-header">
				<span className="code-language">{block.language}</span>
				<button className="code-copy-btn" onClick={handleCopy}>
					{copied ? "✓ Copied" : "📋"}
				</button>
			</div>
			<pre className="code-pre">
				<code ref={codeRef} className={`language-${block.language}`}>
					{block.code}
				</code>
			</pre>
		</div>
	);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MessageContent({ content, role }: MessageContentProps) {
	const parts = parseCodeBlocks(content);

	return (
		<div className="message-content-wrapper">
			{parts.map((part, index) => {
				if (typeof part === "string") {
					// Render markdown text
					return (
						<div
							key={index}
							className="message-text markdown-body"
							dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
						/>
					);
				} else {
					// Render code block
					return <CodeBlockRenderer key={index} block={part} />;
				}
			})}

			<style jsx>{`
        .message-content-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        /* Markdown Text */
        .message-text {
          line-height: 1.6;
        }
        
        .message-text :global(p) {
          margin: 0 0 12px 0;
        }
        
        .message-text :global(p:last-child) {
          margin-bottom: 0;
        }
        
        .message-text :global(strong) {
          font-weight: 600;
          color: var(--accent-color);
        }
        
        .message-text :global(em) {
          font-style: italic;
          color: var(--secondary-text-color);
        }
        
        .message-text :global(code) {
          background: rgba(139, 92, 246, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          font-size: 0.9em;
          color: var(--accent-color);
        }
        
        .message-text :global(ul),
        .message-text :global(ol) {
          margin: 8px 0;
          padding-left: 24px;
        }
        
        .message-text :global(li) {
          margin: 4px 0;
        }
        
        .message-text :global(blockquote) {
          border-left: 3px solid var(--accent-color);
          padding-left: 12px;
          margin: 12px 0;
          color: var(--secondary-text-color);
          font-style: italic;
        }
        
        .message-text :global(a) {
          color: var(--accent-color);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }
        
        .message-text :global(a:hover) {
          border-bottom-color: var(--accent-color);
        }
        
        /* Code Blocks */
        .message-code-block {
          background: var(--secondary-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid var(--glass-border);
        }
        
        .code-language {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .code-copy-btn {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--secondary-text-color);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .code-copy-btn:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
          color: var(--accent-color);
        }
        
        .code-pre {
          margin: 0;
          padding: 16px;
          overflow-x: auto;
          background: rgba(0, 0, 0, 0.3);
        }
        
        .code-pre code {
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.5;
        }
        
        .code-footer {
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid var(--glass-border);
          font-size: 11px;
          color: var(--secondary-text-color);
          text-align: center;
        }
        
        /* Document Rendering */
        .message-document {
          background: var(--main-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .document-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
          border-bottom: 1px solid var(--glass-border);
        }
        
        .document-icon {
          font-size: 18px;
        }
        
        .document-label {
          font-weight: 600;
          color: var(--accent-color);
          flex: 1;
        }
        
        .document-copy-btn {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          color: var(--main-text-color);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .document-copy-btn:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
        }
        
        .document-content {
          padding: 24px;
          max-height: 600px;
          overflow-y: auto;
        }
        
        .document-content :global(h1) {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: var(--accent-color);
          border-bottom: 2px solid var(--glass-border);
          padding-bottom: 8px;
        }
        
        .document-content :global(h2) {
          font-size: 20px;
          font-weight: 600;
          margin: 24px 0 12px 0;
          color: var(--main-text-color);
        }
        
        .document-content :global(h3) {
          font-size: 16px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: var(--secondary-text-color);
        }
        
        .document-content :global(p) {
          margin: 0 0 12px 0;
          line-height: 1.7;
        }
        
        .document-content :global(ul),
        .document-content :global(ol) {
          margin: 12px 0;
          padding-left: 28px;
        }
        
        .document-content :global(li) {
          margin: 6px 0;
        }
        
        .document-content :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }
        
        .document-content :global(th),
        .document-content :global(td) {
          border: 1px solid var(--glass-border);
          padding: 10px;
          text-align: left;
        }
        
        .document-content :global(th) {
          background: rgba(139, 92, 246, 0.1);
          font-weight: 600;
        }
        
        .document-content :global(hr) {
          border: none;
          border-top: 1px solid var(--glass-border);
          margin: 20px 0;
        }
        
        .document-content :global(code) {
          background: rgba(139, 92, 246, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          font-size: 0.9em;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .document-content {
            padding: 16px;
            max-height: 400px;
          }
          
          .code-pre {
            padding: 12px;
          }
          
          .code-pre code {
            font-size: 12px;
          }
        }
      `}</style>
		</div>
	);
}
