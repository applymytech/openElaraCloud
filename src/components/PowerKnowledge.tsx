/**
 * Power Knowledge Panel - Web Search & Research
 * 
 * PORTED FROM DESKTOP: power-knowledge/power-knowledge.js
 * 
 * Provides Exa.ai-powered web search capabilities:
 * - Power Search: Find web content
 * - Power Read: Crawl and extract from URLs
 * - Power Similar: Find similar pages
 * - Power Answer: AI-generated answers
 * - Deep Research: Long-form research reports
 */

import { useState, useEffect } from 'react';
import {
  isExaConfigured,
  runExaTask,
  formatExaResultForChat,
  type ExaTaskType,
  type ExaResult,
  type ExaSearchOptions,
  type ResearchStatus,
} from '../lib/exa';

interface PowerKnowledgeProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

// Task definitions with descriptions
const TASKS: { id: ExaTaskType; name: string; icon: string; placeholder: string; description: string }[] = [
  {
    id: 'search',
    name: 'Power Search',
    icon: '🔍',
    placeholder: 'Enter search query (e.g., "latest AI developments")',
    description: 'Search the web for relevant content with highlights',
  },
  {
    id: 'crawl',
    name: 'Power Read',
    icon: '📖',
    placeholder: 'Enter URL to read and summarize',
    description: 'Extract and summarize content from any webpage',
  },
  {
    id: 'similar',
    name: 'Power Similar',
    icon: '🔗',
    placeholder: 'Enter URL to find similar content',
    description: 'Find pages similar to the given URL',
  },
  {
    id: 'answer',
    name: 'Power Answer',
    icon: '💡',
    placeholder: 'Enter question to answer',
    description: 'Get an AI-generated answer with source citations',
  },
  {
    id: 'research',
    name: 'Deep Research',
    icon: '🔬',
    placeholder: 'Enter research topic or question',
    description: 'Comprehensive research report (takes 1-5 minutes)',
  },
];

