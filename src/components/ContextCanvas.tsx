/**
 * Context Canvas Component
 * 
 * Desktop-style persistent document viewer for OpenElara Cloud.
 * Users can pin files that stay in context across the conversation.
 * 
 * Features:
 * - Pin/unpin files with zero truncation
 * - Token counter and budget tracking (up to 75% of context window)
 * - Last modified tracking for change detection
 * - Clear visual separation of documents
 */

import { useState, useEffect, useRef } from 'react';
import {
  loadContextCanvas,
  pinFile,
  unpinFile,
  clearCanvas,
  getPinnedFiles,
  getCanvasStats,
  getTokenStats,
  buildFullCanvasContext,
  type ContextCanvasFile,
  MAX_FILE_SIZE,
  MAX_FILES,
  DEFAULT_MAX_TOKENS,
  SUPPORTED_EXTENSIONS,
} from '../lib/contextCanvas';

interface ContextCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  maxTokenBudget?: number;
}

export default function ContextCanvas({ 
  isOpen, 
  onClose, 
  maxTokenBudget = DEFAULT_MAX_TOKENS 
}: ContextCanvasProps) {
  const [files, setFiles] = useState<ContextCanvasFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tokenStats, setTokenStats] = useState({ usedTokens: 0, maxTokens: maxTokenBudget, usagePercent: 0, remainingTokens: maxTokenBudget });
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load canvas on mount
  useEffect(() => {
    if (isOpen) {
      loadCanvas();
    }
  }, [isOpen]);

  const loadCanvas = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadContextCanvas();
      setFiles(getPinnedFiles());
      setTokenStats(getTokenStats(maxTokenBudget));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (uploadedFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(uploadedFiles);
    
    for (const file of fileArray) {
      try {
        await pinFile(file);
      } catch (e: any) {
        setError(e.message);
        break;
      }
    }
    
    setFiles(getPinnedFiles());
    setTokenStats(getTokenStats(maxTokenBudget));
  };

  const handleUnpin = async (filename: string) => {
    try {
      await unpinFile(filename);
      setFiles(getPinnedFiles());
      setTokenStats(getTokenStats(maxTokenBudget));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all pinned files from the context canvas?')) return;
    try {
      await clearCanvas();
      setFiles([]);
      setTokenStats(getTokenStats(maxTokenBudget));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      await handleFileUpload(droppedFiles);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="context-canvas-overlay" onClick={onClose}>
      <div className="context-canvas-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="canvas-header">
          <div className="canvas-title">
            <span className="canvas-icon">📌</span>
            <h3>Context Canvas</h3>
            <span className="canvas-subtitle">Persistent documents for AI reference</span>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Token Budget Bar */}
        <div className="token-budget-section">
          <div className="token-budget-header">
            <span className="token-label">Token Budget</span>
            <span className="token-count">
              {tokenStats.usedTokens.toLocaleString()} / {tokenStats.maxTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="token-budget-bar">
            <div 
              className={`token-budget-fill ${tokenStats.usagePercent > 90 ? 'warning' : ''} ${tokenStats.usagePercent > 100 ? 'exceeded' : ''}`}
              style={{ width: `${Math.min(tokenStats.usagePercent, 100)}%` }}
            />
          </div>
          <div className="token-budget-hint">
            {tokenStats.usagePercent < 75 
              ? `${tokenStats.remainingTokens.toLocaleString()} tokens available (75% max recommended)`
              : tokenStats.usagePercent < 100
              ? '⚠️ Approaching token limit - consider unpinning some files'
              : '🚨 Token limit exceeded - some files may be excluded'}
          </div>
        </div>

        {/* Drop Zone */}
        <div 
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={SUPPORTED_EXTENSIONS.join(',')}
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            style={{ display: 'none' }}
          />
          <div className="drop-zone-content">
            <span className="drop-icon">📂</span>
            <span className="drop-text">
              {dragging 
                ? 'Drop files here!' 
                : 'Drag & drop files or click to upload'}
            </span>
            <span className="drop-hint">
              Max {formatBytes(MAX_FILE_SIZE)} per file • {MAX_FILES} files max • Supported: .txt, .md, .json, .js, .ts, .py, etc.
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="canvas-error">
            ⚠️ {error}
          </div>
        )}

        {/* File List */}
        <div className="canvas-files">
          {loading ? (
            <div className="canvas-loading">Loading canvas...</div>
          ) : files.length === 0 ? (
            <div className="canvas-empty">
              <span className="empty-icon">📄</span>
              <p>No files pinned yet</p>
              <p className="empty-hint">Pin documents here to keep them in context throughout your conversation. Unlike file attachments, these persist until you unpin them.</p>
            </div>
          ) : (
            <>
              <div className="files-header">
                <span>{files.length} file{files.length !== 1 ? 's' : ''} pinned</span>
                <button className="clear-all-btn" onClick={handleClearAll}>
                  Clear All
                </button>
              </div>
              <div className="files-list">
                {files.map((file) => (
                  <div key={file.id} className="canvas-file">
                    <div 
                      className="file-header"
                      onClick={() => setExpandedFile(expandedFile === file.filename ? null : file.filename)}
                    >
                      <div className="file-info">
                        <span className="file-icon">
                          {file.metadata?.language === 'javascript' || file.metadata?.language === 'typescript' ? '📜' :
                           file.metadata?.language === 'python' ? '🐍' :
                           file.metadata?.language === 'markdown' ? '📝' :
                           file.metadata?.language === 'json' ? '📋' : '📄'}
                        </span>
                        <div className="file-details">
                          <span className="file-name">{file.filename}</span>
                          <span className="file-meta">
                            {file.metadata?.language || 'text'} • {file.metadata?.lineCount} lines • {formatBytes(file.size)}
                          </span>
                        </div>
                      </div>
                      <div className="file-actions">
                        <span className="file-modified" title={`Last modified: ${file.updatedAt.toLocaleString()}`}>
                          {file.updatedAt.toLocaleDateString()}
                        </span>
                        <button 
                          className="unpin-btn" 
                          onClick={(e) => { e.stopPropagation(); handleUnpin(file.filename); }}
                          title="Unpin file"
                        >
                          📌
                        </button>
                        <span className="expand-icon">
                          {expandedFile === file.filename ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    {expandedFile === file.filename && (
                      <div className="file-content-preview">
                        <pre>{file.content.slice(0, 2000)}{file.content.length > 2000 ? '\n... (preview truncated)' : ''}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer with info */}
        <div className="canvas-footer">
          <div className="footer-info">
            <span className="info-icon">💡</span>
            <span>Files in the Context Canvas are sent to the AI with ZERO truncation. Token counter helps you stay within model limits.</span>
          </div>
        </div>

        <style jsx>{`
          .context-canvas-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .context-canvas-panel {
            background: var(--secondary-bg-color);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .canvas-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--glass-border);
            background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          }

          .canvas-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .canvas-icon {
            font-size: 24px;
          }

          .canvas-title h3 {
            margin: 0;
            font-size: 1.25rem;
            color: var(--accent-color);
          }

          .canvas-subtitle {
            font-size: 0.85rem;
            color: var(--secondary-text-color);
          }

          .close-btn {
            background: transparent;
            border: none;
            color: var(--main-text-color);
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s ease;
          }

          .close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--error-color);
          }

          /* Token Budget */
          .token-budget-section {
            padding: 12px 20px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid var(--glass-border);
          }

          .token-budget-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.85rem;
          }

          .token-label {
            color: var(--secondary-text-color);
          }

          .token-count {
            color: var(--main-text-color);
            font-weight: 600;
          }

          .token-budget-bar {
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
          }

          .token-budget-fill {
            height: 100%;
            background: linear-gradient(90deg, #00d4ff, #8b5cf6);
            transition: width 0.3s ease;
          }

          .token-budget-fill.warning {
            background: linear-gradient(90deg, #f59e0b, #ef4444);
          }

          .token-budget-fill.exceeded {
            background: #ef4444;
          }

          .token-budget-hint {
            margin-top: 6px;
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          /* Drop Zone */
          .drop-zone {
            margin: 16px 20px;
            padding: 24px;
            border: 2px dashed var(--glass-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
          }

          .drop-zone:hover, .drop-zone.dragging {
            border-color: var(--accent-color);
            background: rgba(0, 212, 255, 0.05);
          }

          .drop-zone-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }

          .drop-icon {
            font-size: 32px;
          }

          .drop-text {
            font-size: 1rem;
            color: var(--main-text-color);
          }

          .drop-hint {
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          /* Error */
          .canvas-error {
            margin: 0 20px 16px;
            padding: 12px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 8px;
            color: #ef4444;
            font-size: 0.875rem;
          }

          /* Files Section */
          .canvas-files {
            flex: 1;
            overflow-y: auto;
            padding: 0 20px 16px;
          }

          .canvas-loading, .canvas-empty {
            text-align: center;
            padding: 40px 20px;
            color: var(--secondary-text-color);
          }

          .empty-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .empty-hint {
            font-size: 0.85rem;
            margin-top: 8px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
          }

          .files-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-size: 0.875rem;
            color: var(--secondary-text-color);
          }

          .clear-all-btn {
            background: transparent;
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            padding: 4px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.75rem;
            transition: all 0.2s ease;
          }

          .clear-all-btn:hover {
            background: rgba(239, 68, 68, 0.1);
          }

          .files-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .canvas-file {
            background: var(--glass-bg-secondary);
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            overflow: hidden;
          }

          .file-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            cursor: pointer;
            transition: background 0.2s ease;
          }

          .file-header:hover {
            background: rgba(255, 255, 255, 0.05);
          }

          .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .file-icon {
            font-size: 24px;
          }

          .file-details {
            display: flex;
            flex-direction: column;
          }

          .file-name {
            font-weight: 600;
            color: var(--main-text-color);
          }

          .file-meta {
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          .file-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .file-modified {
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          .unpin-btn {
            background: transparent;
            border: none;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.6;
            transition: all 0.2s ease;
          }

          .unpin-btn:hover {
            opacity: 1;
            transform: scale(1.1);
          }

          .expand-icon {
            font-size: 10px;
            color: var(--secondary-text-color);
          }

          .file-content-preview {
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid var(--glass-border);
            max-height: 200px;
            overflow: auto;
          }

          .file-content-preview pre {
            margin: 0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.75rem;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
            color: #d1d5db;
          }

          /* Footer */
          .canvas-footer {
            padding: 12px 20px;
            border-top: 1px solid var(--glass-border);
            background: rgba(0, 0, 0, 0.2);
          }

          .footer-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          .info-icon {
            font-size: 16px;
          }
        `}</style>
      </div>
    </div>
  );
}
