/**
 * Storage Management Component
 * 
 * Shows storage usage, lists media files, and enables "cut" downloads
 */

import { useState, useEffect } from 'react';
import {
  getStorageStatus,
  StorageStatus,
  StoredMedia,
  cutMedia,
  deleteMedia,
  formatBytes,
} from '../lib/storage';

interface StorageManagerProps {
  onClose?: () => void;
}

export default function StorageManager({ onClose }: StorageManagerProps) {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const s = await getStorageStatus();
      setStatus(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAndDelete = async (media: StoredMedia) => {
    setDownloading(media.id);
    try {
      await cutMedia(media.id);
      await loadStatus(); // Refresh
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteOnly = async (media: StoredMedia) => {
    if (!confirm(`Delete "${media.filename}"? This cannot be undone and you will lose the content forever.`)) {
      return;
    }
    
    try {
      await deleteMedia(media.id);
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="storage-manager">
        <div className="loading">
          <div className="nexus-spinner" />
          <p>Loading storage info...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="storage-manager">
        <p className="error">Failed to load storage status</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const { quota, mediaFiles, percentUsed, warningLevel, downloadRecommended } = status;

  return (
    <div className="storage-manager">
      {onClose && (
        <div className="header">
          <h3>💾 Storage Management</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
      )}

      {/* Storage Bar */}
      <div className="storage-overview">
        <div className="storage-bar-container">
          <div 
            className={`storage-bar storage-bar-${warningLevel}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <div className="storage-stats">
          <span className="storage-used">{formatBytes(quota.used)}</span>
          <span className="storage-divider">/</span>
          <span className="storage-limit">{formatBytes(quota.limit)}</span>
          <span className="storage-percent">({percentUsed}%)</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="storage-breakdown">
        <div className="breakdown-item">
          <span className="breakdown-label">📚 RAG Data</span>
          <span className="breakdown-value">{formatBytes(quota.ragUsed)}</span>
          <span className="breakdown-note">(stays in cloud)</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">🖼️ Media Files</span>
          <span className="breakdown-value">{formatBytes(quota.mediaUsed)}</span>
          <span className="breakdown-note">(download & delete)</span>
        </div>
      </div>

      {/* Warning Messages */}
      {warningLevel === 'critical' && (
        <div className="alert alert-critical">
          ⚠️ Storage almost full! Download your media files to free up space.
        </div>
      )}
      
      {warningLevel === 'warning' && (
        <div className="alert alert-warning">
          📦 Storage getting full. Consider downloading older media files.
        </div>
      )}

      {downloadRecommended && warningLevel === 'ok' && (
        <div className="alert alert-info">
          💡 You have media files ready to download. Remember: the value is in the signed local files!
        </div>
      )}

      {/* Media Files List */}
      <div className="media-section">
        <h4>🖼️ Generated Media ({mediaFiles.length} files)</h4>
        
        {mediaFiles.length === 0 ? (
          <p className="no-media">No media files in cloud storage. Generate some images!</p>
        ) : (
          <div className="media-list">
            {mediaFiles.map(media => (
              <div key={media.id} className={`media-item ${media.downloaded ? 'downloaded' : ''}`}>
                <div className="media-info">
                  <div className="media-name">{media.filename}</div>
                  <div className="media-meta">
                    {formatBytes(media.size)} • {media.createdAt.toLocaleDateString()}
                    {media.downloaded && <span className="badge-downloaded">✓ Downloaded</span>}
                  </div>
                </div>
                
                <div className="media-actions">
                  <button
                    onClick={() => handleDownloadAndDelete(media)}
                    disabled={downloading === media.id}
                    className="nexus-btn nexus-btn-primary nexus-btn-sm"
                    title="Download file + metadata, then delete from cloud"
                  >
                    {downloading === media.id ? '...' : '📥 Cut'}
                  </button>
                  <button
                    onClick={() => handleDeleteOnly(media)}
                    disabled={downloading === media.id}
                    className="nexus-btn nexus-btn-secondary nexus-btn-sm"
                    title="Delete without downloading (data lost!)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Philosophy Note */}
      <div className="philosophy-note">
        <h4>📋 Storage Philosophy</h4>
        <p>
          <strong>Cloud storage is temporary.</strong> Generated media should be downloaded 
          with its provenance metadata sidecar. The "Cut" button downloads both files and 
          removes them from the cloud - like taking a photo from the booth.
        </p>
        <p>
          <strong>The value is in the signed files you keep!</strong> The metadata sidecar 
          proves you created this content with Elara. Keep both files together.
        </p>
      </div>

      {error && (
        <div className="alert alert-critical">{error}</div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .storage-manager {
    background: var(--glass-bg-primary);
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    max-width: 600px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .header h3 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--secondary-text-color);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .storage-overview {
    margin-bottom: var(--spacing-lg);
  }

  .storage-bar-container {
    height: 12px;
    background: var(--glass-bg-secondary);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: var(--spacing-sm);
  }

  .storage-bar {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 6px;
  }

  .storage-bar-ok {
    background: linear-gradient(90deg, var(--accent-color), var(--color-secondary));
  }

  .storage-bar-warning {
    background: linear-gradient(90deg, #f59e0b, #f97316);
  }

  .storage-bar-critical {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .storage-stats {
    display: flex;
    gap: var(--spacing-xs);
    font-size: 0.875rem;
  }

  .storage-used {
    font-weight: 600;
    color: var(--accent-color);
  }

  .storage-divider {
    color: var(--secondary-text-color);
  }

  .storage-limit {
    color: var(--secondary-text-color);
  }

  .storage-percent {
    color: var(--secondary-text-color);
    font-size: 0.75rem;
  }

  .storage-breakdown {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--glass-bg-secondary);
    border-radius: var(--border-radius);
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .breakdown-label {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
  }

  .breakdown-value {
    font-weight: 600;
  }

  .breakdown-note {
    font-size: 0.625rem;
    color: var(--secondary-text-color);
    opacity: 0.7;
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

  .alert-info {
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: var(--accent-color);
  }

  .media-section {
    margin-bottom: var(--spacing-lg);
  }

  .media-section h4 {
    margin: 0 0 var(--spacing-md);
    font-size: 1rem;
  }

  .no-media {
    color: var(--secondary-text-color);
    font-style: italic;
    text-align: center;
    padding: var(--spacing-lg);
  }

  .media-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-height: 300px;
    overflow-y: auto;
  }

  .media-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--glass-bg-secondary);
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius);
  }

  .media-item.downloaded {
    opacity: 0.7;
  }

  .media-info {
    flex: 1;
    min-width: 0;
  }

  .media-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .media-meta {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .badge-downloaded {
    color: var(--accent-color);
    font-size: 0.625rem;
  }

  .media-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .philosophy-note {
    background: var(--glass-bg-secondary);
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    font-size: 0.875rem;
  }

  .philosophy-note h4 {
    margin: 0 0 var(--spacing-sm);
    font-size: 0.875rem;
  }

  .philosophy-note p {
    margin: 0 0 var(--spacing-sm);
    color: var(--secondary-text-color);
    line-height: 1.5;
  }

  .philosophy-note p:last-child {
    margin-bottom: 0;
  }

  .error {
    color: #fca5a5;
  }
`;
