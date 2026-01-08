/**
 * CustomEndpointModal - Configuration UI for BYOEndpoint
 * 
 * ⚠️ IMPORTANT: This is for OpenAI-compatible REST APIs ONLY.
 * No guarantees. No branded presets. User must configure manually.
 * Chat only - NOT for image/video generation.
 */

import { useState, useEffect } from 'react';
import { type CustomEndpoint } from '@/lib/byok';

interface CustomEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (endpoint: CustomEndpoint) => void;
  editEndpoint?: CustomEndpoint | null;
}

export default function CustomEndpointModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editEndpoint 
}: CustomEndpointModalProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [chatEndpoint, setChatEndpoint] = useState('');
  const [customPayload, setCustomPayload] = useState('');
  const [overridePayload, setOverridePayload] = useState(false);
  const [payloadTemplate, setPayloadTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (editEndpoint) {
      setName(editEndpoint.name);
      setApiKey(editEndpoint.apiKey || '');
      setBaseUrl(editEndpoint.baseUrl || '');
      setChatEndpoint(editEndpoint.chatEndpoint || '');
      setCustomPayload(editEndpoint.customPayload || '');
      setOverridePayload(editEndpoint.overridePayload || false);
      setPayloadTemplate(editEndpoint.payloadTemplate || '');
      setEnabled(editEndpoint.enabled !== false);
    } else {
      // Clear form for new endpoint
      setName('');
      setApiKey('');
      setBaseUrl('');
      setChatEndpoint('');
      setCustomPayload('');
      setOverridePayload(false);
      setPayloadTemplate('');
      setEnabled(true);
    }
    setError('');
  }, [editEndpoint, isOpen]);

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!baseUrl.trim() && !chatEndpoint.trim()) {
      setError('Either Base URL or Chat Endpoint is required');
      return;
    }

    // Validate custom JSON if provided
    if (customPayload.trim() && !overridePayload) {
      try {
        JSON.parse(customPayload);
      } catch {
        setError('Custom payload must be valid JSON');
        return;
      }
    }

    // Validate template if override mode
    if (overridePayload && !payloadTemplate.trim()) {
      setError('Payload template is required when override is enabled');
      return;
    }

    const endpoint: CustomEndpoint = {
      name: name.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      chatEndpoint: chatEndpoint.trim() || undefined,
      customPayload: customPayload.trim() || undefined,
      overridePayload,
      payloadTemplate: payloadTemplate.trim() || undefined,
      enabled,
    };

    onSave(endpoint);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editEndpoint ? 'Edit Custom Endpoint' : 'Add Custom Endpoint'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          {/* Basic Configuration */}
          <div className="form-section">
            <h3>Basic Configuration</h3>
            
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Custom API"
                className="form-input"
              />
              <small>A friendly name for this endpoint (your choice)</small>
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional (leave empty for local servers)"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="form-input"
              />
              <small>Base URL for the API (we'll append /v1/chat/completions)</small>
            </div>

            <div className="form-group">
              <label>Chat Endpoint (Advanced)</label>
              <input
                type="text"
                value={chatEndpoint}
                onChange={(e) => setChatEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="form-input"
              />
              <small>Full URL for chat endpoint (overrides Base URL)</small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>

          {/* Payload Customization */}
          <div className="form-section">
            <h3>Payload Customization</h3>
            
            {!overridePayload ? (
              <div className="form-group">
                <label>Custom JSON Fields</label>
                <textarea
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  placeholder='{"nsfw": true, "top_k": 40}'
                  className="form-textarea"
                  rows={4}
                />
                <small>
                  Additional fields to merge into the standard payload (must be valid JSON)
                </small>
              </div>
            ) : (
              <div className="form-group">
                <label>Payload Template</label>
                <textarea
                  value={payloadTemplate}
                  onChange={(e) => setPayloadTemplate(e.target.value)}
                  placeholder={`{
  "model": "{{MODEL}}",
  "messages": {{MESSAGES}},
  "temperature": {{TEMPERATURE}},
  "max_tokens": {{MAX_TOKENS}},
  "your_custom_field": "value"
}`}
                  className="form-textarea"
                  rows={10}
                />
                <small>
                  Full payload template. Use placeholders: {`{{MODEL}}, {{MESSAGES}}, {{TEMPERATURE}}, {{MAX_TOKENS}}`}
                </small>
              </div>
            )}

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={overridePayload}
                  onChange={(e) => setOverridePayload(e.target.checked)}
                />
                <span>Advanced: Full Payload Override</span>
              </label>
              <small>
                Use a custom template instead of standard OpenAI format
              </small>
            </div>
          </div>

          {/* Compatibility Warning */}
          <div className="form-section warning-section">
            <div className="compatibility-warning">
              <h4>⚠️ Compatibility Disclaimer</h4>
              <p>
                This system works ONLY if your endpoint follows OpenAI-compatible REST API standards.
                We make no guarantees about any specific provider. If your endpoint doesn't match the expected
                format, requests will fail.
              </p>
              <p>
                <strong>CHAT ONLY:</strong> Custom endpoints are for chat/text generation only. 
                Image and video generation are NOT supported through custom endpoints.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {editEndpoint ? 'Update' : 'Add'} Endpoint
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
          }

          .modal-content {
            background: #1a1a2e;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          }

          .modal-header {
            padding: 20px;
            border-bottom: 1px solid #2d2d44;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modal-header h2 {
            margin: 0;
            color: #fff;
            font-size: 1.5rem;
          }

          .modal-close {
            background: none;
            border: none;
            color: #888;
            font-size: 2rem;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .modal-close:hover {
            color: #fff;
          }

          .modal-body {
            padding: 20px;
          }

          .form-section {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #2d2d44;
          }

          .form-section:last-child {
            border-bottom: none;
          }

          .form-section h3 {
            margin: 0 0 15px 0;
            color: #b19cd9;
            font-size: 1.1rem;
          }

          .form-group {
            margin-bottom: 15px;
          }

          .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #ccc;
            font-weight: 500;
          }

          .form-input,
          .form-textarea {
            width: 100%;
            padding: 10px;
            background: #0f0f1e;
            border: 1px solid #2d2d44;
            border-radius: 6px;
            color: #fff;
            font-family: monospace;
            font-size: 0.95rem;
          }

          .form-input:focus,
          .form-textarea:focus {
            outline: none;
            border-color: #b19cd9;
          }

          .form-group small {
            display: block;
            margin-top: 5px;
            color: #888;
            font-size: 0.85rem;
          }

          .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
          }

          .checkbox-label input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .error-message {
            background: rgba(255, 59, 48, 0.1);
            border: 1px solid rgba(255, 59, 48, 0.3);
            color: #ff3b30;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 15px;
          }

          .warning-section {
            border-color: rgba(255, 149, 0, 0.3);
          }

          .compatibility-warning {
            background: rgba(255, 149, 0, 0.1);
            border: 1px solid rgba(255, 149, 0, 0.3);
            border-radius: 8px;
            padding: 15px;
          }

          .compatibility-warning h4 {
            margin: 0 0 10px 0;
            color: #ff9500;
            font-size: 1rem;
          }

          .compatibility-warning p {
            margin: 8px 0;
            font-size: 0.875rem;
            line-height: 1.6;
            color: #ddd;
          }

          .compatibility-warning strong {
            color: #ff9500;
          }

          .modal-footer {
            padding: 20px;
            border-top: 1px solid #2d2d44;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
          }

          .btn-primary,
          .btn-secondary {
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #b19cd9;
            border: none;
            color: #000;
          }

          .btn-primary:hover {
            background: #c8b3eb;
            transform: translateY(-2px);
          }

          .btn-secondary {
            background: transparent;
            border: 1px solid #2d2d44;
            color: #ccc;
          }

          .btn-secondary:hover {
            background: #2d2d44;
            color: #fff;
          }
        `}</style>
      </div>
    </div>
  );
}
