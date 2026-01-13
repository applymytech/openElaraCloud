/**
 * Video Generation Panel Component - AGENTIC vs CUSTOM
 *
 * IMPORTANT: Both modes use the SAME video generation endpoint/handler.
 * The difference is ONLY in how the prompt is constructed:
 *
 * SELFIE MODE (Agentic):
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES actual scene/camera work contextually
 * 3. AI's contextual scene description goes to generateVideo()
 * 4. Result is character-authentic with cinematography (NOT literally a "selfie" video!)
 *
 * CUSTOM MODE:
 * 1. User provides explicit prompt
 * 2. Goes directly to generateVideo() with user's exact prompt
 *
 * Both modes → generateVideo() → Together.ai /v1/video/generations endpoint
 * STORAGE: Auto-stores to Firebase Storage with download-and-clear workflow
 * User downloads to local → clears cloud space
 */

import { useState } from "react";
import { getActiveCharacter } from "../lib/characters";
import { type GeneratedVideo, generateAgenticVideo, generateVideo, VIDEO_MODELS } from "../lib/mediaGeneration";
import { getMoodState } from "../lib/mood";
import { deleteMedia, storeMediaFromUrl } from "../lib/storage";

// Use the exported VIDEO_MODELS constant
const _VIDEO_MODEL_METADATA = VIDEO_MODELS;

interface VideoGenPanelProps {
	onClose: () => void;
	onVideoGenerated?: (video: GeneratedVideo) => void;
	conversationContext?: string; // Recent conversation for context
}

