/**
 * File Converter Panel - Convert files for AI ingestion
 *
 * PORTED FROM DESKTOP: file-converter/file-converter.js
 *
 * Features:
 * - Convert text/code files to markdown
 * - Convert images between formats
 * - Batch conversion support
 * - Direct injection into Knowledge Base
 */

import { useRef, useState } from "react";
import {
	batchConvertToMarkdown,
	type ConversionResult,
	convertImage,
	formatBytes,
	type ImageConversionOptions,
	type ImageConversionResult,
	isImageFile,
} from "../lib/fileConverter";
import { ingestKnowledgeFile } from "../lib/rag";

interface FileConverterProps {
	isOpen: boolean;
	onClose: () => void;
}

type ConvertMode = "text" | "image";

export default function FileConverter({ isOpen, onClose }: FileConverterProps) {
	const [mode, setMode] = useState<ConvertMode>("text");
	const [files, setFiles] = useState<File[]>([]);
	const [converting, setConverting] = useState(false);
	const [results, setResults] = useState<(ConversionResult | ImageConversionResult)[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Image options
	const [imageFormat, setImageFormat] = useState<"png" | "jpeg" | "webp">("png");
	const [imageQuality, setImageQuality] = useState(92);
	const [maxWidth, setMaxWidth] = useState<number | "">("");
	const [maxHeight, setMaxHeight] = useState<number | "">("");

	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(e.target.files || []);
		setFiles(selectedFiles);
		setResults([]);
		setError(null);
		setSuccess(null);
	};

	const handleConvert = async () => {
		if (files.length === 0) {
			return;
		}

		setConverting(true);
		setError(null);
		setSuccess(null);
		setResults([]);

		try {
			if (mode === "text") {
				const conversionResults = await batchConvertToMarkdown(files);
				setResults(conversionResults);

				const successCount = conversionResults.filter((r) => r.success).length;
				if (successCount > 0) {
					setSuccess(`Converted ${successCount} of ${files.length} files`);
				}
			} else {
				// Image conversion
				const options: ImageConversionOptions = {
					format: imageFormat,
					quality: imageQuality / 100,
					maxWidth: maxWidth || undefined,
					maxHeight: maxHeight || undefined,
				};

				const conversionResults: ImageConversionResult[] = [];
				for (const file of files) {
					if (isImageFile(file.name)) {
						const result = await convertImage(file, options);
						conversionResults.push(result);
					}
				}
				setResults(conversionResults);

				const successCount = conversionResults.filter((r) => r.success).length;
				if (successCount > 0) {
					setSuccess(`Converted ${successCount} of ${files.length} images`);
				}
			}
		} catch (e: any) {
			setError(e.message || "Conversion failed");
		} finally {
			setConverting(false);
		}
	};

	const handleIngestToKnowledge = async (result: ConversionResult) => {
		if (!result.success || !result.markdown) {
			return;
		}

		try {
			// Create a file-like object for ingestion
			const blob = new Blob([result.markdown], { type: "text/markdown" });
			const file = new File([blob], result.filename.replace(/\.[^.]+$/, ".md"), {
				type: "text/markdown",
			});

			await ingestKnowledgeFile(file);
			setSuccess(`"${result.filename}" added to Knowledge Base!`);
		} catch (e: any) {
			setError(e.message || "Failed to add to Knowledge Base");
		}
	};

	const handleDownload = (result: ConversionResult | ImageConversionResult) => {
		if (!result.success) {
			return;
		}

		if ("markdown" in result && result.markdown) {
			// Download markdown
			const blob = new Blob([result.markdown], { type: "text/markdown" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = result.filename.replace(/\.[^.]+$/, ".md");
			a.click();
			URL.revokeObjectURL(url);
		} else if ("dataUrl" in result && result.dataUrl) {
			// Download image
			const a = document.createElement("a");
			a.href = result.dataUrl;
			a.download = `converted.${imageFormat}`;
			a.click();
		}
	};

	const handleClear = () => {
		setFiles([]);
		setResults([]);
		setError(null);
		setSuccess(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	if (!isOpen) {
		return null;
	}

	const acceptedFormats =
		mode === "text"
			? ".txt,.md,.json,.csv,.xml,.yaml,.yml,.html,.htm,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.swift,.css,.scss,.vue,.svelte,.sql,.sh,.ps1"
			: ".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg";

	return (
		<div className="converter-overlay" onClick={onClose}>
			<div className="converter-panel" onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="conv-header">
					<div className="conv-title">
						<span className="conv-icon">🔄</span>
						<h2>File Converter</h2>
					</div>
					<button className="conv-close" onClick={onClose}>
						×
					</button>
				</div>

				{/* Mode Tabs */}
				<div className="conv-tabs">
					<button
						className={`conv-tab ${mode === "text" ? "active" : ""}`}
						onClick={() => {
							setMode("text");
							handleClear();
						}}
					>
						📄 Text → Markdown
					</button>
					<button
						className={`conv-tab ${mode === "image" ? "active" : ""}`}
						onClick={() => {
							setMode("image");
							handleClear();
						}}
					>
						🖼️ Image Converter
					</button>
				</div>

				<div className="conv-content">
					{/* File Selection */}
					<div className="conv-section">
						<label className="conv-label">Select Files:</label>
						<div className="conv-file-input-wrapper">
							<input
								ref={fileInputRef}
								type="file"
								multiple
								accept={acceptedFormats}
								onChange={handleFileSelect}
								className="conv-file-input"
							/>
							<div className="conv-file-hint">
								{mode === "text"
									? "Supported: .txt, .md, .json, .csv, .html, .js, .ts, .py, and more code files"
									: "Supported: .png, .jpg, .jpeg, .gif, .webp, .bmp, .svg"}
							</div>
						</div>
					</div>

					{/* Selected Files List */}
					{files.length > 0 && (
						<div className="conv-section">
							<label className="conv-label">Selected ({files.length} files):</label>
							<div className="conv-file-list">
								{files.map((file, i) => (
									<div key={i} className="conv-file-item">
										<span className="conv-file-name">{file.name}</span>
										<span className="conv-file-size">{formatBytes(file.size)}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Image Options */}
					{mode === "image" && files.length > 0 && (
						<div className="conv-section conv-options">
							<label className="conv-label">Output Options:</label>

							<div className="conv-option-row">
								<label>Format:</label>
								<select value={imageFormat} onChange={(e) => setImageFormat(e.target.value as any)}>
									<option value="png">PNG (lossless)</option>
									<option value="jpeg">JPEG (lossy)</option>
									<option value="webp">WebP (modern)</option>
								</select>
							</div>

							{(imageFormat === "jpeg" || imageFormat === "webp") && (
								<div className="conv-option-row">
									<label>Quality: {imageQuality}%</label>
									<input
										type="range"
										min="10"
										max="100"
										value={imageQuality}
										onChange={(e) => setImageQuality(parseInt(e.target.value, 10))}
									/>
								</div>
							)}

							<div className="conv-option-row">
								<label>Max Width:</label>
								<input
									type="number"
									placeholder="No limit"
									value={maxWidth}
									onChange={(e) => setMaxWidth(e.target.value ? parseInt(e.target.value, 10) : "")}
								/>
							</div>

							<div className="conv-option-row">
								<label>Max Height:</label>
								<input
									type="number"
									placeholder="No limit"
									value={maxHeight}
									onChange={(e) => setMaxHeight(e.target.value ? parseInt(e.target.value, 10) : "")}
								/>
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="conv-actions">
						<button
							className="conv-btn conv-btn-primary"
							onClick={handleConvert}
							disabled={converting || files.length === 0}
						>
							{converting ? "Converting..." : `Convert ${files.length} File${files.length !== 1 ? "s" : ""}`}
						</button>
						<button className="conv-btn conv-btn-secondary" onClick={handleClear} disabled={converting}>
							Clear
						</button>
					</div>

					{/* Messages */}
					{error && <div className="conv-message conv-error">❌ {error}</div>}
					{success && <div className="conv-message conv-success">✅ {success}</div>}

					{/* Results */}
					{results.length > 0 && (
						<div className="conv-section conv-results">
							<label className="conv-label">Results:</label>
							<div className="conv-results-list">
								{results.map((result, i) => (
									<div key={i} className={`conv-result-item ${result.success ? "success" : "error"}`}>
										{"filename" in result && <div className="conv-result-name">{result.filename}</div>}

										{result.success ? (
											<div className="conv-result-details">
												<span>
													{formatBytes(result.originalSize)} → {formatBytes(result.convertedSize || 0)}
												</span>
												{"width" in result && result.width && (
													<span>
														{result.width}×{result.height}px
													</span>
												)}
											</div>
										) : (
											<div className="conv-result-error">{result.error}</div>
										)}

										{result.success && (
											<div className="conv-result-actions">
												<button className="conv-btn-small" onClick={() => handleDownload(result)}>
													💾 Download
												</button>
												{mode === "text" && "markdown" in result && (
													<button
														className="conv-btn-small conv-btn-knowledge"
														onClick={() => handleIngestToKnowledge(result as ConversionResult)}
													>
														🧠 Add to Knowledge
													</button>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<style jsx>{`
          .converter-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
          }

          .converter-panel {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(100, 255, 218, 0.3);
            border-radius: 16px;
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .conv-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(100, 255, 218, 0.2);
            background: rgba(0, 0, 0, 0.2);
          }

          .conv-title {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .conv-title h2 {
            margin: 0;
            font-size: 1.3rem;
            color: #64ffda;
          }

          .conv-icon {
            font-size: 1.5rem;
          }

          .conv-close {
            background: none;
            border: none;
            color: #8892b0;
            font-size: 24px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .conv-close:hover {
            color: #ff6b6b;
            background: rgba(255, 107, 107, 0.1);
          }

          .conv-tabs {
            display: flex;
            border-bottom: 1px solid rgba(100, 255, 218, 0.2);
          }

          .conv-tab {
            flex: 1;
            padding: 12px;
            background: none;
            border: none;
            color: #8892b0;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.95rem;
          }

          .conv-tab:hover {
            background: rgba(100, 255, 218, 0.05);
            color: #ccd6f6;
          }

          .conv-tab.active {
            background: rgba(100, 255, 218, 0.1);
            color: #64ffda;
            border-bottom: 2px solid #64ffda;
          }

          .conv-content {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
          }

          .conv-section {
            margin-bottom: 20px;
          }

          .conv-label {
            display: block;
            color: #8892b0;
            font-size: 0.9rem;
            margin-bottom: 8px;
          }

          .conv-file-input-wrapper {
            position: relative;
          }

          .conv-file-input {
            width: 100%;
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 2px dashed rgba(100, 255, 218, 0.3);
            border-radius: 8px;
            color: #e6f1ff;
            cursor: pointer;
            transition: all 0.2s;
          }

          .conv-file-input:hover {
            border-color: #64ffda;
          }

          .conv-file-hint {
            margin-top: 8px;
            font-size: 0.8rem;
            color: #5a6a8a;
          }

          .conv-file-list {
            max-height: 150px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 8px;
          }

          .conv-file-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            border-bottom: 1px solid rgba(100, 255, 218, 0.1);
          }

          .conv-file-item:last-child {
            border-bottom: none;
          }

          .conv-file-name {
            color: #ccd6f6;
            font-size: 0.9rem;
          }

          .conv-file-size {
            color: #5a6a8a;
            font-size: 0.85rem;
          }

          .conv-options {
            background: rgba(0, 0, 0, 0.2);
            padding: 16px;
            border-radius: 8px;
          }

          .conv-option-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .conv-option-row:last-child {
            margin-bottom: 0;
          }

          .conv-option-row label {
            color: #8892b0;
            font-size: 0.9rem;
            min-width: 100px;
          }

          .conv-option-row select,
          .conv-option-row input[type="number"] {
            flex: 1;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 4px;
            color: #e6f1ff;
            font-size: 0.9rem;
          }

          .conv-option-row input[type="range"] {
            flex: 1;
          }

          .conv-actions {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
          }

          .conv-btn {
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
          }

          .conv-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .conv-btn-primary {
            background: linear-gradient(135deg, #64ffda 0%, #00bcd4 100%);
            color: #0a192f;
            font-weight: 600;
            flex: 1;
          }

          .conv-btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(100, 255, 218, 0.3);
          }

          .conv-btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ccd6f6;
            border: 1px solid rgba(100, 255, 218, 0.2);
          }

          .conv-btn-secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
          }

          .conv-message {
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .conv-error {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
          }

          .conv-success {
            background: rgba(100, 255, 218, 0.1);
            border: 1px solid rgba(100, 255, 218, 0.3);
            color: #64ffda;
          }

          .conv-results-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .conv-result-item {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 12px;
            border-left: 3px solid #64ffda;
          }

          .conv-result-item.error {
            border-left-color: #ff6b6b;
          }

          .conv-result-name {
            color: #ccd6f6;
            font-weight: 500;
            margin-bottom: 4px;
          }

          .conv-result-details {
            display: flex;
            gap: 16px;
            color: #5a6a8a;
            font-size: 0.85rem;
            margin-bottom: 8px;
          }

          .conv-result-error {
            color: #ff6b6b;
            font-size: 0.9rem;
          }

          .conv-result-actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
          }

          .conv-btn-small {
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.85rem;
            background: rgba(100, 255, 218, 0.1);
            border: 1px solid rgba(100, 255, 218, 0.3);
            color: #64ffda;
            cursor: pointer;
            transition: all 0.2s;
          }

          .conv-btn-small:hover {
            background: rgba(100, 255, 218, 0.2);
          }

          .conv-btn-knowledge {
            background: rgba(255, 193, 7, 0.1);
            border-color: rgba(255, 193, 7, 0.3);
            color: #ffc107;
          }

          .conv-btn-knowledge:hover {
            background: rgba(255, 193, 7, 0.2);
          }
        `}</style>
			</div>
		</div>
	);
}
