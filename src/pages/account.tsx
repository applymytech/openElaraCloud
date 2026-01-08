/**
 * Account Page - Consolidated Configuration Hub
 * 
 * Single account page matching desktop app structure.
 * Tabs: Profile | API Keys (BYOK) | Characters | Knowledge | About
 */

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import ELARA from "@/lib/elara";
import { APP_VERSION, MANUAL_VERSION, LAST_UPDATED } from "@/lib/userManual";
import { getAllAPIKeys, saveAPIKey, clearAllKeys, APIKeys, hasOwnKeys, hasTogetherKey, hasExaKey, type CustomEndpoint, getAllCustomEndpoints, saveCustomEndpoint, removeCustomEndpoint, getActiveEndpoint, setActiveEndpoint } from "@/lib/byok";
import { getDefaultChatModel, setSelectedModel as saveModelSelection, CHAT_MODEL_METADATA } from "@/lib/models";
import { getStorageStatus, formatBytes as formatStorageBytes, cutMedia, deleteMedia, type StorageStatus, type StoredMedia } from "@/lib/storage";
import { getMoodTracker } from "@/lib/mood";
import { getActiveCharacter, type Character } from "@/lib/characters";

// Dynamic imports to avoid SSR issues
const CharacterEditor = dynamic(() => import('@/components/CharacterEditor'), { ssr: false });
const KnowledgePanel = dynamic(() => import('@/components/KnowledgePanel'), { ssr: false });
const CustomEndpointModal = dynamic(() => import('@/components/CustomEndpointModal'), { ssr: false });

type TabId = 'account' | 'apikeys' | 'characters' | 'knowledge' | 'about';

interface UserProfile {
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: any;
  lastLoginAt: any;
  quota: {
    storageLimitGB: number;
    storageUsedBytes: number;
  };
  settings: {
    theme: string;
    defaultModel: string;
  };
}