export default function VideoGenPanel({ onClose, onVideoGenerated, conversationContext }: VideoGenPanelProps) {
	const [mode, setMode] = useState<"selfie" | "custom">("selfie");
	const [prompt, setPrompt] = useState("");
	// Use first available model (MiniMax is good quality/price balance)
	const firstAvailable = Object.keys(VIDEO_MODELS)[0] || "google/veo-3.0";
	const [model, setModel] = useState(firstAvailable);
	const [duration, setDuration] = useState(5);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<GeneratedVideo | null>(null);
	const [aiDecision, setAiDecision] = useState<string | null>(null); // Show what AI decided
	const [generationPhase, setGenerationPhase] = useState<string>(""); // UI feedback

	// Storage state
	const [storedMediaId, setStoredMediaId] = useState<string | null>(null);
	const [storageStatus, setStorageStatus] = useState<"none" | "storing" | "stored" | "downloaded">("none");

	const character = getActiveCharacter();
	const modelConfig = VIDEO_MODELS[model];

	const handleGenerate = async () => {
		setGenerating(true);
		setError(null);
		setAiDecision(null);
		setStoredMediaId(null);
		setStorageStatus("none");

		try {
			let video: GeneratedVideo;

			if (mode === "selfie") {
				// AGENTIC WORKFLOW: AI decides the scene based on mood/persona
				setGenerationPhase(`${character.name} is deciding the scene...`);

				// Get current mood state
						const moodState = getMoodState();

				// Generate with agentic workflow - AI chooses scene/camera work
				const agenticResult = await generateAgenticVideo({
					sceneSuggestion: prompt || undefined,
					model,
					character,
					moodState,
					conversationContext,
					duration,
					onProgress: (status, attempt) => {
						const statusText =
							status === "queued"
								? "Queued for generation..."
								: status === "in_progress"
									? `Generating video... (${Math.floor((attempt * 5) / 60)}m ${(attempt * 5) % 60}s)`
									: status;
						setGenerationPhase(statusText);
					},
				});

				setAiDecision(agenticResult.aiSceneDecision);
				setGenerationPhase("Generating video... (this may take a moment)");

				video = agenticResult.video;
			} else {
				setGenerationPhase("Generating custom video...");
				video = await generateVideo({
					prompt,
					model,
					duration,
					onProgress: (status, attempt) => {
						const statusText =
							status === "queued"
								? "Queued..."
								: status === "in_progress"
									? `Generating... (${Math.floor((attempt * 5) / 60)}m ${(attempt * 5) % 60}s)`
									: status;
						setGenerationPhase(statusText);
					},
				});
			}

			setResult(video);
			setGenerationPhase("");
			onVideoGenerated?.(video);

			// AUTO-STORE to cloud
			setStorageStatus("storing");
			setGenerationPhase("Saving to cloud...");
			try {
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
				const filename = mode === "selfie" ? `${character.name}_video_${timestamp}.mp4` : `video_${timestamp}.mp4`;

				const storedFile = await storeMediaFromUrl(video.url, filename, "video/mp4", {
					model,
					prompt: mode === "selfie" ? aiDecision || prompt : prompt,
					character: mode === "selfie" ? character.name : undefined,
					duration: video.duration,
					resolution: video.resolution,
				});
				setStoredMediaId(storedFile.id);
				setStorageStatus("stored");
				setGenerationPhase("");
			} catch (storageError: any) {
				console.error("Storage error:", storageError);
				// Don't fail the whole operation, just note storage failed
				setStorageStatus("none");
				setGenerationPhase("");
			}
		} catch (e: any) {
			setError(e.message);
			setGenerationPhase("");
		} finally {
			setGenerating(false);
		}
	};

	const handleDownload = () => {
		if (!result?.url) {
			return;
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `${character.name}_video_${timestamp}.mp4`;

		// Create download link
		const a = document.createElement("a");
		a.href = result.url;
		a.download = filename;
		a.target = "_blank";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	// CUT: Download and delete from cloud
	const handleCut = async () => {
		if (!storedMediaId || !result?.url) {
			return;
		}

		try {
			// Download first
			handleDownload();

			// Then delete from cloud
			await deleteMedia(storedMediaId);
			setStoredMediaId(null);
			setStorageStatus("downloaded");
		} catch (e: any) {
			setError(`Failed to clear from cloud: ${e.message}`);
		}
	};

	// Download only (keep in cloud)
	const handleDownloadOnly = () => {
		handleDownload();
	};

	return (
		<div className="video-gen-panel">
			<div className="panel-header">
				<h3>🎬 Generate Video</h3>
				<button onClick={onClose} className="close-btn">
					✕
				</button>
			</div>

			{/* Mode Toggle */}
			<div className="mode-toggle">
				<button className={`mode-btn ${mode === "selfie" ? "active" : ""}`} onClick={() => setMode("selfie")}>
					🎬 {character.name} Video
				</button>
				<button className={`mode-btn ${mode === "custom" ? "active" : ""}`} onClick={() => setMode("custom")}>
					🎨 Custom Video
				</button>
			</div>

			{/* Model Selection */}
			<div className="form-group">
				<label>Model</label>
				<select value={model} onChange={(e) => setModel(e.target.value)} className="nexus-input">
					{Object.entries(VIDEO_MODELS).map(([id, config]) => (
						<option key={id} value={id}>
							{config.displayName} ({config.maxDuration}s max)
						</option>
					))}
				</select>
			</div>

			{/* Duration Slider */}
			<div className="form-group">
				<label>Duration: {duration} seconds</label>
				<input
					type="range"
					min={1}
					max={modelConfig?.maxDuration || 10}
					value={duration}
					onChange={(e) => setDuration(Number(e.target.value))}
					className="nexus-slider"
				/>
			</div>

			{/* Prompt Input */}
			<div className="form-group">
				<label>
					{mode === "selfie"
						? `Scene Suggestion (optional) - ${character.name} will decide the final scene & camera work`
						: "Prompt"}
				</label>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder={
						mode === "selfie"
							? "e.g., walking on the beach, dancing in the rain, sitting by a fireplace..."
							: "Describe the video scene you want to create..."
					}
					className="nexus-input"
					rows={3}
				/>
			</div>

			{/* Character Preview (Selfie Mode) */}
			{mode === "selfie" && (
				<div className="character-preview">
					<div className="preview-header">
						{character.iconPath ? (
							<img src={character.iconPath} alt={character.name} className="preview-icon" />
						) : (
							<span className="preview-icon">{character.iconEmoji}</span>
						)}
						<span className="preview-name">{character.name}</span>
					</div>
					<p className="preview-description">{character.descriptionSafe.slice(0, 200)}...</p>
				</div>
			)}

			{/* Error Display */}
			{error && <div className="form-error">⚠️ {error}</div>}

			{/* Generation Phase Feedback */}
			{generationPhase && (
				<div className="generation-phase">
					<span className="nexus-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
					{generationPhase}
				</div>
			)}

			{/* AI's Scene Decision (Agentic Workflow) */}
			{aiDecision && !generating && (
				<div className="ai-decision">
					<div className="ai-decision-header">
						{character.iconPath ? (
							<img src={character.iconPath} alt={character.name} className="ai-decision-icon" />
						) : (
							<span className="ai-decision-icon">{character.iconEmoji}</span>
						)}
						<span className="ai-decision-label">{character.name}'s Decision</span>
					</div>
					<p className="ai-decision-text">{aiDecision}</p>
				</div>
			)}

			{/* Generate Button */}
			<button
				onClick={handleGenerate}
				disabled={generating || (mode === "custom" && !prompt.trim())}
				className="nexus-btn nexus-btn-primary nexus-btn-full"
			>
				{generating ? (
					<>
						<span className="nexus-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
						{generationPhase || "Generating..."}
					</>
				) : (
					`Generate ${mode === "selfie" ? "Video" : "Custom Video"}`
				)}
			</button>

			{/* Cost Warning */}
			<div className="cost-warning">⚠️ Video generation uses more API credits than images. Duration affects cost.</div>

			{/* Result Display */}
			{result && (
				<div className="result-container">
					<video src={result.url} controls autoPlay loop className="result-video" />

					<div className="result-info">
						<span>
							📹 {result.duration}s • {result.resolution}
						</span>
					</div>

					{/* Storage Status Indicator */}
					{storageStatus !== "none" && (
						<div className={`storage-status ${storageStatus}`}>
							{storageStatus === "storing" && "☁️ Saving to cloud..."}
							{storageStatus === "stored" && "☁️ Saved to cloud"}
							{storageStatus === "downloaded" && "✅ Downloaded & cleared from cloud"}
						</div>
					)}

					<div className="result-actions">
						{storedMediaId ? (
							<>
								<button onClick={handleCut} className="nexus-btn nexus-btn-primary">
									💾 Download &amp; Clear Cloud
								</button>
								<button onClick={handleDownloadOnly} className="nexus-btn nexus-btn-secondary">
									📥 Download Only
								</button>
							</>
						) : (
							<button onClick={handleDownload} className="nexus-btn nexus-btn-secondary">
								💾 Download Video
							</button>
						)}
					</div>

					{storedMediaId && (
						<p className="result-hint">
							💡 <strong>Download &amp; Clear</strong> saves to your device and frees cloud space.
						</p>
					)}
				</div>
			)}

			<style jsx>{`
        .video-gen-panel {
          background: var(--glass-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
          max-width: 1100px;
          max-height: 90vh;
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
        
        .mode-toggle {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }
        
        .mode-btn {
          flex: 1;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          color: var(--secondary-text-color);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .mode-btn:hover {
          border-color: var(--accent-color);
        }
        
        .mode-btn.active {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
        
        .form-group {
          margin-bottom: var(--spacing-md);
        }
        
        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin-bottom: var(--spacing-xs);
        }
        
        .nexus-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--glass-bg-secondary);
          outline: none;
          cursor: pointer;
        }
        
        .character-preview {
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }
        
        .preview-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
        }
        
        .preview-icon {
          font-size: 1.5rem;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .preview-name {
          font-weight: 600;
          color: var(--accent-color);
        }
        
        .preview-description {
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin: 0;
        }
        
        .generation-phase {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--accent-color-subtle);
          border-radius: var(--border-radius);
          margin-bottom: var(--spacing-md);
          font-size: 0.875rem;
          color: var(--accent-color);
        }
        
        .ai-decision {
          background: linear-gradient(135deg, var(--glass-bg-secondary), var(--accent-color-subtle));
          border: 1px solid var(--accent-color);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }
        
        .ai-decision-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
          font-weight: 600;
        }
        
        .ai-decision-icon {
          font-size: 1.25rem;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .ai-decision-label {
          color: var(--accent-color);
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .ai-decision-text {
          margin: 0;
          font-style: italic;
          color: var(--main-text-color);
          line-height: 1.5;
        }
        
        .cost-warning {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          text-align: center;
          margin-top: var(--spacing-sm);
          padding: var(--spacing-xs);
          background: rgba(234, 179, 8, 0.1);
          border-radius: var(--border-radius);
        }
        
        .result-container {
          margin-top: var(--spacing-lg);
          text-align: center;
        }
        
        .result-video {
          max-width: 100%;
          border-radius: var(--border-radius);
          box-shadow: var(--glow-primary);
        }
        
        .result-info {
          margin-top: var(--spacing-sm);
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }
        
        .result-actions {
          margin-top: var(--spacing-md);
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .storage-status {
          font-size: 0.75rem;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--border-radius);
          margin-top: var(--spacing-sm);
        }
        
        .storage-status.storing {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
        
        .storage-status.stored {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        
        .storage-status.downloaded {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }
        
        .result-hint {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          margin-top: var(--spacing-sm);
          text-align: center;
        }
      `}</style>
		</div>
	);
}
