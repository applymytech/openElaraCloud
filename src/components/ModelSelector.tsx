/**
 * ModelSelector Component - Enhanced Model Selection Modal
 * 
 * Features:
 * - Provider detection from available API keys
 * - Tabbed interface for each provider
 * - Free models at top, then grouped by publisher
 * - Star/favorite system with localStorage persistence
 * - Custom REST API support
 */

import { useState, useEffect, useMemo } from 'react';
import { getAllAPIKeys } from '@/lib/byok';
import { CHAT_MODEL_METADATA, type ChatModelMetadata, type Model } from '@/lib/models';

// ============================================================================
// TYPES
// ============================================================================

interface ModelSelectorProps {
  currentModel: string;
  availableModels: Model[];
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

interface GroupedModel extends Model {
  publisher: string;
  isFavorite: boolean;
  isFree: boolean;
}

type Provider = 'together' | 'openrouter' | 'custom';

// ============================================================================
// FAVORITES MANAGEMENT
// ============================================================================

const FAVORITES_KEY = 'elara_favorite_models';

function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

function toggleFavorite(modelId: string): void {
  if (typeof window === 'undefined') return;
  const favorites = getFavorites();
  if (favorites.has(modelId)) {
    favorites.delete(modelId);
  } else {
    favorites.add(modelId);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
}

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

function detectAvailableProviders(): Provider[] {
  const keys = getAllAPIKeys();
  const providers: Provider[] = [];
  
  if (keys.together) providers.push('together');
  if (keys.openrouter) providers.push('openrouter');
  
  // Check for custom REST API keys (stored with custom_ prefix)
  if (typeof window !== 'undefined') {
    const customKeys = Object.keys(localStorage).filter(k => k.startsWith('elara_apikey_custom_'));
    if (customKeys.length > 0) providers.push('custom');
  }
  
  return providers;
}

function getProviderName(provider: Provider): string {
  switch (provider) {
    case 'together': return '🚀 Together.ai';
    case 'openrouter': return '🌐 OpenRouter';
    case 'custom': return '⚙️ Custom API';
    default: return provider;
  }
}

function detectModelProvider(modelId: string): Provider {
  // Check metadata first
  const meta = CHAT_MODEL_METADATA[modelId];
  
  // Together.ai models (meta-llama, mistralai, deepseek, qwen, etc.)
  if (modelId.includes('meta-llama') || 
      modelId.includes('mistralai') || 
      modelId.includes('deepseek') ||
      modelId.includes('Qwen') ||
      modelId.includes('ServiceNow') ||
      modelId.includes('google') ||
      modelId.includes('NousResearch') ||
      modelId.includes('Liquid') ||
      modelId.includes('databricks')) {
    return 'together';
  }
  
  // OpenRouter models (anthropic, openai, google, etc.)
  if (modelId.includes('anthropic') || 
      modelId.includes('openai') || 
      modelId.startsWith('gpt-')) {
    return 'openrouter';
  }
  
  // Custom models
  if (modelId.startsWith('custom/')) {
    return 'custom';
  }
  
  // Default: check what keys are available
  const providers = detectAvailableProviders();
  return providers[0] || 'together';
}

// ============================================================================
// MODEL GROUPING & SORTING
// ============================================================================

function extractPublisher(modelId: string): string {
  // Extract publisher from model ID (format: publisher/model-name)
  const parts = modelId.split('/');
  if (parts.length > 1) {
    const publisher = parts[0];
    // Clean up publisher names
    if (publisher === 'meta-llama') return 'Meta';
    if (publisher === 'mistralai') return 'Mistral AI';
    if (publisher === 'deepseek-ai') return 'DeepSeek';
    if (publisher === 'ServiceNow-AI') return 'ServiceNow';
    if (publisher === 'NousResearch') return 'Nous Research';
    return publisher.split('-')[0]; // Take first part for compound names
  }
  return 'Other';
}

function groupAndSortModels(models: Model[], favorites: Set<string>): GroupedModel[] {
  return models.map(model => {
    const meta = model.metadata as ChatModelMetadata;
    return {
      ...model,
      publisher: extractPublisher(model.id),
      isFavorite: favorites.has(model.id),
      isFree: meta?.free || false,
    };
  }).sort((a, b) => {
    // 1. Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    
    // 2. Free models next
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    
    // 3. Then by publisher (alphabetical)
    const pubCompare = a.publisher.localeCompare(b.publisher);
    if (pubCompare !== 0) return pubCompare;
    
    // 4. Finally by name within publisher
    return (a.metadata?.displayName || a.id).localeCompare(b.metadata?.displayName || b.id);
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ModelSelector({ currentModel, availableModels, onSelect, onClose }: ModelSelectorProps) {
  const [activeTab, setActiveTab] = useState<Provider>('together');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const availableProviders = useMemo(() => detectAvailableProviders(), []);
  
  useEffect(() => {
    setFavorites(getFavorites());
    // Set initial tab to first available provider
    if (availableProviders.length > 0 && !availableProviders.includes(activeTab)) {
      setActiveTab(availableProviders[0]);
    }
  }, [availableProviders]);
  
  const handleToggleFavorite = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(modelId);
    setFavorites(getFavorites());
  };
  
  // Filter models by provider and search
  const filteredModels = useMemo(() => {
    let models = availableModels.filter(m => detectModelProvider(m.id) === activeTab);
    
    // Add fallback models from metadata if API fetch failed
    if (models.length === 0) {
      models = Object.entries(CHAT_MODEL_METADATA)
        .filter(([id]) => detectModelProvider(id) === activeTab)
        .map(([id, meta]) => ({
          id,
          type: 'chat' as const,
          displayName: meta.displayName,
          metadata: meta,
          fallback: true,
        }));
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      models = models.filter(m => 
        m.id.toLowerCase().includes(query) ||
        (m.metadata?.displayName || '').toLowerCase().includes(query) ||
        (m.metadata?.description || '').toLowerCase().includes(query) ||
        extractPublisher(m.id).toLowerCase().includes(query)
      );
    }
    
    return groupAndSortModels(models, favorites);
  }, [activeTab, availableModels, searchQuery, favorites]);
  
  // Group by publisher for section headers
  const modelsByPublisher = useMemo(() => {
    const grouped = new Map<string, GroupedModel[]>();
    
    // Favorites section
    const favs = filteredModels.filter(m => m.isFavorite);
    if (favs.length > 0) {
      grouped.set('⭐ Favorites', favs);
    }
    
    // Free section
    const free = filteredModels.filter(m => m.isFree && !m.isFavorite);
    if (free.length > 0) {
      grouped.set('🆓 Free Models', free);
    }
    
    // Group by publisher
    const remaining = filteredModels.filter(m => !m.isFavorite && !m.isFree);
    remaining.forEach(model => {
      const pub = model.publisher;
      if (!grouped.has(pub)) {
        grouped.set(pub, []);
      }
      grouped.get(pub)!.push(model);
    });
    
    return grouped;
  }, [filteredModels]);
  
  return (
    <div className="model-selector-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>🤖 Select Chat Model</h2>
        <button className="modal-close-btn" onClick={onClose}>×</button>
      </div>
      
      {/* Provider Tabs */}
      <div className="provider-tabs">
        {availableProviders.map(provider => (
          <button
            key={provider}
            className={`provider-tab ${activeTab === provider ? 'active' : ''}`}
            onClick={() => setActiveTab(provider)}
          >
            {getProviderName(provider)}
          </button>
        ))}
      </div>
      
      {/* Search Bar */}
      <div className="model-search">
        <input
          type="text"
          placeholder="Search models by name, publisher, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      {/* Models Grid */}
      <div className="modal-body">
        {modelsByPublisher.size === 0 ? (
          <div className="no-models">
            <p>No models found for {getProviderName(activeTab)}</p>
            {!availableProviders.includes(activeTab) && (
              <p className="hint">Configure your API key in Settings to see available models</p>
            )}
          </div>
        ) : (
          Array.from(modelsByPublisher.entries()).map(([publisher, models]) => (
            <div key={publisher} className="publisher-group">
              <h3 className="publisher-header">{publisher}</h3>
              <div className="model-selector-grid">
                {models.map(model => {
                  const meta = model.metadata as ChatModelMetadata;
                  return (
                    <button
                      key={model.id}
                      className={`model-card ${model.id === currentModel ? 'active' : ''} ${model.isFavorite ? 'favorited' : ''}`}
                      onClick={() => onSelect(model.id)}
                    >
                      <div className="model-card-header">
                        <span className="model-card-name">
                          {meta?.displayName || model.displayName || model.id.split('/').pop()}
                        </span>
                        <button 
                          className={`favorite-btn ${model.isFavorite ? 'active' : ''}`}
                          onClick={(e) => handleToggleFavorite(model.id, e)}
                          title={model.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {model.isFavorite ? '⭐' : '☆'}
                        </button>
                      </div>
                      
                      <div className="model-card-badges">
                        {model.id === currentModel && <span className="model-badge current">✓ ACTIVE</span>}
                        {model.isFree && <span className="model-badge free">FREE</span>}
                        {meta?.recommended && <span className="model-badge rec">RECOMMENDED</span>}
                        {meta?.thinking && <span className="model-badge thinking">THINKING</span>}
                        {meta?.supportsTools && <span className="model-badge tools">TOOLS</span>}
                      </div>
                      
                      {meta?.description && (
                        <div className="model-card-description">{meta.description}</div>
                      )}
                      
                      {meta?.contextLength && (
                        <div className="model-card-meta">
                          Context: {meta.contextLength.toLocaleString()} tokens
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      
      <style jsx>{`
        .model-selector-modal {
          background: var(--secondary-bg-color);
          border-radius: 12px;
          max-width: 900px;
          width: 90vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--glass-border);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          background: linear-gradient(135deg, #a78bfa, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .modal-close-btn {
          background: transparent;
          border: none;
          color: var(--secondary-text-color);
          font-size: 32px;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        
        .modal-close-btn:hover {
          background: var(--glass-bg-hover);
          color: var(--error-color);
        }
        
        /* Provider Tabs */
        .provider-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 24px 0 24px;
          background: var(--secondary-bg-color);
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
        }
        
        .provider-tab {
          padding: 10px 20px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--secondary-text-color);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .provider-tab:hover {
          color: var(--accent-color);
          background: var(--glass-bg-hover);
        }
        
        .provider-tab.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }
        
        /* Search Bar */
        .model-search {
          padding: 16px 24px;
          background: var(--secondary-bg-color);
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
        }
        
        .search-input {
          width: 100%;
          padding: 10px 16px;
          background: var(--main-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          color: var(--main-text-color);
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .search-input:focus {
          outline: none;
          border-color: var(--accent-color);
          background: var(--secondary-bg-color);
        }
        
        .search-input::placeholder {
          color: var(--secondary-text-color);
        }
        
        /* Modal Body */
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        
        .no-models {
          text-align: center;
          padding: 40px 20px;
          color: var(--secondary-text-color);
        }
        
        .no-models p {
          margin: 8px 0;
        }
        
        .hint {
          font-size: 13px;
          color: var(--tertiary-text-color);
        }
        
        /* Publisher Groups */
        .publisher-group {
          margin-bottom: 32px;
        }
        
        .publisher-group:last-child {
          margin-bottom: 0;
        }
        
        .publisher-header {
          font-size: 14px;
          font-weight: 600;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
          padding: 8px 12px;
          background: var(--glass-bg);
          border-radius: 6px;
          border-left: 3px solid var(--accent-color);
        }
        
        /* Model Grid */
        .model-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        
        .model-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .model-card:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
        }
        
        .model-card.active {
          background: rgba(139, 92, 246, 0.1);
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        .model-card.favorited {
          border-color: rgba(255, 193, 7, 0.3);
        }
        
        .model-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        
        .model-card-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--main-text-color);
          line-height: 1.3;
          flex: 1;
        }
        
        .favorite-btn {
          background: transparent;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          opacity: 0.4;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .favorite-btn:hover {
          opacity: 1;
          transform: scale(1.2);
        }
        
        .favorite-btn.active {
          opacity: 1;
          filter: drop-shadow(0 0 4px rgba(255, 193, 7, 0.6));
        }
        
        .model-card-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .model-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .model-badge.current {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        .model-badge.free {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        
        .model-badge.rec {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        
        .model-badge.thinking {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        
        .model-badge.tools {
          background: rgba(249, 115, 22, 0.15);
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.25);
        }
        
        .model-card-description {
          font-size: 12px;
          color: var(--secondary-text-color);
          line-height: 1.4;
        }
        
        .model-card-meta {
          font-size: 11px;
          color: var(--tertiary-text-color);
          margin-top: 4px;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .model-selector-modal {
            width: 95vw;
            max-height: 90vh;
          }
          
          .model-selector-grid {
            grid-template-columns: 1fr;
          }
          
          .provider-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          .provider-tab {
            white-space: nowrap;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}
