/**
 * ToolResultsDisplay - Show tool execution results from Deep Thought
 *
 * Displays:
 * - Web search results with sources
 * - Images/videos generated
 * - URLs read
 * - Saved thoughts/notes
 */

import type { ToolResult } from "../lib/tools";

interface ToolResultsDisplayProps {
	toolResults: ToolResult[];
}

export default function ToolResultsDisplay({ toolResults }: ToolResultsDisplayProps) {
	if (!toolResults || toolResults.length === 0) {
		return null;
	}

	return (
		<details className="tool-results-container">
			<summary className="tool-results-summary">
				🔧 <strong>Tool Usage</strong> ({toolResults.length} tool{toolResults.length !== 1 ? "s" : ""} used)
			</summary>

			<div className="tool-results-list">
				{toolResults.map((result, idx) => (
					<div key={idx} className={`tool-result ${result.success ? "success" : "failure"}`}>
						<div className="tool-result-header">
							<span className="tool-name">
								{getToolIcon(result.tool)} {getToolDisplayName(result.tool)}
							</span>
							<span className="tool-turn">Turn {result.turn}</span>
						</div>

						<div className="tool-result-body">{renderToolOutput(result)}</div>

						{!result.success && (
							<div className="tool-result-error">❌ Error: {result.output?.error || "Tool execution failed"}</div>
						)}
					</div>
				))}
			</div>

			<style jsx>{`
        .tool-results-container {
          margin: 12px 0;
          padding: 12px;
          background: rgba(100, 100, 255, 0.05);
          border: 1px solid rgba(100, 100, 255, 0.2);
          border-radius: 8px;
        }
        
        .tool-results-summary {
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #6464ff;
          user-select: none;
          list-style: none;
        }
        
        .tool-results-summary::-webkit-details-marker {
          display: none;
        }
        
        .tool-results-summary::before {
          content: '▶ ';
          display: inline-block;
          transition: transform 0.2s;
        }
        
        details[open] .tool-results-summary::before {
          transform: rotate(90deg);
        }
        
        .tool-results-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .tool-result {
          padding: 10px;
          background: rgba(255, 255, 255, 0.03);
          border-left: 3px solid rgba(100, 255, 100, 0.5);
          border-radius: 4px;
        }
        
        .tool-result.failure {
          border-left-color: rgba(255, 100, 100, 0.5);
        }
        
        .tool-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .tool-name {
          font-weight: 600;
          color: #fff;
        }
        
        .tool-turn {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .tool-result-body {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.5;
        }
        
        .tool-result-error {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 100, 100, 0.1);
          border-radius: 4px;
          color: #ff6464;
          font-size: 12px;
        }
        
        .tool-search-result {
          margin-bottom: 8px;
        }
        
        .tool-search-answer {
          margin-bottom: 6px;
        }
        
        .tool-search-sources {
          margin-top: 4px;
          padding-left: 16px;
        }
        
        .tool-search-sources li {
          margin: 2px 0;
          font-size: 12px;
        }
        
        .tool-search-sources a {
          color: #6464ff;
          text-decoration: none;
        }
        
        .tool-search-sources a:hover {
          text-decoration: underline;
        }
        
        .tool-image-preview, .tool-video-preview {
          margin-top: 8px;
          max-width: 300px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .tool-thought-content {
          font-style: italic;
          color: rgba(255, 255, 255, 0.7);
        }
      `}</style>
		</details>
	);
}

function getToolIcon(toolName: string): string {
	switch (toolName) {
		case "search_web":
			return "🔍";
		case "read_url":
			return "📄";
		case "make_image":
			return "🎨";
		case "make_video":
			return "🎬";
		case "save_thought":
			return "💭";
		default:
			return "🔧";
	}
}

function getToolDisplayName(toolName: string): string {
	switch (toolName) {
		case "search_web":
			return "Web Search";
		case "read_url":
			return "Read URL";
		case "make_image":
			return "Generate Image";
		case "make_video":
			return "Generate Video";
		case "save_thought":
			return "Save Thought";
		default:
			return toolName;
	}
}

function renderToolOutput(result: ToolResult) {
	const { tool, output } = result;

	if (!output || !result.success) {
		return null;
	}

	switch (tool) {
		case "search_web":
			return (
				<div className="tool-search-result">
					{output.answer && (
						<div className="tool-search-answer">
							<strong>Answer:</strong> {output.answer}
						</div>
					)}
					{output.sources && output.sources.length > 0 && (
						<div className="tool-search-sources">
							<strong>Sources:</strong>
							<ul>
								{output.sources.map((url: string, idx: number) => (
									<li key={idx}>
										<a href={url} target="_blank" rel="noopener noreferrer">
											{url}
										</a>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			);

		case "read_url":
			return (
				<div>
					<strong>URL:</strong>{" "}
					<a href={output.url} target="_blank" rel="noopener noreferrer">
						{output.url}
					</a>
					<div style={{ marginTop: "6px", maxHeight: "150px", overflow: "auto", fontSize: "12px" }}>
						{output.content?.substring(0, 500)}
						{output.content?.length > 500 && "..."}
					</div>
				</div>
			);

		case "make_image":
			return (
				<div>
					<div>
						<strong>Prompt:</strong> {output.description}
					</div>
					<div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>Model: {output.model}</div>
					{output.imageUrl && <img src={output.imageUrl} alt="Generated" className="tool-image-preview" />}
				</div>
			);

		case "make_video":
			return (
				<div>
					<div>
						<strong>Scene:</strong> {output.description}
					</div>
					<div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
						Model: {output.model} | AI Decision: {output.aiDecision}
					</div>
					{output.videoUrl && <video src={output.videoUrl} controls className="tool-video-preview" />}
				</div>
			);

		case "save_thought":
			return <div className="tool-thought-content">"{output.saved}"</div>;

		default:
			return <pre style={{ fontSize: "12px", overflow: "auto" }}>{JSON.stringify(output, null, 2)}</pre>;
	}
}