export default function Account() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKeys>({ together: '', openrouter: '', exa: '' });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keysSaved, setKeysSaved] = useState(false);
  
  // Custom Endpoints state
  const [customEndpoints, setCustomEndpoints] = useState<CustomEndpoint[]>([]);
  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<CustomEndpoint | null>(null);
  const [activeEndpointName, setActiveEndpointName] = useState<string | null>(null);
  
  // Settings state  
  const [selectedModel, setSelectedModel] = useState('');
  const [ctrlEnterSend, setCtrlEnterSend] = useState(true);
  
  // Character state
  const [character, setCharacter] = useState<Character | null>(null);
  const [showCharacterEditor, setShowCharacterEditor] = useState(false);
  
  // Storage state
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Display name editing state
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setUser(user);
      
      // Load user profile
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
      }
      
      // Load API keys (async)
      const keys = await getAllAPIKeys();
      setApiKeys(keys);
      
      // Load custom endpoints
      setCustomEndpoints(getAllCustomEndpoints());
      setActiveEndpointName(getActiveEndpoint());
      
      // Load settings
      setSelectedModel(getDefaultChatModel());
      if (typeof window !== 'undefined') {
        const ctrlEnterPref = localStorage.getItem('openelara_ctrl_enter_send');
        setCtrlEnterSend(ctrlEnterPref !== 'false');
      }
      
      // Load character
      setCharacter(getActiveCharacter());
      
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

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleSaveKeys = async () => {
    // Save each key individually (async)
    for (const [provider, key] of Object.entries(apiKeys)) {
      await saveAPIKey(provider as keyof APIKeys, key || '');
    }
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleSaveEndpoint = (endpoint: CustomEndpoint) => {
    saveCustomEndpoint(endpoint);
    setCustomEndpoints(getAllCustomEndpoints());
    setShowEndpointModal(false);
    setEditingEndpoint(null);
  };

  const handleEditEndpoint = (endpoint: CustomEndpoint) => {
    setEditingEndpoint(endpoint);
    setShowEndpointModal(true);
  };

  const handleDeleteEndpoint = (name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      removeCustomEndpoint(name);
      setCustomEndpoints(getAllCustomEndpoints());
    }
  };

  const handleSetActiveEndpoint = (name: string) => {
    setActiveEndpoint(name);
    setActiveEndpointName(name);
  };

  const handleClearKeys = () => {
    if (confirm('Are you sure you want to clear all API keys?')) {
      clearAllKeys();
      setApiKeys({ together: '', openrouter: '', exa: '' });
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleModelChange = (model: string) => {
    saveModelSelection('chat', model);
    setSelectedModel(model);
  };

  const handleCtrlEnterToggle = () => {
    const newValue = !ctrlEnterSend;
    setCtrlEnterSend(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('openelara_ctrl_enter_send', String(newValue));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    if (!user?.email) {
      setPasswordError('No email found for current user');
      return;
    }
    
    setChangingPassword(true);
    
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Change password
      await updatePassword(user, newPassword);
      
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Close modal after 1.5 seconds to show success message
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        setPasswordError('Current password is incorrect');
      } else {
        setPasswordError(error.message);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user || !newDisplayName.trim()) return;
    
    setSavingDisplayName(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName.trim()
      });
      
      // Update local state
      setProfile(prev => prev ? { ...prev, displayName: newDisplayName.trim() } : null);
      setEditingDisplayName(false);
      setNewDisplayName('');
    } catch (error) {
      console.error('Failed to update display name:', error);
      alert('Failed to save display name. Please try again.');
    } finally {
      setSavingDisplayName(false);
    }
  };

  const launchChat = () => {
    router.push('/chat');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = (): number => {
    if (!profile) return 0;
    const limitBytes = profile.quota.storageLimitGB * 1024 * 1024 * 1024;
    return Math.round((profile.quota.storageUsedBytes / limitBytes) * 100);
  };

  if (loading) {
    return (
      <div className="account-page center-content">
        <div className="elara-logo">
          <img src="/icon.png" alt="OpenElara" className="elara-logo-icon-img" />
        </div>
        <div className="nexus-spinner" />
      </div>
    );
  }

  return (
    <div className="account-page">
      {/* Stars Background */}
      <div className="stars-bg" />
      
      {/* Header */}
      <header className="account-header">
        <div className="account-header-brand">
          <img src="/icon.png" alt="OpenElara" className="account-logo" />
          <div className="account-title-group">
            <h1 className="account-title">{ELARA.NAME}</h1>
            <span className="account-subtitle">Configuration Hub</span>
          </div>
        </div>
        <div className="account-header-actions">
          <button onClick={handleSignOut} className="nexus-btn nexus-btn-ghost">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="account-main">
        <div className="account-container">
          {/* Tab Navigation */}
          <nav className="account-tabs">
            <button 
              className={`account-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              👤 Account
            </button>
            <button 
              className={`account-tab ${activeTab === 'apikeys' ? 'active' : ''}`}
              onClick={() => setActiveTab('apikeys')}
            >
              🔑 API Keys
            </button>
            <button 
              className={`account-tab ${activeTab === 'characters' ? 'active' : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              🎭 Characters
            </button>
            <button 
              className={`account-tab ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              📚 Knowledge
            </button>
            <button 
              className={`account-tab ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              ℹ️ About
            </button>
          </nav>

          {/* Tab Content */}
          <div className="account-content">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="tab-panel">
                <div className="welcome-banner">
                  <h2>Welcome back, {profile?.displayName || user?.email?.split('@')[0]}!</h2>
                  <p>Your sovereign AI is ready to assist.</p>
                </div>

                <div className="account-grid">
                  {/* Profile Card */}
                  <div className="account-card">
                    <h3>👤 Profile</h3>
                    <div className="profile-info">
                      <div className="profile-row">
                        <span className="profile-label">Email</span>
                        <span className="profile-value">{user?.email}</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Display Name</span>
                        {editingDisplayName ? (
                          <div className="display-name-edit">
                            <input
                              type="text"
                              className="nexus-input display-name-input"
                              value={newDisplayName}
                              onChange={(e) => setNewDisplayName(e.target.value)}
                              placeholder={profile?.displayName || 'Enter your name'}
                              autoFocus
                            />
                            <div className="display-name-actions">
                              <button 
                                className="nexus-btn nexus-btn-sm nexus-btn-primary"
                                onClick={handleSaveDisplayName}
                                disabled={savingDisplayName || !newDisplayName.trim()}
                              >
                                {savingDisplayName ? '...' : '✓'}
                              </button>
                              <button 
                                className="nexus-btn nexus-btn-sm nexus-btn-secondary"
                                onClick={() => { setEditingDisplayName(false); setNewDisplayName(''); }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="profile-value editable" onClick={() => { setEditingDisplayName(true); setNewDisplayName(profile?.displayName || ''); }}>
                            {profile?.displayName || 'Click to set'}
                            <span className="edit-hint">✏️</span>
                          </span>
                        )}
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Member Since</span>
                        <span className="profile-value">
                          {profile?.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Storage Card */}
                  <div className="account-card">
                    <h3>💾 Storage</h3>
                    <div className="storage-info">
                      <div className="storage-stats">
                        <span className="storage-used">{formatBytes(profile?.quota.storageUsedBytes || 0)}</span>
                        <span className="storage-separator"> / </span>
                        <span className="storage-limit">{profile?.quota.storageLimitGB || 2} GB</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${getStoragePercentage()}%` }}
                        />
                      </div>
                      <p className="storage-note">
                        {getStoragePercentage() < 80 
                          ? "You're doing great on storage!" 
                          : "Consider cleaning up old files."}
                      </p>
                    </div>
                  </div>

                  {/* API Status Card */}
                  <div className="account-card status-card">
                    <h3>🔌 API Status</h3>
                    <div className="api-status-grid">
                      <div className={`api-status-item ${hasTogetherKey() ? 'connected' : ''}`}>
                        <span className="status-dot" />
                        <span>Together AI</span>
                      </div>
                      <div className={`api-status-item ${apiKeys.openrouter ? 'connected' : ''}`}>
                        <span className="status-dot" />
                        <span>OpenRouter</span>
                      </div>
                      <div className={`api-status-item ${hasExaKey() ? 'connected' : ''}`}>
                        <span className="status-dot" />
                        <span>Exa.ai</span>
                      </div>
                    </div>
                    {!hasOwnKeys() && (
                      <p className="api-warning">⚠️ Add API keys in the API Keys tab for full BYOK access.</p>
                    )}
                  </div>

                  {/* Password Change Button */}
                  <div className="account-card">
                    <h3>🔐 Password & Security</h3>
                    <p className="card-description">Manage your account password</p>
                    <button 
                      className="nexus-btn nexus-btn-secondary"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys Tab */}
            {activeTab === 'apikeys' && (
              <div className="tab-panel">
                <div className="byok-header">
                  <h2>🔑 Bring Your Own Keys (BYOK)</h2>
                  <p>Enter your API keys for direct access to AI providers. Keys are stored locally in your browser.</p>
                  
                  {/* Security Warning */}
                  <div className="security-warning">
                    <div className="warning-header">
                      <span className="warning-icon">🔓</span>
                      <h4>Security Notice</h4>
                    </div>
                    <ul>
                      <li><strong>Keys are NOT encrypted</strong> - stored in browser localStorage as plain text</li>
                      <li><strong>Same-Origin Policy protection</strong> - only accessible by this domain</li>
                      <li><strong>Vulnerable to XSS</strong> - malicious scripts could potentially access keys</li>
                      <li><strong>Browser extensions</strong> - some extensions can read localStorage</li>
                      <li><strong>Never share keys</strong> - treat them like passwords, rotate regularly</li>
                    </ul>
                    <p className="warning-footer">
                      💡 <strong>Tip:</strong> Use limited-scope API keys with spending limits when possible. 
                      If your provider supports key restrictions, enable them.
                    </p>
                  </div>
                </div>

                {keysSaved && (
                  <div className="form-success">✓ API keys saved successfully!</div>
                )}

                <div className="api-keys-grid">
                  {/* Together AI */}
                  <div className="api-key-card">
                    <div className="api-key-header">
                      <span className="provider-icon">🚀</span>
                      <div>
                        <h4>Together AI</h4>
                        <small>Primary - Chat, Images, Video, TTS, STT</small>
                      </div>
                    </div>
                    <div className="form-group">
                      <div className="input-with-toggle">
                        <input
                          type={showKeys.together ? 'text' : 'password'}
                          className="nexus-input"
                          value={apiKeys.together}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, together: e.target.value }))}
                          placeholder="Enter Together AI API key"
                        />
                        <button 
                          type="button"
                          className="toggle-visibility"
                          onClick={() => toggleShowKey('together')}
                        >
                          {showKeys.together ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                    <details className="api-instructions">
                      <summary>How to get your key</summary>
                      <ol>
                        <li>Go to <strong>together.ai</strong></li>
                        <li>Create an account or sign in</li>
                        <li>Go to Settings → API Keys</li>
                        <li>Create and copy your key</li>
                      </ol>
                    </details>
                  </div>

                  {/* OpenRouter */}
                  <div className="api-key-card">
                    <div className="api-key-header">
                      <span className="provider-icon">🌐</span>
                      <div>
                        <h4>OpenRouter</h4>
                        <small>300+ models including 50+ free • Access Claude, GPT-4, Gemini via routing</small>
                      </div>
                    </div>
                    <div className="form-group">
                      <div className="input-with-toggle">
                        <input
                          type={showKeys.openrouter ? 'text' : 'password'}
                          className="nexus-input"
                          value={apiKeys.openrouter}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, openrouter: e.target.value }))}
                          placeholder="Enter OpenRouter API key"
                        />
                        <button 
                          type="button"
                          className="toggle-visibility"
                          onClick={() => toggleShowKey('openrouter')}
                        >
                          {showKeys.openrouter ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                    <details className="api-instructions">
                      <summary>How to get your key</summary>
                      <ol>
                        <li>Go to <strong>openrouter.ai</strong></li>
                        <li>Sign in with Google, Discord, or email</li>
                        <li>Click your name → Keys → Create Key</li>
                        <li>Copy and paste above</li>
                      </ol>
                      <p className="tip-note">💡 50+ free models available including DeepSeek, Llama, Mistral!</p>
                    </details>
                  </div>

                  {/* Exa.ai */}
                  <div className="api-key-card">
                    <div className="api-key-header">
                      <span className="provider-icon">🔍</span>
                      <div>
                        <h4>Exa.ai</h4>
                        <small>Power Knowledge - Web Search & Research</small>
                      </div>
                    </div>
                    <div className="form-group">
                      <div className="input-with-toggle">
                        <input
                          type={showKeys.exa ? 'text' : 'password'}
                          className="nexus-input"
                          value={apiKeys.exa}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, exa: e.target.value }))}
                          placeholder="Enter Exa.ai API key"
                        />
                        <button 
                          type="button"
                          className="toggle-visibility"
                          onClick={() => toggleShowKey('exa')}
                        >
                          {showKeys.exa ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Endpoints (BYOEndpoint) */}
                <div className="custom-endpoints-section">
                  <div className="section-header">
                    <h3>🌐 Custom Endpoints (BYOEndpoint)</h3>
                    <button 
                      onClick={() => { setEditingEndpoint(null); setShowEndpointModal(true); }}
                      className="nexus-btn nexus-btn-secondary nexus-btn-sm"
                    >
                      + Add Endpoint
                    </button>
                  </div>
                  
                  <p className="section-description">
                    Connect to any OpenAI-compatible REST API endpoint. <strong>No guarantees.</strong> If your endpoint doesn't follow OpenAI standards, it won't work. Chat only - no image/video.
                  </p>

                  {customEndpoints.length === 0 ? (
                    <div className="empty-state">
                      <p>🔌 No custom endpoints configured yet.</p>
                      <p className="empty-hint">Click "Add Endpoint" to connect to any OpenAI-compatible API. You're on your own - compatibility not guaranteed.</p>
                    </div>
                  ) : (
                    <div className="endpoints-grid">
                      {customEndpoints.map(endpoint => (
                        <div 
                          key={endpoint.name} 
                          className={`endpoint-card ${activeEndpointName === endpoint.name ? 'active' : ''} ${endpoint.enabled === false ? 'disabled' : ''}`}
                        >
                          <div className="endpoint-header">
                            <h4>{endpoint.name}</h4>
                            <div className="endpoint-actions">
                              <button
                                onClick={() => handleSetActiveEndpoint(endpoint.name)}
                                className="endpoint-action-btn"
                                title="Set as active"
                                disabled={endpoint.enabled === false}
                              >
                                {activeEndpointName === endpoint.name ? '✓' : '○'}
                              </button>
                              <button
                                onClick={() => handleEditEndpoint(endpoint)}
                                className="endpoint-action-btn"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteEndpoint(endpoint.name)}
                                className="endpoint-action-btn endpoint-delete"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          <div className="endpoint-details">
                            <div className="endpoint-detail">
                              <span className="detail-label">URL:</span>
                              <span className="detail-value">{endpoint.chatEndpoint || endpoint.baseUrl || 'Not set'}</span>
                            </div>
                            {endpoint.apiKey && (
                              <div className="endpoint-detail">
                                <span className="detail-label">API Key:</span>
                                <span className="detail-value">••••••••</span>
                              </div>
                            )}
                            {endpoint.customPayload && (
                              <div className="endpoint-detail">
                                <span className="detail-label">Custom Fields:</span>
                                <span className="detail-value">Yes</span>
                              </div>
                            )}
                            {endpoint.overridePayload && (
                              <div className="endpoint-detail">
                                <span className="detail-label">Mode:</span>
                                <span className="detail-value badge-advanced">Advanced Template</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="api-keys-actions">
                  <button onClick={handleSaveKeys} className="nexus-btn nexus-btn-primary">
                    💾 Save All Keys
                  </button>
                  <button onClick={handleClearKeys} className="nexus-btn nexus-btn-danger">
                    🗑️ Clear All Keys
                  </button>
                </div>

                <div className="byok-info">
                  <p>🔒 <strong>Security:</strong> Keys are stored locally in your browser's localStorage. They never leave your device except when making API calls directly to the providers.</p>
                </div>
              </div>
            )}
            
            {/* Custom Endpoint Modal */}
            {showEndpointModal && (
              <CustomEndpointModal
                isOpen={showEndpointModal}
                onClose={() => { setShowEndpointModal(false); setEditingEndpoint(null); }}
                onSave={handleSaveEndpoint}
                editEndpoint={editingEndpoint}
              />
            )}

            {/* Characters Tab */}
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
                    <div className="account-card">
                      <div className="card-header-row">
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
                          {character.iconPath ? (
                            <img 
                              src={character.iconPath} 
                              alt={character.name}
                              className="character-avatar-img"
                            />
                          ) : (
                            <div className="character-avatar-placeholder" />
                          )}
                          <div className="character-info">
                            <h4>{character.name} {character.isBuiltIn && <span className="badge-builtin">Built-in</span>}</h4>
                            <p className="character-description">{character.descriptionSafe.slice(0, 150)}...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="account-card">
                      <h3>💜 Emotional State</h3>
                      
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

                    {/* Model Selection */}
                    <div className="account-card">
                      <h3>🤖 Default Chat Model</h3>
                      <p className="card-description">Choose your preferred AI model for conversations.</p>
                      <select 
                        className="nexus-input model-select"
                        value={selectedModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                      >
                        {Object.entries(CHAT_MODEL_METADATA).map(([modelId, meta]) => (
                          <option key={modelId} value={modelId}>
                            {meta?.displayName || modelId} {meta?.free ? '(Free)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Knowledge Tab */}
            {activeTab === 'knowledge' && (
              <div className="tab-panel">
                <KnowledgePanel />
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="tab-panel">
                <div className="about-content">
                  <div className="about-header">
                    <img src="/icon.png" alt="OpenElara" className="about-logo" />
                    <div>
                      <h2 className="about-title">{ELARA.NAME}</h2>
                      <p className="about-version">Cloud Edition • v1.0.0</p>
                    </div>
                  </div>

                  <div className="about-description">
                    <p>{ELARA.NAME} is your sovereign AI assistant - a BYOK (Bring Your Own Key) platform that puts you in control of your AI interactions.</p>
                  </div>

                  <div className="about-features">
                    <h3>✨ Features</h3>
                    <ul>
                      <li>💬 Multi-model chat with thinking tags</li>
                      <li>🖼️ AI image generation (FLUX, Stable Diffusion)</li>
                      <li>🎬 AI video generation</li>
                      <li>🎤 Speech-to-text voice input</li>
                      <li>🔊 Text-to-speech output</li>
                      <li>📎 File attachments for context</li>
                      <li>🔍 Power Knowledge (Exa.ai search)</li>
                      <li>📂 File format conversion</li>
                      <li>🎭 Character personas</li>
                      <li>📝 Prompt templates</li>
                      <li>🧠 Knowledge base with RAG</li>
                    </ul>
                  </div>

                  <div className="about-links">
                    <h3>🔗 Links</h3>
                    <div className="link-grid">
                      <a href="/PRIVACY.md" target="_blank" className="about-link">
                        🔒 Privacy Policy
                      </a>
                      <a href="/TERMS.md" target="_blank" className="about-link">
                        📜 Terms of Service
                      </a>
                      <a href="https://github.com/AlgorithmArts/openElara" target="_blank" rel="noopener" className="about-link">
                        💻 GitHub
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Launch Bar */}
          <div className="launch-bar">
            <span>Ready to chat?</span>
            <button onClick={launchChat} className="nexus-btn nexus-btn-primary launch-btn">
              🚀 Launch {ELARA.NAME}
            </button>
          </div>
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔐 Change Password</h2>
                <button className="modal-close" onClick={() => setShowPasswordModal(false)}>✕</button>
              </div>
              
              <form onSubmit={handlePasswordChange} className="modal-form">
                {passwordError && <div className="form-error">⚠️ {passwordError}</div>}
                {passwordSuccess && <div className="form-success">✓ {passwordSuccess}</div>}
                
                <div className="form-group">
                  <label className="nexus-label">Current Password</label>
                  <input
                    type="password"
                    className="nexus-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label className="nexus-label">New Password</label>
                  <input
                    type="password"
                    className="nexus-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="nexus-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="nexus-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                
                <div className="modal-actions">
                  <button 
                    type="button"
                    className="nexus-btn nexus-btn-secondary"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="nexus-btn nexus-btn-primary"
                    disabled={changingPassword}
                  >
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .account-page {
          min-height: 100vh;
          background: var(--main-bg-color);
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
        }

        /* Stars Background */
        .stars-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 90px 40px, rgba(0,212,255,0.9), transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.5), transparent),
            radial-gradient(2px 2px at 160px 120px, rgba(168,85,247,0.8), transparent),
            radial-gradient(1px 1px at 200px 200px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 250px 40px, rgba(255,255,255,0.4), transparent),
            radial-gradient(2px 2px at 300px 160px, rgba(0,212,255,0.7), transparent),
            radial-gradient(1px 1px at 350px 80px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 400px 220px, rgba(255,255,255,0.5), transparent),
            radial-gradient(2px 2px at 450px 100px, rgba(168,85,247,0.6), transparent);
          background-size: 550px 550px;
          animation: starsMove 120s linear infinite;
          z-index: 0;
          pointer-events: none;
        }

        @keyframes starsMove {
          from { background-position: 0 0; }
          to { background-position: 550px 550px; }
        }

        /* Header */
        .account-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md) var(--spacing-xl);
          background: var(--secondary-bg-color);
          border-bottom: 1px solid var(--glass-border);
        }

        .account-header-brand {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .account-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          box-shadow: var(--glow-primary);
        }

        .account-title-group {
          display: flex;
          flex-direction: column;
        }

        .account-title {
          font-size: 1.5rem;
          margin: 0;
          background: linear-gradient(135deg, #00d4ff 0%, #00ff88 50%, #00d4ff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-shift 3s ease-in-out infinite;
        }

        @keyframes gradient-shift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }

        .account-subtitle {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
        }

        /* Main */
        .account-main {
          position: relative;
          z-index: 1;
          padding: var(--spacing-xl);
          padding-bottom: calc(var(--spacing-xl) * 3);
          overflow-y: auto;
        }

        .account-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Tabs */
        .account-tabs {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          padding-bottom: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
          border-bottom: 2px solid var(--glass-border);
          width: 100%;
        }

        .account-tab {
          flex: 1 1 0;
          min-width: 0;
          text-align: center;
          white-space: nowrap;
          padding: 12px 8px;
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          border-radius: 8px 8px 0 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
          color: var(--secondary-text-color);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .account-tab:hover {
          background: linear-gradient(180deg, rgba(0, 212, 255, 0.1) 0%, transparent 100%);
          color: var(--main-text-color);
          transform: translateY(-2px);
        }

        .account-tab.active {
          background: linear-gradient(180deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 149, 255, 0.1) 100%);
          color: var(--accent-color);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
        }

        /* Content */
        .account-content {
          background: var(--glass-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-xl);
          backdrop-filter: blur(12px);
          margin-bottom: var(--spacing-xl);
        }

        .tab-panel h2 {
          margin-bottom: var(--spacing-lg);
          color: var(--accent-color);
        }

        /* Welcome Banner */
        .welcome-banner {
          text-align: center;
          padding: var(--spacing-xl);
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(168, 85, 247, 0.1));
          border-radius: var(--border-radius-lg);
          margin-bottom: var(--spacing-xl);
        }

        .welcome-banner h2 {
          margin: 0 0 var(--spacing-sm) 0;
          font-size: 1.8rem;
        }

        .welcome-banner p {
          margin: 0;
          color: var(--secondary-text-color);
        }

        /* Grid Layouts */
        .account-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--spacing-lg);
          justify-content: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--spacing-lg);
          justify-content: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .api-keys-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
          justify-content: center;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Cards */
        .account-card,
        .settings-card,
        .api-key-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          padding: var(--spacing-lg);
          transition: all 0.3s ease;
        }

        .account-card:hover,
        .settings-card:hover,
        .api-key-card:hover {
          border-color: rgba(0, 212, 255, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .account-card h3,
        .settings-card h3 {
          margin: 0 0 var(--spacing-md) 0;
          color: var(--accent-color);
          font-size: 1.1rem;
        }

        /* Profile Info */
        .profile-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .profile-row {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid var(--glass-border);
        }

        .profile-row:last-child {
          border-bottom: none;
        }

        .profile-label {
          color: var(--secondary-text-color);
        }

        .profile-value {
          font-weight: 500;
        }

        .profile-value.editable {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: var(--border-radius);
          transition: background 0.2s ease;
        }

        .profile-value.editable:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .profile-value .edit-hint {
          opacity: 0.5;
          font-size: 0.8rem;
          transition: opacity 0.2s;
        }

        .profile-value.editable:hover .edit-hint {
          opacity: 1;
        }

        .display-name-edit {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .display-name-input {
          width: 150px;
          padding: 6px 10px !important;
          font-size: 0.875rem;
        }

        .display-name-actions {
          display: flex;
          gap: 4px;
        }

        .nexus-btn-sm {
          padding: 6px 10px !important;
          font-size: 0.8rem;
        }

        /* Storage */
        .storage-info {
          text-align: center;
        }

        .storage-stats {
          font-size: 1.5rem;
          margin-bottom: var(--spacing-md);
        }

        .storage-used {
          color: var(--accent-color);
          font-weight: 600;
        }

        .storage-separator {
          color: var(--secondary-text-color);
        }

        .storage-limit {
          color: var(--secondary-text-color);
        }

        .storage-note {
          margin-top: var(--spacing-md);
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        /* API Status */
        .api-status-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-sm);
        }

        .api-status-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          font-size: 0.875rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--error-color);
        }

        .api-status-item.connected .status-dot {
          background: var(--success-color);
          box-shadow: 0 0 8px var(--success-color);
        }

        .api-warning {
          margin-top: var(--spacing-md);
          font-size: 0.85rem;
          color: var(--warning-color);
        }

        /* Password Form */
        .password-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        /* API Keys */
        .byok-header {
          margin-bottom: var(--spacing-xl);
        }

        .byok-header h2 {
          margin-bottom: var(--spacing-sm);
        }

        .byok-header p {
          color: var(--secondary-text-color);
        }

        /* Security Warning */
        .security-warning {
          margin-top: var(--spacing-lg);
          padding: var(--spacing-lg);
          background: linear-gradient(135deg, rgba(255, 87, 51, 0.1), rgba(255, 120, 85, 0.1));
          border-left: 4px solid var(--warning-color);
          border-radius: var(--border-radius);
          backdrop-filter: blur(10px);
        }

        .warning-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .warning-icon {
          font-size: 1.5rem;
        }

        .warning-header h4 {
          margin: 0;
          color: var(--warning-color);
          font-weight: 600;
        }

        .security-warning ul {
          margin: var(--spacing-md) 0;
          padding-left: var(--spacing-lg);
          line-height: 1.8;
        }

        .security-warning li {
          color: var(--text-color);
          margin-bottom: var(--spacing-xs);
        }

        .security-warning strong {
          color: var(--warning-color);
        }

        .warning-footer {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.9rem;
          color: var(--secondary-text-color);
        }

        .api-key-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .provider-icon {
          font-size: 1.8rem;
        }

        .api-key-header h4 {
          margin: 0;
          color: var(--accent-color);
        }

        .api-key-header small {
          color: var(--secondary-text-color);
        }

        .input-with-toggle {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-toggle .nexus-input {
          padding-right: 50px;
        }

        .toggle-visibility {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 4px;
        }

        .api-instructions {
          margin-top: var(--spacing-md);
          font-size: 0.875rem;
        }

        .api-instructions summary {
          cursor: pointer;
          color: var(--accent-color);
        }

        .api-instructions ol {
          margin: var(--spacing-sm) 0 0 var(--spacing-lg);
          color: var(--secondary-text-color);
        }

        .api-keys-actions {
          display: flex;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .byok-info {
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        /* Settings */
        .settings-card p {
          color: var(--secondary-text-color);
          margin-bottom: var(--spacing-md);
        }

        .settings-card small {
          display: block;
          margin-top: var(--spacing-sm);
          color: var(--tertiary-text-color);
        }

        .model-select {
          width: 100%;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-md);
          cursor: pointer;
        }

        .toggle-input {
          display: none;
        }

        .toggle-slider {
          width: 48px;
          height: 24px;
          background: var(--glass-bg-secondary);
          border-radius: 12px;
          position: relative;
          transition: all 0.3s ease;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: var(--main-text-color);
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .toggle-input:checked + .toggle-slider {
          background: var(--accent-color);
        }

        .toggle-input:checked + .toggle-slider::before {
          transform: translateX(24px);
        }

        .theme-preview {
          display: flex;
          gap: var(--spacing-md);
        }

        .theme-option {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          cursor: pointer;
        }

        .theme-option.active {
          border-color: var(--accent-color);
          background: var(--glass-bg-secondary);
        }

        .theme-swatch {
          width: 24px;
          height: 24px;
          border-radius: 4px;
        }

        .theme-swatch.nexus {
          background: linear-gradient(135deg, var(--main-bg-color), var(--accent-color));
        }

        /* About */
        .about-content {
          max-width: 700px;
        }

        .about-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .about-logo {
          width: 80px;
          height: 80px;
          border-radius: 16px;
          box-shadow: var(--glow-primary);
        }

        .about-title {
          margin: 0;
          font-size: 2rem;
          background: linear-gradient(135deg, var(--accent-color), var(--color-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .about-version {
          margin: var(--spacing-xs) 0 0 0;
          color: var(--secondary-text-color);
        }

        .about-description {
          margin-bottom: var(--spacing-xl);
          line-height: 1.7;
        }

        .about-features h3,
        .about-links h3 {
          margin-bottom: var(--spacing-md);
          color: var(--accent-color);
        }

        .about-features ul {
          list-style: none;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-sm);
        }

        .about-features li {
          padding: var(--spacing-sm);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
        }

        .about-links {
          margin-top: var(--spacing-xl);
        }

        .link-grid {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
        }

        .about-link {
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          color: var(--main-text-color);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .about-link:hover {
          border-color: var(--accent-color);
          text-decoration: none;
        }

        /* Character & Mood Styles */
        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .card-header-row h3 {
          margin: 0;
        }

        .character-display {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
        }

        .character-avatar-img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--accent-color);
          box-shadow: var(--glow-primary);
          flex-shrink: 0;
        }

        .character-avatar-placeholder {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--glass-bg-secondary);
          border: 2px solid var(--glass-border);
          flex-shrink: 0;
        }

        .character-avatar-large {
          font-size: 4rem;
        }

        .character-info h4 {
          margin: 0 0 var(--spacing-xs);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .character-description {
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin: 0;
        }

        .badge-builtin {
          font-size: 0.625rem;
          background: var(--color-secondary);
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
        }

        .info-box {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .info-box p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .card-description {
          color: var(--secondary-text-color);
          margin-bottom: var(--spacing-md);
        }

        .mood-display {
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
        }

        .mood-bar-bg {
          height: 16px;
          background: var(--glass-bg-primary);
          border-radius: 8px;
          overflow: hidden;
        }

        .mood-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444 0%, #f59e0b 25%, #00d4ff 50%, #00ff88 75%, #a855f7 100%);
          transition: width 0.3s ease;
        }

        .mood-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          margin-top: var(--spacing-xs);
        }

        .mood-current {
          font-weight: bold;
          color: var(--accent-color);
        }

        .mood-stats {
          display: flex;
          gap: var(--spacing-lg);
          margin-top: var(--spacing-md);
        }

        .mood-stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
        }

        .stat-value {
          font-weight: 600;
        }

        /* Launch Bar */
        .launch-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg) var(--spacing-xl);
          margin-top: var(--spacing-xl);
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 136, 0.1));
          border-radius: var(--border-radius-lg);
          border: 1px solid var(--glass-border);
        }

        .launch-bar span {
          color: var(--secondary-text-color);
        }

        .launch-btn {
          min-width: 200px;
        }

        /* Custom Endpoints Section */
        .custom-endpoints-section {
          margin-top: var(--spacing-xl);
          padding-top: var(--spacing-xl);
          border-top: 1px solid var(--glass-border);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .section-header h3 {
          margin: 0;
          color: var(--accent-color);
        }

        .section-description {
          color: var(--secondary-text-color);
          margin-bottom: var(--spacing-lg);
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-xl);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          border: 1px dashed var(--glass-border);
        }

        .empty-state p {
          margin: var(--spacing-sm) 0;
        }

        .empty-hint {
          color: var(--secondary-text-color);
          font-size: 0.875rem;
        }

        .endpoints-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--spacing-md);
        }

        .endpoint-card {
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          transition: all 0.2s ease;
        }

        .endpoint-card:hover {
          border-color: var(--accent-color);
          box-shadow: var(--glow-primary);
        }

        .endpoint-card.active {
          border-color: var(--color-success);
          background: rgba(0, 255, 136, 0.05);
        }

        .endpoint-card.disabled {
          opacity: 0.5;
        }

        .endpoint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
        }

        .endpoint-header h4 {
          margin: 0;
          color: var(--main-text-color);
          font-size: 1rem;
        }

        .endpoint-actions {
          display: flex;
          gap: var(--spacing-xs);
        }

        .endpoint-action-btn {
          background: transparent;
          border: 1px solid var(--glass-border);
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          color: var(--main-text-color);
        }

        .endpoint-action-btn:hover {
          border-color: var(--accent-color);
          background: var(--glass-bg-primary);
        }

        .endpoint-action-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .endpoint-delete:hover {
          border-color: var(--color-danger);
          color: var(--color-danger);
        }

        .endpoint-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .endpoint-detail {
          display: flex;
          gap: var(--spacing-sm);
          font-size: 0.875rem;
        }

        .detail-label {
          color: var(--secondary-text-color);
          min-width: 80px;
        }

        .detail-value {
          color: var(--main-text-color);
          font-family: monospace;
          word-break: break-all;
        }

        .badge-advanced {
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 0.75rem;
          color: white;
        }

        /* Password Change Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-content {
          background: var(--secondary-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: 0;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--glow-primary);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--glass-border);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          background: linear-gradient(135deg, #00d4ff, #00ff88);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: var(--glass-bg-primary);
          color: var(--main-text-color);
        }

        .modal-form {
          padding: var(--spacing-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .form-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--color-danger);
          color: var(--color-danger);
          padding: var(--spacing-sm);
          border-radius: var(--border-radius-md);
          font-size: 0.875rem;
        }

        .form-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid var(--color-success);
          color: var(--color-success);
          padding: var(--spacing-sm);
          border-radius: var(--border-radius-md);
          font-size: 0.875rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .modal-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
          margin-top: var(--spacing-md);
        }

        .modal-actions button {
          min-width: 100px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .account-main {
            padding: var(--spacing-sm);
            padding-bottom: calc(var(--spacing-xl) * 2);
          }

          .account-container {
            padding: 0;
          }

          /* Mobile-specific tab layout */
          .account-tabs {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
            padding-bottom: var(--spacing-sm);
            margin-bottom: var(--spacing-md);
          }

          .account-tab {
            padding: 10px 6px;
            font-size: 0.8rem;
            white-space: normal;
            line-height: 1.2;
            min-height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          /* Stack content cards */
          .account-content {
            padding: var(--spacing-md);
            margin-bottom: var(--spacing-md);
          }

          .account-grid,
          .settings-grid,
          .api-keys-grid {
            grid-template-columns: 1fr;
            gap: var(--spacing-md);
          }

          /* Welcome banner */
          .welcome-banner {
            padding: var(--spacing-md);
          }

          .welcome-banner h1 {
            font-size: 1.5rem;
          }

          .welcome-banner p {
            font-size: 0.9rem;
          }

          /* Profile section */
          .profile-display {
            flex-direction: column;
            text-align: center;
          }

          .profile-avatar {
            margin: 0 auto var(--spacing-sm) auto;
          }

          /* Card adjustments */
          .card-header-row {
            flex-direction: column;
            gap: var(--spacing-sm);
            align-items: flex-start;
          }

          .card-header-row button {
            width: 100%;
          }

          /* Character display */
          .character-display {
            flex-direction: column;
            text-align: center;
          }

          .character-avatar-img,
          .character-avatar-placeholder {
            margin: 0 auto var(--spacing-sm) auto;
          }

          /* API Keys */
          .api-key-input-group {
            flex-direction: column;
          }

          .api-key-input-group button {
            width: 100%;
          }

          /* Storage items */
          .storage-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .storage-actions {
            width: 100%;
            display: flex;
            gap: 8px;
          }

          .storage-actions button {
            flex: 1;
          }

          /* Launch bar */
          .launch-bar {
            flex-direction: column;
            gap: var(--spacing-md);
          }

          .launch-btn {
            width: 100%;
          }

          /* About section */
          .about-header {
            flex-direction: column;
            text-align: center;
          }

          .about-logo {
            margin: 0 auto var(--spacing-sm) auto;
          }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .account-tabs {
            grid-template-columns: 1fr;
          }

          .account-tab {
            min-height: 40px;
            padding: 8px 6px;
          }

          .account-main {
            padding: var(--spacing-xs);
          }

          .account-content {
            padding: var(--spacing-sm);
          }
        }
      `}</style>
    </div>
  );
}