export default function PowerKnowledge({ isOpen, onClose, onSendToChat }: PowerKnowledgeProps) {
  const [configured, setConfigured] = useState(false);
  const [activeTask, setActiveTask] = useState<ExaTaskType | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [researchProgress, setResearchProgress] = useState<number>(0);
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numResults, setNumResults] = useState(5);
  const [includeDomains, setIncludeDomains] = useState('');
  const [excludeDomains, setExcludeDomains] = useState('');
  const [startDate, setStartDate] = useState('');
  const [livecrawl, setLivecrawl] = useState<'fallback' | 'always' | 'never'>('fallback');

  useEffect(() => {
    if (isOpen) {
      setConfigured(isExaConfigured());
    }
  }, [isOpen]);

  const handleExecute = async () => {
    if (!activeTask || !query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setResearchProgress(0);

    const options: ExaSearchOptions = {
      numResults,
      includeDomains: includeDomains.split(',').map(d => d.trim()).filter(d => d),
      excludeDomains: excludeDomains.split(',').map(d => d.trim()).filter(d => d),
      startDate: startDate || undefined,
      livecrawl,
    };

    const onProgress = (status: ResearchStatus) => {
      setResearchProgress(status.progress || 0);
    };

    try {
      const taskResult = await runExaTask(activeTask, query.trim(), options, onProgress);
      setResult(taskResult);
      
      if (!taskResult.success) {
        setError(taskResult.error || 'Task failed');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToChat = () => {
    if (result && onSendToChat) {
      const formatted = formatExaResultForChat(result);
      onSendToChat(formatted);
      onClose();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    setError(null);
    setResearchProgress(0);
    setActiveTask(null);
  };

  if (!isOpen) return null;

  const selectedTask = TASKS.find(t => t.id === activeTask);

  return (
    <div className="power-knowledge-overlay" onClick={onClose}>
      <div className="power-knowledge-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pk-header">
          <div className="pk-title">
            <span className="pk-icon">🧠</span>
            <h2>Power Knowledge</h2>
          </div>
          <button className="pk-close" onClick={onClose}>×</button>
        </div>

        {!configured ? (
          <div className="pk-not-configured">
            <div className="pk-warning-icon">⚠️</div>
            <h3>Exa.ai API Key Required</h3>
            <p>Power Knowledge uses Exa.ai for web search and research capabilities.</p>
            <p>Add your Exa.ai API key in <strong>Settings → API Keys</strong> to enable this feature.</p>
            <a href="https://exa.ai" target="_blank" rel="noopener noreferrer" className="pk-link">
              Get an Exa.ai API key →
            </a>
          </div>
        ) : (
          <div className="pk-content">
            {/* Task Selection */}
            <div className="pk-tasks">
              <div className="pk-tasks-label">Select Operation:</div>
              <div className="pk-task-grid">
                {TASKS.map(task => (
                  <button
                    key={task.id}
                    className={`pk-task-btn ${activeTask === task.id ? 'active' : ''}`}
                    onClick={() => setActiveTask(task.id)}
                    disabled={loading}
                  >
                    <span className="pk-task-icon">{task.icon}</span>
                    <span className="pk-task-name">{task.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Query Input */}
            {activeTask && (
              <div className="pk-query-section">
                <div className="pk-task-description">
                  {selectedTask?.icon} {selectedTask?.description}
                </div>
                
                <textarea
                  className="pk-input"
                  placeholder={selectedTask?.placeholder}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={loading}
                  rows={3}
                />

                {/* Advanced Options Toggle */}
                <button 
                  className="pk-advanced-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? '▼' : '▶'} Advanced Options
                </button>

                {showAdvanced && (
                  <div className="pk-advanced-options">
                    <div className="pk-option-row">
                      <label>Results:</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={numResults}
                        onChange={e => setNumResults(parseInt(e.target.value) || 5)}
                        disabled={loading}
                      />
                    </div>
                    <div className="pk-option-row">
                      <label>Include Domains:</label>
                      <input
                        type="text"
                        placeholder="example.com, news.com"
                        value={includeDomains}
                        onChange={e => setIncludeDomains(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="pk-option-row">
                      <label>Exclude Domains:</label>
                      <input
                        type="text"
                        placeholder="spam.com, ads.com"
                        value={excludeDomains}
                        onChange={e => setExcludeDomains(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="pk-option-row">
                      <label>After Date:</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    {activeTask === 'crawl' && (
                      <div className="pk-option-row">
                        <label>Live Crawl:</label>
                        <select
                          value={livecrawl}
                          onChange={e => setLivecrawl(e.target.value as any)}
                          disabled={loading}
                        >
                          <option value="fallback">Fallback (use cache if available)</option>
                          <option value="always">Always (fresh crawl)</option>
                          <option value="never">Never (cache only)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pk-actions">
                  <button
                    className="pk-btn pk-btn-primary"
                    onClick={handleExecute}
                    disabled={loading || !query.trim()}
                  >
                    {loading ? (
                      activeTask === 'research' ? (
                        `Researching... ${Math.round(researchProgress)}%`
                      ) : (
                        'Processing...'
                      )
                    ) : (
                      `Execute ${selectedTask?.name}`
                    )}
                  </button>
                  <button
                    className="pk-btn pk-btn-secondary"
                    onClick={handleClear}
                    disabled={loading}
                  >
                    Clear
                  </button>
                </div>

                {/* Progress Bar for Research */}
                {loading && activeTask === 'research' && (
                  <div className="pk-progress">
                    <div 
                      className="pk-progress-bar" 
                      style={{ width: `${researchProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="pk-error">
                <span className="pk-error-icon">❌</span>
                {error}
              </div>
            )}

            {/* Results Display */}
            {result && result.success && (
              <div className="pk-results">
                <div className="pk-results-header">
                  <h3>Results</h3>
                  {onSendToChat && (
                    <button className="pk-btn pk-btn-send" onClick={handleSendToChat}>
                      📤 Send to Chat
                    </button>
                  )}
                </div>

                {/* Answer/Content */}
                {result.answer && (
                  <div className="pk-answer">
                    <pre>{result.answer}</pre>
                  </div>
                )}

                {/* Search Results */}
                {result.results && result.results.length > 0 && (
                  <div className="pk-search-results">
                    {result.results.map((r, i) => (
                      <div key={i} className="pk-result-item">
                        <div className="pk-result-title">
                          {i + 1}. {r.title}
                        </div>
                        <a 
                          href={r.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="pk-result-url"
                        >
                          {r.url}
                        </a>
                        {r.score && (
                          <span className="pk-result-score">
                            Score: {r.score.toFixed(3)}
                          </span>
                        )}
                        {r.highlights && r.highlights.length > 0 && (
                          <div className="pk-result-highlight">
                            "{r.highlights[0]}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Source URLs */}
                {result.sourceUrls && result.sourceUrls.length > 0 && !result.results && (
                  <div className="pk-sources">
                    <strong>Sources:</strong>
                    <ul>
                      {result.sourceUrls.map((url, i) => (
                        <li key={i}>
                          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <style jsx>{`
          .power-knowledge-overlay {
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

          .power-knowledge-panel {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(100, 255, 218, 0.3);
            border-radius: 16px;
            width: 90%;
            max-width: 800px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .pk-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(100, 255, 218, 0.2);
            background: rgba(0, 0, 0, 0.2);
          }

          .pk-title {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .pk-title h2 {
            margin: 0;
            font-size: 1.3rem;
            color: #64ffda;
          }

          .pk-icon {
            font-size: 1.5rem;
          }

          .pk-close {
            background: none;
            border: none;
            color: #8892b0;
            font-size: 24px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .pk-close:hover {
            color: #ff6b6b;
            background: rgba(255, 107, 107, 0.1);
          }

          .pk-content {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
          }

          .pk-not-configured {
            padding: 40px;
            text-align: center;
            color: #8892b0;
          }

          .pk-warning-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .pk-not-configured h3 {
            color: #ccd6f6;
            margin-bottom: 12px;
          }

          .pk-not-configured p {
            margin: 8px 0;
            line-height: 1.6;
          }

          .pk-link {
            display: inline-block;
            margin-top: 16px;
            color: #64ffda;
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid #64ffda;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .pk-link:hover {
            background: rgba(100, 255, 218, 0.1);
          }

          .pk-tasks {
            margin-bottom: 20px;
          }

          .pk-tasks-label {
            color: #8892b0;
            font-size: 0.9rem;
            margin-bottom: 10px;
          }

          .pk-task-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 10px;
          }

          .pk-task-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 8px;
            color: #ccd6f6;
            cursor: pointer;
            transition: all 0.2s;
          }

          .pk-task-btn:hover:not(:disabled) {
            border-color: rgba(100, 255, 218, 0.5);
            background: rgba(100, 255, 218, 0.1);
          }

          .pk-task-btn.active {
            border-color: #64ffda;
            background: rgba(100, 255, 218, 0.15);
          }

          .pk-task-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .pk-task-icon {
            font-size: 1.5rem;
          }

          .pk-task-name {
            font-size: 0.85rem;
          }

          .pk-query-section {
            margin-top: 20px;
          }

          .pk-task-description {
            color: #8892b0;
            font-size: 0.9rem;
            margin-bottom: 12px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
          }

          .pk-input {
            width: 100%;
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 8px;
            color: #e6f1ff;
            font-size: 1rem;
            resize: vertical;
            font-family: inherit;
          }

          .pk-input:focus {
            outline: none;
            border-color: #64ffda;
          }

          .pk-input::placeholder {
            color: #5a6a8a;
          }

          .pk-advanced-toggle {
            background: none;
            border: none;
            color: #8892b0;
            font-size: 0.85rem;
            cursor: pointer;
            padding: 8px 0;
            margin-top: 8px;
            transition: color 0.2s;
          }

          .pk-advanced-toggle:hover {
            color: #64ffda;
          }

          .pk-advanced-options {
            margin-top: 12px;
            padding: 16px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .pk-option-row {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .pk-option-row label {
            color: #8892b0;
            font-size: 0.9rem;
            min-width: 120px;
          }

          .pk-option-row input,
          .pk-option-row select {
            flex: 1;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 4px;
            color: #e6f1ff;
            font-size: 0.9rem;
          }

          .pk-option-row input:focus,
          .pk-option-row select:focus {
            outline: none;
            border-color: #64ffda;
          }

          .pk-option-row input[type="number"] {
            width: 80px;
            flex: none;
          }

          .pk-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }

          .pk-btn {
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
          }

          .pk-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .pk-btn-primary {
            background: linear-gradient(135deg, #64ffda 0%, #00bcd4 100%);
            color: #0a192f;
            font-weight: 600;
            flex: 1;
          }

          .pk-btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(100, 255, 218, 0.3);
          }

          .pk-btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ccd6f6;
            border: 1px solid rgba(100, 255, 218, 0.2);
          }

          .pk-btn-secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
          }

          .pk-btn-send {
            background: rgba(100, 255, 218, 0.2);
            color: #64ffda;
            border: 1px solid #64ffda;
            padding: 8px 16px;
            font-size: 0.9rem;
          }

          .pk-btn-send:hover {
            background: rgba(100, 255, 218, 0.3);
          }

          .pk-progress {
            margin-top: 12px;
            height: 6px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            overflow: hidden;
          }

          .pk-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #64ffda 0%, #00bcd4 100%);
            transition: width 0.3s ease;
          }

          .pk-error {
            margin-top: 16px;
            padding: 12px;
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 8px;
            color: #ff6b6b;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .pk-results {
            margin-top: 20px;
            padding: 16px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(100, 255, 218, 0.2);
          }

          .pk-results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .pk-results-header h3 {
            margin: 0;
            color: #64ffda;
          }

          .pk-answer {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
          }

          .pk-answer pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #e6f1ff;
            font-family: inherit;
            line-height: 1.6;
          }

          .pk-search-results {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .pk-result-item {
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            border-left: 3px solid #64ffda;
          }

          .pk-result-title {
            color: #ccd6f6;
            font-weight: 500;
            margin-bottom: 4px;
          }

          .pk-result-url {
            color: #64ffda;
            font-size: 0.85rem;
            text-decoration: none;
            word-break: break-all;
          }

          .pk-result-url:hover {
            text-decoration: underline;
          }

          .pk-result-score {
            display: inline-block;
            margin-left: 12px;
            color: #5a6a8a;
            font-size: 0.8rem;
          }

          .pk-result-highlight {
            margin-top: 8px;
            color: #8892b0;
            font-size: 0.9rem;
            font-style: italic;
            padding-left: 12px;
            border-left: 2px solid #5a6a8a;
          }

          .pk-sources {
            margin-top: 16px;
            color: #8892b0;
          }

          .pk-sources ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
          }

          .pk-sources li {
            margin: 4px 0;
          }

          .pk-sources a {
            color: #64ffda;
            text-decoration: none;
            word-break: break-all;
          }

          .pk-sources a:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>
    </div>
  );
}
