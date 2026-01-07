/**
 * Settings Page - Full Account & Configuration
 * 
 * Ported from desktop account.html with tabs:
 * - Account & Storage
 * - API Keys (BYOK)
 * - Characters & Emotions  
 * - Knowledge Base (RAG)
 * - About
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, sendPasswordResetEmail, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import dynamic from 'next/dynamic';
import ELARA from "@/lib/elara";
import { APP_VERSION, MANUAL_VERSION, LAST_UPDATED } from "@/lib/userManual";
import {
  getAllAPIKeys,
  saveAPIKey,
  removeAPIKey,
  hasOwnKeys,
  type APIKeys,
} from "../lib/byok";
import { 
  getStorageStatus, 
  formatBytes, 
  cutMedia, 
  deleteMedia,
  type StorageStatus,
  type StoredMedia
} from "../lib/storage";
import { getMoodTracker } from "../lib/mood";
import { getActiveCharacter, type Character } from "../lib/characters";
import { 
  getChatModels, 
  getImageModels,
  getSelectedModel, 
  setSelectedModel,
  getDefaultChatModel,
  getDefaultImageModel,
  CHAT_MODEL_METADATA,
  IMAGE_MODEL_METADATA,
  type Model,
  type ChatModelMetadata,
  type ImageModelMetadata,
} from "../lib/models";

// Dynamic imports to avoid SSR issues
const CharacterEditor = dynamic(() => import('@/components/CharacterEditor'), { ssr: false });
const KnowledgePanel = dynamic(() => import('@/components/KnowledgePanel'), { ssr: false });

// ============================================================================
// TYPES & CONFIG
// ============================================================================

type TabId = 'account' | 'keys' | 'characters' | 'knowledge' | 'about';

interface ProviderConfig {
  key: keyof APIKeys;
  name: string;
  description: string;
  placeholder: string;
  signupUrl: string;
  required: boolean;
  icon: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: "together",
    name: "Together.ai",
    description: "Image generation (FLUX) + TTS (Kokoro) + LLMs",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://together.ai",
    required: true,
    icon: "🚀",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models (Claude, GPT-4, Llama, etc.)",
    placeholder: "sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://openrouter.ai",
    required: true,
    icon: "🌐",
  },
  {
    key: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, DALL-E (optional)",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://platform.openai.com",
    required: false,
    icon: "🤖",
  },
  {
    key: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5 Sonnet, Claude 3 Opus (optional)",
    placeholder: "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://console.anthropic.com",
    required: false,
    icon: "🧠",
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    description: "Premium voice synthesis (optional)",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    signupUrl: "https://elevenlabs.io",
    required: false,
    icon: "🎙️",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('account');
  
  // Account state
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // BYOK state
  const [keys, setKeys] = useState<APIKeys>({});
  const [editingKey, setEditingKey] = useState<keyof APIKeys | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saved, setSaved] = useState(false);
  
  // Character state
  const [character, setCharacter] = useState<Character | null>(null);
  const [showCharacterEditor, setShowCharacterEditor] = useState(false);
  
  // Model selection state
  const [chatModels, setChatModels] = useState<Model[]>([]);
  const [imageModels, setImageModels] = useState<Model[]>([]);
  const [selectedChatModel, setSelectedChatModel] = useState<string>('');
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ============================================================================
  // LOAD DATA
  // ============================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      
      setUser(user);
      setKeys(getAllAPIKeys());
      setCharacter(getActiveCharacter());
      
      // Load selected models
      setSelectedChatModel(getSelectedModel('chat') || getDefaultChatModel());
      setSelectedImageModel(getSelectedModel('image') || getDefaultImageModel());
      
      // Load storage status
      try {
        const status = await getStorageStatus();
        setStorageStatus(status);
      } catch (e) {
        console.warn('Failed to load storage status:', e);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [router]);
  
  // Load models when API Keys tab is active and Together key exists
  useEffect(() => {
    if (activeTab === 'keys' && keys.together) {
      loadModels();
    }
  }, [activeTab, keys.together]);
  
  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const [chat, image] = await Promise.all([
        getChatModels(),
        getImageModels(),
      ]);
      setChatModels(chat);
      setImageModels(image);
    } catch (e) {
      console.warn('Failed to load models:', e);
      // Use fallback models from metadata
      setChatModels(Object.entries(CHAT_MODEL_METADATA).map(([id, meta]: [string, ChatModelMetadata]) => ({
        id,
        type: 'chat' as const,
        displayName: meta.displayName,
        metadata: meta,
        fallback: true,
      })));
      setImageModels(Object.entries(IMAGE_MODEL_METADATA).map(([id, meta]: [string, ImageModelMetadata]) => ({
        id,
        type: 'image' as const,
        displayName: meta.displayName,
        metadata: meta,
        fallback: true,
      })));
    } finally {
      setLoadingModels(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: 'Password reset email sent! Check your inbox.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleSaveKey = (provider: keyof APIKeys) => {
    if (inputValue.trim()) {
      saveAPIKey(provider, inputValue.trim());
      setKeys(getAllAPIKeys());
      setMessage({ type: 'success', text: `${String(provider)} key saved!` });
      // Refresh models if Together key was added
      if (provider === 'together') {
        loadModels();
      }
    }
    setEditingKey(null);
    setInputValue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRemoveKey = (provider: keyof APIKeys) => {
    if (confirm(`Remove ${String(provider)} API key?`)) {
      removeAPIKey(provider);
      setKeys(getAllAPIKeys());
    }
  };
  
  const handleSelectChatModel = (modelId: string) => {
    setSelectedModel('chat', modelId);
    setSelectedChatModel(modelId);
    setMessage({ type: 'success', text: `Chat model set to ${CHAT_MODEL_METADATA[modelId]?.displayName || modelId.split('/').pop()}` });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  const handleSelectImageModel = (modelId: string) => {
    setSelectedModel('image', modelId);
    setSelectedImageModel(modelId);
    setMessage({ type: 'success', text: `Image model set to ${IMAGE_MODEL_METADATA[modelId]?.displayName || modelId.split('/').pop()}` });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCutMedia = async (media: StoredMedia) => {
    setDownloading(media.id);
    try {
      await cutMedia(media.id);
      const status = await getStorageStatus();
      setStorageStatus(status);
      setMessage({ type: 'success', text: `Downloaded & removed ${media.filename}` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteMedia = async (media: StoredMedia) => {
    if (!confirm(`DELETE "${media.filename}" without downloading? This cannot be undone!`)) return;
    
    try {
      await deleteMedia(media.id);
      const status = await getStorageStatus();
      setStorageStatus(status);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="center-content">
        <div className="nexus-spinner" />
      </div>
    );
  }

  return (
    <div className="account-page">
      {/* Header */}
      <header className="header-bar">
        <div className="header-brand">
          <button onClick={() => router.push("/chat")} className="back-btn">
            ← Back to Chat
          </button>
        </div>
        <div className="header-title-center">
          <h1>Account & Configuration</h1>
        </div>
        <div className="header-actions">
          {saved && <span className="nexus-badge nexus-badge-success">✓ Saved</span>}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          👤 Account & Storage
        </button>
        <button 
          className={`tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          🔑 API Keys
        </button>
        <button 
          className={`tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
          onClick={() => setActiveTab('characters')}
        >
          🎭 Characters
        </button>
        <button 
          className={`tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          📚 Knowledge
        </button>
        <button 
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          ℹ️ About
        </button>
      </nav>

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="alert-close">×</button>
        </div>
      )}

      {/* Tab Content */}
      <main className="tab-content">
        
        {/* ACCOUNT & STORAGE TAB */}
        {activeTab === 'account' && (
          <div className="tab-panel">
            {/* User Info Card */}
            <div className="card">
              <div className="card-header">
                <h3>👤 Your Account</h3>
              </div>
              <div className="account-profile">
                <div className="avatar-large">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="profile-info">
                  <p className="profile-email">{user?.email}</p>
                  <p className="profile-uid">UID: {user?.uid.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="account-actions">
                <button onClick={handlePasswordReset} className="nexus-btn nexus-btn-secondary">
                  🔑 Reset Password
                </button>
                <button onClick={handleSignOut} className="nexus-btn nexus-btn-danger">
                  Sign Out
                </button>
              </div>
            </div>

            {/* Storage Card */}
            <div className="card">
              <div className="card-header">
                <h3>💾 Storage</h3>
                <span className="card-badge">
                  {storageStatus ? `${storageStatus.percentUsed}% used` : 'Loading...'}
                </span>
              </div>
              
              {storageStatus && (
                <>
                  <div className="storage-bar-container">
                    <div 
                      className={`storage-bar storage-${storageStatus.warningLevel}`}
                      style={{ width: `${Math.min(storageStatus.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="storage-stats">
                    <span>{formatBytes(storageStatus.quota.used)}</span>
                    <span className="storage-divider">/</span>
                    <span>{formatBytes(storageStatus.quota.limit)}</span>
                  </div>

                  <div className="storage-breakdown">
                    <div className="breakdown-item">
                      <span className="breakdown-icon">📚</span>
                      <div className="breakdown-info">
                        <span className="breakdown-label">RAG Data</span>
                        <span className="breakdown-value">{formatBytes(storageStatus.quota.ragUsed)}</span>
                      </div>
                      <span className="breakdown-note">stays in cloud</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-icon">🖼️</span>
                      <div className="breakdown-info">
                        <span className="breakdown-label">Media Files</span>
                        <span className="breakdown-value">{formatBytes(storageStatus.quota.mediaUsed)}</span>
                      </div>
                      <span className="breakdown-note">download & delete!</span>
                    </div>
                  </div>

                  <div className="info-box">
                    <h4>📦 Storage Philosophy</h4>
                    <p>
                      <strong>Cloud storage is TEMPORARY.</strong> Generated images and media should be 
                      <strong> downloaded with their provenance metadata</strong>, then removed from the cloud.
                    </p>
                    <p>
                      <strong>The value is in the signed local files!</strong> The metadata sidecar proves 
                      YOU created this content. Keep both files together.
                    </p>
                  </div>

                  {storageStatus.mediaFiles.length > 0 && (
                    <div className="media-section">
                      <h4>🖼️ Your Media ({storageStatus.mediaFiles.length} files)</h4>
                      <p className="media-hint">
                        ⚠️ <strong>Download these!</strong> Use the "Cut" button to download with metadata and free up space.
                      </p>
                      <div className="media-list">
                        {storageStatus.mediaFiles.map(media => (
                          <div key={media.id} className="media-item">
                            <div className="media-info">
                              <span className="media-name">{media.filename}</span>
                              <span className="media-meta">
                                {formatBytes(media.size)} • {new Date(media.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="media-actions">
                              <button
                                onClick={() => handleCutMedia(media)}
                                disabled={downloading === media.id}
                                className="nexus-btn nexus-btn-primary nexus-btn-sm"
                              >
                                {downloading === media.id ? '...' : '📥 Cut'}
                              </button>
                              <button
                                onClick={() => handleDeleteMedia(media)}
                                className="nexus-btn nexus-btn-ghost nexus-btn-sm"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {storageStatus.mediaFiles.length === 0 && (
                    <div className="empty-state">
                      <p>✨ No media files in cloud storage. Generate some images!</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === 'keys' && (
          <div className="tab-panel">
            <div className="card">
              <div className="card-header">
                <h3>🔑 Bring Your Own Keys (BYOK)</h3>
              </div>
              
              <div className="info-box info-box-security">
                <h4>🔒 Your Keys Are Safe</h4>
                <p>
                  API keys are stored <strong>only in your browser's localStorage</strong>. 
                  They are <strong>never transmitted to our servers</strong>. 
                  API calls go directly from your browser to the providers.
                </p>
              </div>

              {!hasOwnKeys() && (
                <div className="warning-box">
                  <strong>⚠️ No API keys configured</strong>
                  <p>Add at least Together.ai and OpenRouter keys to use {ELARA.NAME}.</p>
                </div>
              )}

              <div className="providers-grid">
                {PROVIDERS.map((provider) => (
                  <div key={String(provider.key)} className="provider-card">
                    <div className="provider-header">
                      <span className="provider-icon">{provider.icon}</span>
                      <div className="provider-title">
                        <h4>{provider.name}</h4>
                        {provider.required && <span className="badge-required">Required</span>}
                        {keys[provider.key] && <span className="badge-active">✓ Active</span>}
                      </div>
                    </div>
                    <p className="provider-description">{provider.description}</p>
                    
                    {editingKey === provider.key ? (
                      <div className="key-input-group">
                        <input
                          type="password"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={provider.placeholder}
                          className="nexus-input"
                          autoFocus
                        />
                        <div className="key-input-actions">
                          <button 
                            onClick={() => handleSaveKey(provider.key)}
                            className="nexus-btn nexus-btn-primary nexus-btn-sm"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => { setEditingKey(null); setInputValue(""); }}
                            className="nexus-btn nexus-btn-ghost nexus-btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="provider-actions">
                        {keys[provider.key] ? (
                          <>
                            <span className="key-preview">•••••••{keys[provider.key]?.slice(-4)}</span>
                            <button 
                              onClick={() => { setEditingKey(provider.key); setInputValue(keys[provider.key] || ""); }}
                              className="nexus-btn nexus-btn-secondary nexus-btn-sm"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleRemoveKey(provider.key)}
                              className="nexus-btn nexus-btn-ghost nexus-btn-sm"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <>
                            <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer" className="provider-link">
                              Get key →
                            </a>
                            <button 
                              onClick={() => setEditingKey(provider.key)}
                              className="nexus-btn nexus-btn-primary nexus-btn-sm"
                            >
                              Add Key
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Model Selection */}
            {keys.together && (
              <div className="card">
                <div className="card-header">
                  <h3>🤖 Model Selection</h3>
                  {loadingModels && <span className="badge-loading">Loading...</span>}
                </div>
                
                <div className="info-box">
                  <p>
                    Select your preferred AI models. These are stored locally and used for all chats and image generation.
                  </p>
                </div>
                
                {/* Chat Model */}
                <div className="model-section">
                  <h4>💬 Chat Model</h4>
                  <select 
                    className="nexus-input model-select"
                    value={selectedChatModel}
                    onChange={(e) => handleSelectChatModel(e.target.value)}
                    disabled={loadingModels}
                  >
                    <optgroup label="Recommended">
                      {chatModels.filter(m => m.metadata.recommended).map(model => (
                        <option key={model.id} value={model.id}>
                          {model.metadata.displayName || model.displayName || model.id.split('/').pop()}
                          {'free' in model.metadata && model.metadata.free ? ' (Free)' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Models">
                      {chatModels.filter(m => !m.metadata.recommended).map(model => (
                        <option key={model.id} value={model.id}>
                          {model.metadata.displayName || model.displayName || model.id.split('/').pop()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="model-description">
                    {CHAT_MODEL_METADATA[selectedChatModel]?.description || 'Custom model'}
                  </p>
                </div>
                
                {/* Image Model */}
                <div className="model-section">
                  <h4>🖼️ Image Model</h4>
                  <select 
                    className="nexus-input model-select"
                    value={selectedImageModel}
                    onChange={(e) => handleSelectImageModel(e.target.value)}
                    disabled={loadingModels}
                  >
                    <optgroup label="Recommended">
                      {imageModels.filter(m => m.metadata.recommended).map(model => (
                        <option key={model.id} value={model.id}>
                          {model.metadata.displayName || model.displayName || model.id.split('/').pop()}
                          {'free' in model.metadata && model.metadata.free ? ' (Free)' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Models">
                      {imageModels.filter(m => !m.metadata.recommended).map(model => (
                        <option key={model.id} value={model.id}>
                          {model.metadata.displayName || model.displayName || model.id.split('/').pop()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="model-description">
                    {IMAGE_MODEL_METADATA[selectedImageModel]?.description || 'Custom model'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHARACTERS TAB */}
        {activeTab === 'characters' && (
          <div className="tab-panel">
            {showCharacterEditor ? (
              <CharacterEditor 
                onClose={() => setShowCharacterEditor(false)}
                onCharacterSelected={(char) => {
                  setCharacter(char);
                  setShowCharacterEditor(false);
                }}
              />
            ) : (
              <>
                <div className="card">
                  <div className="card-header">
                    <h3>🎭 Active Character</h3>
                    <button 
                      onClick={() => setShowCharacterEditor(true)}
                      className="nexus-btn nexus-btn-secondary nexus-btn-sm"
                    >
                      Switch / Create
                    </button>
                  </div>
                  
                  {character && (
                    <div className="character-display">
                      <div className="character-avatar-large">{character.iconEmoji}</div>
                      <div className="character-info">
                        <h4>{character.name} {character.isBuiltIn && <span className="badge-builtin">Built-in</span>}</h4>
                        <p className="character-description">{character.descriptionSafe.slice(0, 150)}...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3>💜 Emotional State</h3>
                  </div>
                  
                  <div className="info-box">
                    <p>
                      {character?.name || 'Elara'} has an emotional system that responds to how you treat her. 
                      Praise improves mood, criticism decreases it. This affects her communication style naturally.
                    </p>
                  </div>
                  
                  {character && (() => {
                    const tracker = getMoodTracker();
                    const stats = tracker.getStats();
                    return (
                      <div className="mood-display">
                        <div className="mood-meter">
                          <div className="mood-bar-bg">
                            <div className="mood-bar-fill" style={{ width: `${stats.current}%` }} />
                          </div>
                          <div className="mood-labels">
                            <span>😢 0</span>
                            <span className="mood-current">{stats.current}</span>
                            <span>100 😊</span>
                          </div>
                        </div>
                        <div className="mood-stats">
                          <div className="mood-stat">
                            <span className="stat-label">Current</span>
                            <span className="stat-value">{stats.description}</span>
                          </div>
                          <div className="mood-stat">
                            <span className="stat-label">Baseline</span>
                            <span className="stat-value">{stats.baseline}/100</span>
                          </div>
                          <div className="mood-stat">
                            <span className="stat-label">Trend</span>
                            <span className="stat-value">{stats.trend}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* KNOWLEDGE TAB */}
        {activeTab === 'knowledge' && (
          <div className="tab-panel">
            <KnowledgePanel />
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div className="tab-panel">
            <div className="card">
              <div className="about-header">
                <img src="/icon.png" alt="OpenElara" className="about-logo-img" />
                <div className="about-info">
                  <h2>OpenElara Cloud</h2>
                  <p className="about-tagline">Sovereign AI Assistant • BYOK • Privacy-First</p>
                </div>
              </div>
              
              <div className="about-details">
                <div className="detail-row">
                  <span className="detail-label">App Version</span>
                  <span className="detail-value">{APP_VERSION}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Manual Version</span>
                  <span className="detail-value">{MANUAL_VERSION}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Updated</span>
                  <span className="detail-value">{LAST_UPDATED}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Platform</span>
                  <span className="detail-value">Next.js 16 + Firebase</span>
                </div>
              </div>
              
              <div className="about-philosophy">
                <h4>🏛️ Philosophy</h4>
                <ul>
                  <li><strong>Bring Your Own Keys</strong> - Your API keys, your accounts, your costs</li>
                  <li><strong>Privacy First</strong> - Keys stored locally, never on our servers</li>
                  <li><strong>Content Provenance</strong> - All generated content is signed with metadata</li>
                  <li><strong>Download & Own</strong> - Cloud is temporary; value is in your local files</li>
                </ul>
              </div>
              
              <div className="about-credits">
                <p>Built with 💜 as a sovereign AI tool</p>
                <p className="about-copyright">© 2026 OpenElara Project</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .account-page { min-height: 100vh; background: var(--main-bg-color); }
        .header-bar { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) var(--spacing-lg); background: var(--secondary-bg-color); border-bottom: 1px solid var(--glass-border); }
        .back-btn { background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 0.9rem; }
        .header-title-center h1 { font-size: 1.25rem; margin: 0; background: linear-gradient(135deg, #00d4ff 0%, #00ff88 50%, #00d4ff 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: gradient-shift 3s ease-in-out infinite; }
        @keyframes gradient-shift { 0%, 100% { background-position: 0% center; } 50% { background-position: 100% center; } }
        .tab-navigation { display: flex; gap: 4px; padding: var(--spacing-md) var(--spacing-lg); background: var(--secondary-bg-color); border-bottom: 2px solid var(--glass-border); overflow-x: auto; }
        .tab-btn { white-space: nowrap; padding: 10px 16px; background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%); border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; color: var(--secondary-text-color); font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .tab-btn:hover { background: linear-gradient(180deg, rgba(0, 212, 255, 0.1) 0%, transparent 100%); border-color: rgba(0, 212, 255, 0.3); }
        .tab-btn.active { background: linear-gradient(180deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 149, 255, 0.1) 100%); border-color: var(--accent-color); color: var(--accent-color); box-shadow: 0 0 20px rgba(0, 212, 255, 0.2); }
        .tab-content { max-width: 1000px; margin: 0 auto; padding: var(--spacing-lg); }
        .tab-panel { display: flex; flex-direction: column; gap: var(--spacing-lg); }
        .card { background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid var(--glass-border); border-radius: var(--border-radius-lg); padding: var(--spacing-lg); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md); }
        .card-header h3 { margin: 0; font-size: 1.1rem; }
        .card-badge { font-size: 0.75rem; color: var(--accent-color); }
        .account-profile { display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
        .avatar-large { width: 64px; height: 64px; background: linear-gradient(135deg, var(--accent-color), var(--color-secondary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; color: white; }
        .profile-email { margin: 0; font-weight: 600; }
        .profile-uid { margin: 4px 0 0; font-size: 0.75rem; color: var(--secondary-text-color); }
        .account-actions { display: flex; gap: var(--spacing-sm); }
        .storage-bar-container { height: 12px; background: var(--glass-bg-secondary); border-radius: 6px; overflow: hidden; margin-bottom: var(--spacing-sm); }
        .storage-bar { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
        .storage-ok { background: linear-gradient(90deg, var(--accent-color), var(--color-secondary)); }
        .storage-warning { background: linear-gradient(90deg, #f59e0b, #f97316); }
        .storage-critical { background: linear-gradient(90deg, #ef4444, #dc2626); }
        .storage-stats { display: flex; gap: var(--spacing-xs); font-size: 0.875rem; margin-bottom: var(--spacing-lg); }
        .storage-divider { color: var(--secondary-text-color); }
        .storage-breakdown { display: flex; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg); }
        .breakdown-item { display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm) var(--spacing-md); background: var(--glass-bg-secondary); border-radius: var(--border-radius); flex: 1; }
        .breakdown-icon { font-size: 1.25rem; }
        .breakdown-info { display: flex; flex-direction: column; }
        .breakdown-label { font-size: 0.75rem; color: var(--secondary-text-color); }
        .breakdown-value { font-weight: 600; }
        .breakdown-note { font-size: 0.625rem; color: var(--secondary-text-color); margin-left: auto; }
        .info-box { background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: var(--border-radius); padding: var(--spacing-md); margin-bottom: var(--spacing-md); }
        .info-box h4 { margin: 0 0 var(--spacing-sm); color: var(--accent-color); font-size: 0.9rem; }
        .info-box p { margin: 0 0 var(--spacing-sm); font-size: 0.875rem; color: var(--secondary-text-color); }
        .info-box p:last-child { margin-bottom: 0; }
        .info-box-security { background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); }
        .info-box-security h4 { color: #00ff88; }
        .warning-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--border-radius); padding: var(--spacing-md); margin-bottom: var(--spacing-md); color: #fcd34d; }
        .warning-box p { margin: var(--spacing-xs) 0 0; font-size: 0.875rem; }
        .alert { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm) var(--spacing-md); margin: 0 var(--spacing-lg) var(--spacing-md); border-radius: var(--border-radius); }
        .alert-success { background: rgba(0, 255, 136, 0.2); border: 1px solid rgba(0, 255, 136, 0.5); color: #00ff88; }
        .alert-error { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; }
        .alert-close { background: none; border: none; color: inherit; font-size: 1.25rem; cursor: pointer; }
        .media-section { margin-top: var(--spacing-lg); }
        .media-section h4 { margin: 0 0 var(--spacing-xs); }
        .media-hint { font-size: 0.875rem; color: #fcd34d; margin: 0 0 var(--spacing-md); }
        .media-list { display: flex; flex-direction: column; gap: var(--spacing-sm); max-height: 300px; overflow-y: auto; }
        .media-item { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm) var(--spacing-md); background: var(--glass-bg-secondary); border: 1px solid var(--glass-border); border-radius: var(--border-radius); }
        .media-info { display: flex; flex-direction: column; gap: 2px; }
        .media-name { font-weight: 500; }
        .media-meta { font-size: 0.75rem; color: var(--secondary-text-color); }
        .media-actions { display: flex; gap: var(--spacing-xs); }
        .empty-state { text-align: center; padding: var(--spacing-xl); color: var(--secondary-text-color); }
        .providers-grid { display: grid; gap: var(--spacing-md); }
        .provider-card { padding: var(--spacing-md); background: var(--glass-bg-secondary); border: 1px solid var(--glass-border); border-radius: var(--border-radius); }
        .provider-header { display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
        .provider-icon { font-size: 1.5rem; }
        .provider-title { display: flex; align-items: center; gap: var(--spacing-xs); }
        .provider-title h4 { margin: 0; }
        .badge-required { font-size: 0.625rem; background: var(--accent-color); color: white; padding: 2px 6px; border-radius: 10px; }
        .badge-active { font-size: 0.625rem; background: #00ff88; color: #000; padding: 2px 6px; border-radius: 10px; }
        .badge-loading { font-size: 0.625rem; background: var(--color-secondary); color: white; padding: 2px 6px; border-radius: 10px; animation: pulse 1s infinite; }
        .badge-builtin { font-size: 0.625rem; background: var(--color-secondary); color: white; padding: 2px 6px; border-radius: 10px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .model-section { margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-md); border-bottom: 1px solid var(--glass-border); }
        .model-section:last-child { border-bottom: none; margin-bottom: 0; }
        .model-section h4 { margin: 0 0 var(--spacing-sm); color: var(--accent-color); }
        .model-select { width: 100%; margin-bottom: var(--spacing-sm); }
        .model-description { font-size: 0.875rem; color: var(--secondary-text-color); margin: 0; }
        .provider-description { font-size: 0.875rem; color: var(--secondary-text-color); margin: 0 0 var(--spacing-sm); }
        .provider-actions { display: flex; align-items: center; gap: var(--spacing-sm); }
        .key-preview { font-family: monospace; font-size: 0.875rem; color: var(--secondary-text-color); }
        .provider-link { color: var(--accent-color); font-size: 0.875rem; }
        .key-input-group { display: flex; flex-direction: column; gap: var(--spacing-sm); }
        .key-input-actions { display: flex; gap: var(--spacing-sm); }
        .character-display { display: flex; align-items: center; gap: var(--spacing-lg); }
        .character-avatar-large { font-size: 4rem; }
        .character-info h4 { margin: 0 0 var(--spacing-xs); display: flex; align-items: center; gap: var(--spacing-sm); }
        .character-description { font-size: 0.875rem; color: var(--secondary-text-color); margin: 0; }
        .mood-display { padding: var(--spacing-md); background: var(--glass-bg-secondary); border-radius: var(--border-radius); }
        .mood-bar-bg { height: 16px; background: var(--glass-bg-primary); border-radius: 8px; overflow: hidden; }
        .mood-bar-fill { height: 100%; background: linear-gradient(90deg, #ef4444 0%, #f59e0b 25%, #00d4ff 50%, #00ff88 75%, #a855f7 100%); transition: width 0.3s ease; }
        .mood-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--secondary-text-color); margin-top: var(--spacing-xs); }
        .mood-current { font-weight: bold; color: var(--accent-color); }
        .mood-stats { display: flex; gap: var(--spacing-lg); margin-top: var(--spacing-md); }
        .mood-stat { display: flex; flex-direction: column; }
        .stat-label { font-size: 0.75rem; color: var(--secondary-text-color); }
        .stat-value { font-weight: 600; }
        .knowledge-types { display: flex; flex-direction: column; gap: var(--spacing-md); }
        .knowledge-type { display: flex; align-items: flex-start; gap: var(--spacing-md); padding: var(--spacing-md); background: var(--glass-bg-secondary); border-radius: var(--border-radius); }
        .knowledge-icon { font-size: 1.5rem; }
        .knowledge-type h4 { margin: 0 0 var(--spacing-xs); }
        .knowledge-type p { margin: 0; font-size: 0.875rem; color: var(--secondary-text-color); }
        .coming-soon { text-align: center; padding: var(--spacing-lg); color: var(--secondary-text-color); font-style: italic; }
        .about-header { display: flex; align-items: center; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg); }
        .about-logo-img { width: 64px; height: 64px; border-radius: 16px; box-shadow: 0 0 20px rgba(0, 212, 255, 0.3); }
        .about-info h2 { margin: 0; color: var(--accent-color); }
        .about-tagline { margin: var(--spacing-xs) 0 0; color: var(--secondary-text-color); }
        .about-details { margin-bottom: var(--spacing-lg); }
        .detail-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--glass-border); }
        .detail-label { color: var(--secondary-text-color); }
        .detail-value { font-weight: 500; }
        .about-philosophy { padding: var(--spacing-md); background: var(--glass-bg-secondary); border-radius: var(--border-radius); margin-bottom: var(--spacing-lg); }
        .about-philosophy h4 { margin: 0 0 var(--spacing-sm); }
        .about-philosophy ul { margin: 0; padding-left: var(--spacing-lg); }
        .about-philosophy li { margin-bottom: var(--spacing-xs); color: var(--secondary-text-color); }
        .about-credits { text-align: center; color: var(--secondary-text-color); }
        .about-copyright { font-size: 0.75rem; margin-top: var(--spacing-xs); }
        @media (max-width: 768px) { .tab-navigation { padding: var(--spacing-sm); } .tab-btn { padding: 8px 12px; font-size: 0.8rem; } .storage-breakdown { flex-direction: column; } .account-profile { flex-direction: column; text-align: center; } .character-display { flex-direction: column; text-align: center; } }
      `}</style>
    </div>
  );
}
