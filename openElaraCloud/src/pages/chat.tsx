/**
 * Chat Page - Main Elara Chat Interface
 * 
 * Gorgeous Nexus-themed chat with character system, selfies, TTS, and more!
 */

import { chat, ChatMessage, isBYOKMode } from "@/lib/api";
import { auth } from "@/lib/firebase";
import ELARA, { getRandomGreeting, getErrorResponse } from "@/lib/elara";
import { getActiveCharacter, Character } from "@/lib/characters";
import { getMoodTracker, resetMoodTracker, MoodTracker } from "@/lib/mood";
import { buildChatSystemPrompt, buildContextPrefix } from "@/lib/promptBuilder";
import { buildRAGContext, ingestConversation } from "@/lib/rag";
import { downloadWithMetadata, type SignedContent } from "@/lib/signing";
import { type GeneratedImage } from "@/lib/mediaGeneration";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';

// Dynamically import components (avoids SSR issues with localStorage)
const ImageGenPanel = dynamic(() => import('@/components/ImageGenPanel'), { ssr: false });
const VideoGenPanel = dynamic(() => import('@/components/VideoGenPanel'), { ssr: false });
const CharacterEditor = dynamic(() => import('@/components/CharacterEditor'), { ssr: false });
const PersonaPanel = dynamic(() => import('@/components/PersonaPanel'), { ssr: false });

// Extended message type to support images
interface ChatMessageWithMedia extends ChatMessage {
  image?: {
    dataUrl: string;
    signedContent: SignedContent;
    prompt: string;
  };
}

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageWithMedia[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [byokMode, setByokMode] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [showCharacterEditor, setShowCharacterEditor] = useState(false);
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [ctrlEnterSend, setCtrlEnterSend] = useState(true);
  const [moodEmoji, setMoodEmoji] = useState('😊');
  const [moodText, setMoodText] = useState('good, engaged');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        router.push("/");
      }
    });
    
    // Check BYOK mode
    setByokMode(isBYOKMode());
    
    // Load active character
    setCharacter(getActiveCharacter());
    
    // Check AI disclaimer
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('openelara_ai_disclaimer_accepted');
      if (!accepted) {
        setShowDisclaimer(true);
      }
      // Load ctrl+enter preference
      const ctrlEnterPref = localStorage.getItem('openelara_ctrl_enter_send');
      if (ctrlEnterPref !== null) {
        setCtrlEnterSend(ctrlEnterPref === 'true');
      }
    }
    
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update mood display when messages change
  useEffect(() => {
    const tracker = getMoodTracker();
    updateMoodDisplay(tracker);
  }, [messages, character]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  // Mood display helper
  const updateMoodDisplay = (tracker: MoodTracker) => {
    const mood = tracker.getMood();
    const description = tracker.getMoodDescription();
    
    // Map mood to emoji
    let emoji = '😊';
    if (mood >= 85) emoji = '🥰';
    else if (mood >= 70) emoji = '😄';
    else if (mood >= 55) emoji = '😊';
    else if (mood >= 45) emoji = '😐';
    else if (mood >= 35) emoji = '😔';
    else if (mood >= 20) emoji = '😢';
    else emoji = '😰';
    
    setMoodEmoji(emoji);
    setMoodText(description);
  };

  const handleResetMood = () => {
    resetMoodTracker();
    const tracker = getMoodTracker();
    updateMoodDisplay(tracker);
  };

  const handleAcceptDisclaimer = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('openelara_ai_disclaimer_accepted', new Date().toISOString());
    }
    setShowDisclaimer(false);
  };

  const handleExportChat = () => {
    const chatExport = {
      character: charName,
      exportedAt: new Date().toISOString(),
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.find(p => p.type === 'text')?.text || '',
      })),
    };
    
    const blob = new Blob([JSON.stringify(chatExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${charName}_chat_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowFileMenu(false);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all messages? This cannot be undone.')) {
      setMessages([]);
      resetMoodTracker();
      updateMoodDisplay(getMoodTracker());
      setShowFileMenu(false);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCtrlEnterToggle = (checked: boolean) => {
    setCtrlEnterSend(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('openelara_ctrl_enter_send', String(checked));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      // Get mood tracker and update from user message
      const moodTracker = getMoodTracker();
      // Content is always string for user messages in this context
      const messageText = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : userMessage.content.find(p => p.type === 'text')?.text || '';
      moodTracker.updateFromUserMessage(messageText);
      
      // Build structured system prompt (from desktop promptConstants.js)
      const activeChar = character || getActiveCharacter();
      
      // Get emotional context from mood tracker
      const moodContext = moodTracker.getPromptContext();
      
      const systemPrompt = buildChatSystemPrompt({
        userName: user?.displayName || 'User',
        character: activeChar,
        emotionalContext: moodContext || null,
        outputTokenLimit: 2048, // Default token limit
      });
      
      // RAG: Search for relevant context from memories/knowledge
      let ragContext: string | null = null;
      try {
        ragContext = await buildRAGContext(messageText);
      } catch (e) {
        console.warn('[Chat] RAG search failed (continuing without context):', e);
      }
      
      // Build the enriched user message with RAG context
      const contextPrefix = buildContextPrefix({ ragContext });
      const enrichedContent = contextPrefix 
        ? contextPrefix + messageText 
        : messageText;
      
      const enrichedUserMessage: ChatMessage = { 
        role: "user", 
        content: enrichedContent 
      };
      
      const response = await chat([
        { role: "system", content: systemPrompt },
        ...messages,
        enrichedUserMessage,
      ]);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.choices[0]?.message?.content || getErrorResponse('unknown'),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // RAG: Auto-ingest conversation for memory (async, non-blocking)
      // This allows the AI to remember past conversations
      const updatedMessages = [...messages, userMessage, assistantMessage];
      if (updatedMessages.length >= 4) { // Only ingest after a few exchanges
        const conversationId = `chat_${user?.uid}_${Date.now()}`;
        ingestConversation(
          conversationId,
          updatedMessages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: typeof m.content === 'string' ? m.content : '[attachment]',
            timestamp: new Date(),
          })),
          `Chat with ${activeChar.name} - ${new Date().toLocaleDateString()}`
        ).catch(e => console.warn('[Chat] Memory ingestion failed:', e));
      }
    } catch (e: any) {
      let errorType: 'network' | 'api' | 'limit' | 'unknown' = 'unknown';
      if (e.message?.includes('network') || e.message?.includes('fetch')) {
        errorType = 'network';
      } else if (e.message?.includes('rate') || e.message?.includes('limit')) {
        errorType = 'limit';
      } else if (e.message?.includes('API') || e.message?.includes('key')) {
        errorType = 'api';
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: getErrorResponse(errorType) },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (ctrlEnterSend) {
      // Ctrl+Enter to send
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      // Enter to send (Shift+Enter for newline)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  const handleCharacterChange = (char: Character) => {
    setCharacter(char);
    setShowCharacterEditor(false);
    // Reset chat and mood tracker when character changes
    setMessages([]);
    resetMoodTracker();
  };

  const handleImageGenerated = (image: GeneratedImage) => {
    // Add a message showing the generated image inline
    const imageMsg: ChatMessageWithMedia = {
      role: 'assistant',
      content: `📸 Here's your generated image! Click to download with provenance metadata.`,
      image: {
        dataUrl: image.signedContent.dataUrl,
        signedContent: image.signedContent,
        prompt: image.prompt,
      },
    };
    setMessages(prev => [...prev, imageMsg]);
    setShowImageGen(false);
  };

  const handleDownloadImage = (signedContent: SignedContent, prompt: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const charName = character?.name || 'Elara';
    const filename = `${charName}_selfie_${timestamp}.png`;
    downloadWithMetadata(signedContent, filename);
  };

  // Current character name (fallback to ELARA)
  const charName = character?.name || ELARA.NAME;
  const charIcon = character?.iconEmoji || '✧';
  const charIconPath = character?.iconPath || '/characters/icon_elara.png';

  // Helper to render avatar (image with emoji fallback)
  const renderAvatar = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizes = {
      sm: { width: 28, height: 28, fontSize: 14 },
      md: { width: 40, height: 40, fontSize: 20 },
      lg: { width: 80, height: 80, fontSize: 40 },
    };
    const s = sizes[size];
    
    if (charIconPath) {
      return (
        <img 
          src={charIconPath} 
          alt={charName}
          className="elara-avatar-img"
          style={{ width: s.width, height: s.height, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            // Fallback to emoji if image fails
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }
    
    return (
      <div className="elara-avatar" style={{ width: s.width, height: s.height, fontSize: s.fontSize }}>
        {charIcon}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="center-content">
        <div className="elara-logo">
          <img src="/icon.png" alt="OpenElara" className="elara-logo-icon-img" />
        </div>
        <div className="nexus-spinner" />
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* AI Disclaimer Modal */}
      {showDisclaimer && (
        <div className="disclaimer-modal">
          <div className="disclaimer-content">
            <h2>⚠️ AI Content Disclosure</h2>
            
            <div className="disclaimer-warning">
              <p className="warning-title">🔞 Age Requirement: 18+</p>
              <p>This application is intended for adults only. By continuing, you confirm you are at least 18 years of age.</p>
            </div>

            <h3>This Application Generates AI Content</h3>
            <p>
              All text, images, video, and audio outputs are produced by <strong>third-party artificial intelligence services</strong>, not by Apply My Tech.
            </p>
            <p>
              OpenElara is a <strong>"Bring Your Own Key" (BYOK) client</strong>—the app provides the interface, but the AI "intelligence" comes from external providers via your own API keys.
            </p>

            <h3>You Are Responsible For:</h3>
            <ul>
              <li>The prompts you submit to AI services</li>
              <li>Reviewing and verifying AI-generated outputs</li>
              <li>Understanding that AI content may be inaccurate, biased, or inappropriate</li>
              <li>Complying with the terms of service of your chosen AI providers</li>
            </ul>

            <h3>Unmoderated Content</h3>
            <p>
              This application does <strong>not filter or moderate</strong> AI-generated content. Outputs may include mature themes depending on your prompts and the AI providers you use.
            </p>

            <div className="disclaimer-accept">
              <button 
                className="nexus-btn nexus-btn-primary"
                onClick={handleAcceptDisclaimer}
              >
                I am 18+ and I understand this application generates AI content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persona Panel (Desktop-style slide-out) */}
      <PersonaPanel
        isOpen={showPersonaPanel}
        onClose={() => setShowPersonaPanel(false)}
        onCharacterSelected={handleCharacterChange}
      />

      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileAttach}
        multiple
        accept=".txt,.md,.json,.csv,.pdf,.js,.ts,.jsx,.tsx,.py,.html,.css"
      />

      {/* Nexus Menu Bar */}
      <div className="nexus-menubar">
        <div className="menu-left">
          {/* File Menu */}
          <div className="menu-item">
            <button 
              className="menu-label"
              onClick={() => setShowFileMenu(!showFileMenu)}
            >
              File
            </button>
            {showFileMenu && (
              <div className="menu-dropdown">
                <button className="menu-option" onClick={handleClearHistory}>🗑️ Clear Chat History</button>
                <button className="menu-option" onClick={handleExportChat}>💾 Export Chat</button>
              </div>
            )}
          </div>

          {/* Output Menu */}
          <div className="menu-item">
            <button 
              className="menu-label"
              onClick={() => setShowOutputMenu(!showOutputMenu)}
            >
              Output
            </button>
            {showOutputMenu && (
              <div className="menu-dropdown">
                <button className="menu-option" onClick={() => { setShowImageGen(true); setShowOutputMenu(false); }}>📸 Generate Image</button>
                <button className="menu-option" onClick={() => { setShowVideoGen(true); setShowOutputMenu(false); }}>🎬 Generate Video</button>
              </div>
            )}
          </div>

          {/* Settings */}
          <button 
            className="menu-label"
            onClick={() => router.push("/settings")}
          >
            Settings
          </button>
        </div>

        <div className="menu-right">
          {/* Persona Toggle */}
          <button 
            className="persona-toggle-btn"
            onClick={() => setShowPersonaPanel(true)}
            title="Switch Character"
          >
            <span className="persona-toggle-avatar">
              {charIconPath ? (
                <img 
                  src={charIconPath} 
                  alt={charName}
                  className="persona-toggle-img"
                />
              ) : (
                <span className="persona-toggle-emoji">{charIcon}</span>
              )}
            </span>
            <span className="persona-toggle-name">{charName}</span>
            <span className="persona-toggle-arrow">▼</span>
          </button>

          {byokMode && (
            <span className="nexus-badge nexus-badge-primary">BYOK</span>
          )}

          <button 
            className="nexus-btn nexus-btn-secondary nexus-btn-sm" 
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats Ribbon - Desktop Style */}
      <div className="stats-ribbon">
        <div className="ribbon-stat ribbon-mood" title="AI Character Mood">
          <span className="mood-emoji">{moodEmoji}</span>
          <span className="mood-text">{charName}: {moodText}</span>
          <button 
            className="mood-reset-btn" 
            onClick={handleResetMood}
            title="Reset mood to character default"
          >
            ↻
          </button>
        </div>

        <div className="ribbon-separator">•</div>

        <div className="ribbon-stat">
          <span className="ribbon-icon">🤖</span>
          <span className="ribbon-label">Model:</span>
          <span className="ribbon-value">Llama-3.3-70B</span>
        </div>

        {attachedFiles.length > 0 && (
          <>
            <div className="ribbon-separator">•</div>
            <div className="ribbon-stat">
              <span className="ribbon-icon">📎</span>
              <span className="ribbon-value">{attachedFiles.length} file(s)</span>
            </div>
          </>
        )}
      </div>

      {/* Modal Overlays */}
      {showImageGen && (
        <div className="modal-overlay" onClick={() => setShowImageGen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ImageGenPanel 
              onClose={() => setShowImageGen(false)}
              onImageGenerated={handleImageGenerated}
            />
          </div>
        </div>
      )}

      {showVideoGen && (
        <div className="modal-overlay" onClick={() => setShowVideoGen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <VideoGenPanel 
              onClose={() => setShowVideoGen(false)}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-container">
            <div className="welcome-avatar">
              {charIconPath ? (
                <img 
                  src={charIconPath} 
                  alt={charName}
                  className="elara-avatar-img elara-avatar-lg"
                />
              ) : (
                <div className="elara-avatar elara-avatar-lg">{charIcon}</div>
              )}
              <div className="elara-status-indicator" />
            </div>
            <h2 className="welcome-title">
              Hey{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}! 👋
            </h2>
            <p className="welcome-subtitle">
              I'm {charName}. What's on your mind today?
            </p>
            
            <div className="quick-prompts">
              <button 
                className="quick-prompt"
                onClick={() => setShowImageGen(true)}
              >
                📸 {charName} selfie
              </button>
              <button 
                className="quick-prompt"
                onClick={() => setShowVideoGen(true)}
              >
                🎬 {charName} video
              </button>
              <button 
                className="quick-prompt"
                onClick={() => setInput("Help me brainstorm ideas for...")}
              >
                💡 Brainstorm ideas
              </button>
              <button 
                className="quick-prompt"
                onClick={() => setInput("Explain this concept: ")}
              >
                📚 Explain something
              </button>
              <button 
                className="quick-prompt"
                onClick={() => setInput("Write code that...")}
              >
                💻 Write code
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.role === "user" ? "chat-message-user" : "chat-message-ai"}`}
          >
            {msg.role === "assistant" && (
              <div className="message-avatar">
                {charIconPath ? (
                  <img 
                    src={charIconPath} 
                    alt={charName}
                    className="message-avatar-img"
                  />
                ) : (
                  <div className="elara-avatar" style={{ width: 28, height: 28, fontSize: 14 }}>{charIcon}</div>
                )}
              </div>
            )}
            <div className="message-content">
              <div style={{ whiteSpace: "pre-wrap" }}>
                {typeof msg.content === 'string' 
                  ? msg.content 
                  : msg.content.find(p => p.type === 'text')?.text || ''}
              </div>
              
              {/* Render generated image if present */}
              {msg.image && (
                <div className="message-image-container">
                  <img 
                    src={msg.image.dataUrl} 
                    alt="Generated" 
                    className="message-image"
                    onClick={() => handleDownloadImage(msg.image!.signedContent, msg.image!.prompt)}
                  />
                  <div className="image-actions">
                    <button 
                      className="nexus-btn nexus-btn-primary nexus-btn-sm"
                      onClick={() => handleDownloadImage(msg.image!.signedContent, msg.image!.prompt)}
                    >
                      💾 Download with Metadata
                    </button>
                    <details className="image-metadata">
                      <summary>📋 Provenance</summary>
                      <pre>{msg.image.signedContent.metadataJson}</pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="chat-message chat-message-ai">
            <div className="message-avatar">
              {charIconPath ? (
                <img 
                  src={charIconPath} 
                  alt={charName}
                  className="message-avatar-img"
                />
              ) : (
                <div className="elara-avatar" style={{ width: 28, height: 28, fontSize: 14 }}>{charIcon}</div>
              )}
            </div>
            <div className="message-content">
              <div className="nexus-typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Desktop-Style Input Area */}
      <div className="chat-input-area">
        {/* Attached Files Display */}
        {attachedFiles.length > 0 && (
          <div className="attached-files">
            {attachedFiles.map((file, i) => (
              <div key={i} className="attached-file">
                <span className="file-icon">📄</span>
                <span className="file-name">{file.name}</span>
                <button className="file-remove" onClick={() => handleRemoveFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Keyboard Shortcut Toggle */}
        <div className="keyboard-shortcut-container">
          <input 
            type="checkbox" 
            id="ctrl-enter-toggle" 
            checked={ctrlEnterSend}
            onChange={(e) => handleCtrlEnterToggle(e.target.checked)}
          />
          <label htmlFor="ctrl-enter-toggle">Ctrl + Enter to Send</label>
        </div>

        <div className="chat-form">
          {/* Left Buttons Stack */}
          <div className="input-buttons-stack">
            <button 
              type="button" 
              className="input-btn-compact"
              onClick={() => setShowImageGen(true)}
              title="Generate Image / Selfie"
            >
              📸 Selfie
            </button>
            <button 
              type="button" 
              className="input-btn-compact"
              onClick={() => setShowVideoGen(true)}
              title="Generate Video"
            >
              🎬 Video
            </button>
            <button 
              type="button" 
              className="input-btn-compact"
              onClick={handleNewChat}
              title="Start New Chat"
            >
              ✨ New
            </button>
          </div>

          {/* Main Input */}
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={ctrlEnterSend 
              ? `Message ${charName}... (Ctrl+Enter to send)` 
              : `Message ${charName}... (Enter to send)`}
            rows={1}
          />

          {/* Send Button with Attachments */}
          <div className="send-button-stack">
            <div className="send-attachments">
              <button 
                type="button" 
                className="attach-btn" 
                title="Attach File"
                onClick={() => fileInputRef.current?.click()}
              >
                📄
              </button>
            </div>
            <button 
              className="send-btn-main" 
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--main-bg-color);
        }

        /* ============== AI DISCLAIMER MODAL ============== */
        .disclaimer-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .disclaimer-content {
          background: var(--secondary-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          max-width: 600px;
          padding: 30px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .disclaimer-content h2 {
          text-align: center;
          color: #00d4ff;
          margin-bottom: 20px;
        }

        .disclaimer-content h3 {
          color: #00d4ff;
          font-size: 1rem;
          margin-top: 15px;
          margin-bottom: 8px;
        }

        .disclaimer-content p {
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 10px;
        }

        .disclaimer-content ul {
          font-size: 0.9rem;
          line-height: 1.6;
          padding-left: 20px;
          margin-bottom: 15px;
        }

        .disclaimer-warning {
          background: rgba(255, 170, 0, 0.1);
          border: 1px solid rgba(255, 170, 0, 0.3);
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .warning-title {
          color: #ffaa00;
          font-weight: bold;
          margin: 0 0 10px 0 !important;
        }

        .disclaimer-accept {
          margin-top: 25px;
          text-align: center;
        }

        /* ============== NEXUS MENUBAR ============== */
        .nexus-menubar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: var(--secondary-bg-color);
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
        }

        .menu-left, .menu-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .menu-item {
          position: relative;
        }

        .menu-label {
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: var(--main-text-color);
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .menu-label:hover {
          background: var(--glass-bg-hover);
          color: var(--accent-color);
        }

        .menu-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 180px;
          background: var(--secondary-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 6px 0;
          z-index: 100;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .menu-option {
          display: block;
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: var(--main-text-color);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .menu-option:hover {
          background: var(--glass-bg-hover);
          color: var(--accent-color);
        }

        /* ============== STATS RIBBON ============== */
        .stats-ribbon {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
          border-bottom: 1px solid var(--glass-border);
          font-size: 12px;
          flex-shrink: 0;
          overflow-x: auto;
        }

        .ribbon-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ribbon-mood {
          background: rgba(139, 92, 246, 0.1);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .mood-emoji {
          font-size: 16px;
        }

        .mood-text {
          color: var(--secondary-text-color);
        }

        .mood-reset-btn {
          background: transparent;
          border: none;
          color: var(--secondary-text-color);
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .mood-reset-btn:hover {
          background: var(--glass-bg-hover);
          color: var(--accent-color);
        }

        .ribbon-separator {
          color: var(--secondary-text-color);
          opacity: 0.5;
        }

        .ribbon-icon {
          font-size: 14px;
        }

        .ribbon-label {
          color: var(--secondary-text-color);
        }

        .ribbon-value {
          color: var(--main-text-color);
          font-weight: 500;
        }

        /* ============== PERSONA TOGGLE ============== */
        .persona-toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          color: var(--main-text-color);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .persona-toggle-btn:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
          border-color: rgba(139, 92, 246, 0.5);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.2);
        }

        .persona-toggle-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(139, 92, 246, 0.5);
        }

        .persona-toggle-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .persona-toggle-name {
          font-weight: 600;
          background: linear-gradient(135deg, #a78bfa, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .persona-toggle-arrow {
          font-size: 10px;
          color: var(--secondary-text-color);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        /* ============== CHAT MESSAGES ============== */
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .message-avatar-img {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--glass-border);
        }

        .elara-avatar-img {
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--accent-color);
          box-shadow: var(--glow-primary);
        }

        .elara-avatar-img.elara-avatar-lg {
          width: 80px;
          height: 80px;
        }

        .chat-message {
          max-width: 80%;
          display: flex;
          gap: var(--spacing-sm);
          animation: messageSlide 0.3s ease-out;
        }

        @keyframes messageSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .chat-message-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .chat-message-user .message-content {
          background: linear-gradient(135deg, #00d4ff 0%, #00a3cc 100%);
          color: #ffffff;
          border-radius: var(--border-radius-lg) var(--border-radius-lg) 4px var(--border-radius-lg);
        }

        .chat-message-ai {
          align-self: flex-start;
        }

        .chat-message-ai .message-content {
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px;
        }

        .message-content {
          padding: var(--spacing-md) var(--spacing-lg);
          line-height: 1.6;
        }

        .message-avatar {
          flex-shrink: 0;
          padding-top: 4px;
        }

        /* Generated Image in Chat */
        .message-image-container {
          margin-top: var(--spacing-md);
          text-align: center;
        }

        .message-image {
          max-width: 100%;
          max-height: 400px;
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .message-image:hover {
          transform: scale(1.02);
          box-shadow: var(--glow-primary);
        }

        .image-actions {
          margin-top: var(--spacing-md);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          align-items: center;
        }

        .image-metadata {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          width: 100%;
          text-align: left;
        }

        .image-metadata summary {
          cursor: pointer;
          padding: var(--spacing-xs);
        }

        .image-metadata pre {
          background: var(--secondary-bg-color);
          padding: var(--spacing-sm);
          border-radius: var(--border-radius);
          overflow-x: auto;
          max-height: 150px;
          font-size: 0.65rem;
        }

        /* ============== WELCOME ============== */
        .welcome-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--spacing-xl);
          flex: 1;
        }

        .welcome-avatar {
          position: relative;
          margin-bottom: var(--spacing-lg);
        }

        .welcome-title {
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: var(--spacing-sm);
          background: linear-gradient(135deg, var(--accent-color), var(--color-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .welcome-subtitle {
          color: var(--secondary-text-color);
          font-size: 1.125rem;
          margin-bottom: var(--spacing-xl);
        }

        .quick-prompts {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          justify-content: center;
          max-width: 600px;
        }

        .quick-prompt {
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-full);
          color: var(--main-text-color);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-prompt:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
          transform: translateY(-2px);
        }

        /* ============== DESKTOP-STYLE INPUT AREA ============== */
        .chat-input-area {
          padding: 12px 16px;
          background: var(--secondary-bg-color);
          border-top: 1px solid var(--glass-border);
          flex-shrink: 0;
        }

        .attached-files {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .attached-file {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          font-size: 12px;
        }

        .file-icon {
          font-size: 14px;
        }

        .file-name {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-remove {
          background: transparent;
          border: none;
          color: var(--error-color);
          cursor: pointer;
          padding: 2px;
          font-size: 12px;
        }

        .keyboard-shortcut-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .keyboard-shortcut-container input[type="checkbox"] {
          accent-color: var(--accent-color);
        }

        .chat-form {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .input-buttons-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-btn-compact {
          padding: 8px 12px;
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          color: var(--main-text-color);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .input-btn-compact:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
        }

        .chat-input {
          flex: 1;
          padding: 12px 16px;
          background: var(--glass-bg-primary);
          border: 2px solid var(--glass-border);
          border-radius: 12px;
          color: var(--main-text-color);
          font-size: 1rem;
          font-family: inherit;
          resize: none;
          min-height: 52px;
          max-height: 200px;
          transition: all 0.2s ease;
        }

        .chat-input:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: var(--glow-primary);
        }

        .chat-input::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.6;
        }

        .send-button-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
        }

        .send-attachments {
          display: flex;
          gap: 4px;
        }

        .attach-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .attach-btn:hover {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
        }

        .send-btn-main {
          padding: 12px 24px;
          background: linear-gradient(135deg, #00d4ff, #00a3cc);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--glow-primary);
        }

        .send-btn-main:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: var(--glow-primary-intense);
        }

        .send-btn-main:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .nexus-menubar {
            flex-wrap: wrap;
            gap: 8px;
          }

          .stats-ribbon {
            flex-wrap: wrap;
          }

          .chat-message {
            max-width: 90%;
          }

          .chat-form {
            flex-direction: column;
          }

          .input-buttons-stack {
            flex-direction: row;
            width: 100%;
          }

          .input-btn-compact {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
