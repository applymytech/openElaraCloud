/**
 * Chat Page - Main Elara Chat Interface
 * 
 * Gorgeous Nexus-themed chat with character system, selfies, TTS, and more!
 */

import { chat, ChatMessage, isBYOKMode } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import ELARA, { getRandomGreeting, getErrorResponse } from "@/lib/elara";
import { getDefaultChatModel, setSelectedModel, CHAT_MODEL_METADATA, getChatModels, type Model } from "@/lib/models";
import { getActiveCharacter, Character } from "@/lib/characters";
import { getMoodTracker, resetMoodTracker, MoodTracker } from "@/lib/mood";
import { buildChatSystemPrompt, buildContextPrefix } from "@/lib/promptBuilder";
import { executeCouncilMode, type CouncilResult } from "@/lib/councilMode";
import { buildRAGContext, ingestConversation } from "@/lib/rag";
import { 
  loadContextCanvas, 
  buildFullCanvasContext, 
  getCanvasStats,
  getTokenStats,
} from "@/lib/contextCanvas";
import { downloadWithMetadata, type SignedContent } from "@/lib/signing";
import { type GeneratedImage } from "@/lib/mediaGeneration";
import { 
  isSTTSupported, 
  startRecording, 
  stopRecording, 
  cancelRecording, 
  transcribeAudio, 
  getRecordingState 
} from "@/lib/stt";
import { getTrialStatus } from "@/lib/trial";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';

// Dynamically import components (avoids SSR issues with localStorage)
const TrialBanner = dynamic(() => import('@/components/TrialBanner'), { ssr: false });
const ImageGenPanel = dynamic(() => import('@/components/ImageGenPanel'), { ssr: false });
const VideoGenPanel = dynamic(() => import('@/components/VideoGenPanel'), { ssr: false });
const CharacterEditor = dynamic(() => import('@/components/CharacterEditor'), { ssr: false });
const PersonaPanel = dynamic(() => import('@/components/PersonaPanel'), { ssr: false });
const PromptManager = dynamic(() => import('@/components/PromptManager'), { ssr: false });
const KnowledgePanel = dynamic(() => import('@/components/KnowledgePanel'), { ssr: false });
const StorageManager = dynamic(() => import('@/components/StorageManager'), { ssr: false });
const PowerKnowledge = dynamic(() => import('@/components/PowerKnowledge'), { ssr: false });
const FileConverter = dynamic(() => import('@/components/FileConverter'), { ssr: false });
const ContextCanvas = dynamic(() => import('@/components/ContextCanvas'), { ssr: false });

// Extended message type to support images and thinking
interface ChatMessageWithMedia extends ChatMessage {
  image?: {
    dataUrl: string;
    signedContent: SignedContent;
    prompt: string;
  };
  thinking?: string;  // AI's reasoning (shown in collapsible)
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
  const [currentModel, setCurrentModel] = useState<string>('');
  const [availableChatModels, setAvailableChatModels] = useState<Model[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [showCharacterEditor, setShowCharacterEditor] = useState(false);
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showPowerKnowledge, setShowPowerKnowledge] = useState(false);
  const [showFileConverter, setShowFileConverter] = useState(false);
  const [showContextCanvas, setShowContextCanvas] = useState(false);
  const [canvasTokenCount, setCanvasTokenCount] = useState(0);
  const [ctrlEnterSend, setCtrlEnterSend] = useState(true);
  const [moodEmoji, setMoodEmoji] = useState('😊');
  const [moodText, setMoodText] = useState('good, engaged');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>('User');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        router.push("/");
      } else {
        // Load display name from Firestore profile
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const profile = userSnap.data();
            setUserDisplayName(profile.displayName || user.email?.split('@')[0] || 'User');
          } else {
            setUserDisplayName(user.email?.split('@')[0] || 'User');
          }
        } catch (err) {
          console.warn('Failed to load user profile:', err);
          setUserDisplayName(user.email?.split('@')[0] || 'User');
        }
      }
    });
    
    // Check BYOK mode
    setByokMode(isBYOKMode());
    
    // Load active character
    setCharacter(getActiveCharacter());
    
    // Load current model selection
    setCurrentModel(getDefaultChatModel());
    
    // Load available chat models from API
    getChatModels().then(models => {
      if (models.length > 0) {
        setAvailableChatModels(models);
      }
    }).catch(err => console.warn('Failed to load chat models:', err));
    
    // Load Context Canvas state
    loadContextCanvas().then(() => {
      const stats = getTokenStats();
      setCanvasTokenCount(stats.usedTokens);
    }).catch(err => console.warn('Failed to load context canvas:', err));
    
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

  // Get short display name for a model
  const getModelDisplayName = (modelId: string): string => {
    // Check if we have metadata with a display name
    const meta = CHAT_MODEL_METADATA[modelId];
    if (meta?.displayName) {
      return meta.displayName;
    }
    // Fallback: extract readable name from model ID
    // e.g., "meta-llama/Llama-3.3-70B-Instruct-Turbo" → "Llama 3.3 70B"
    const parts = modelId.split('/');
    const name = parts[parts.length - 1];
    return name
      .replace(/-Instruct|-Turbo|-Free|-Chat/gi, '')
      .replace(/-/g, ' ')
      .trim();
  };

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

  // ============================================================================
  // VOICE INPUT (STT) HANDLERS
  // ============================================================================

  const handleVoiceToggle = async () => {
    if (isRecording) {
      // Stop recording and transcribe
      setIsRecording(false);
      setTranscribing(true);
      
      try {
        const stopResult = await stopRecording();
        if (!stopResult.success || !stopResult.audioBlob) {
          console.error('[Voice] Failed to stop recording:', stopResult.error);
          return;
        }
        
        // Transcribe the audio
        const transcribeResult = await transcribeAudio(stopResult.audioBlob);
        if (transcribeResult.success && transcribeResult.text) {
          // Append transcribed text to input
          setInput(prev => prev ? `${prev} ${transcribeResult.text}` : transcribeResult.text || '');
          textareaRef.current?.focus();
        } else {
          console.error('[Voice] Transcription failed:', transcribeResult.error);
          // Could show error toast here
        }
      } catch (e: any) {
        console.error('[Voice] Error:', e);
      } finally {
        setTranscribing(false);
      }
    } else {
      // Start recording
      const startResult = await startRecording();
      if (startResult.success) {
        setIsRecording(true);
      } else {
        console.error('[Voice] Failed to start recording:', startResult.error);
        // Could show error toast here
      }
    }
  };

  const handleVoiceCancel = () => {
    cancelRecording();
    setIsRecording(false);
    setTranscribing(false);
  };

  const handleCtrlEnterToggle = (checked: boolean) => {
    setCtrlEnterSend(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('openelara_ctrl_enter_send', String(checked));
    }
  };

  /**
   * Detect if user is requesting a selfie or video from the AI character
   * Must be explicit requests like "send me a pic" or "send me a video"
   */
  const detectMediaRequest = (text: string): 'selfie' | 'video' | null => {
    const normalized = text.toLowerCase().trim();
    
    // Selfie patterns - must be explicit requests
    const selfiePatterns = [
      /send\s+(?:me\s+)?(?:a\s+)?(?:pic|picture|photo|selfie|image)/i,
      /(?:take|snap|get)\s+(?:me\s+)?(?:a\s+)?(?:pic|picture|photo|selfie)/i,
      /(?:can\s+(?:i\s+)?(?:get|have|see)\s+)?(?:a\s+)?(?:pic|picture|photo|selfie)\s+(?:of\s+)?(?:you|yourself)/i,
      /show\s+me\s+(?:a\s+)?(?:pic|picture|photo|selfie)/i,
      /(?:want|like)\s+(?:to\s+)?(?:see\s+)?(?:a\s+)?(?:pic|picture|photo|selfie)\s+(?:of\s+)?you/i,
    ];
    
    // Video patterns - must be explicit requests
    const videoPatterns = [
      /send\s+(?:me\s+)?(?:a\s+)?video/i,
      /(?:take|record|make|get)\s+(?:me\s+)?(?:a\s+)?video/i,
      /(?:can\s+(?:i\s+)?(?:get|have|see)\s+)?(?:a\s+)?video\s+(?:of\s+)?(?:you|yourself)/i,
      /show\s+me\s+(?:a\s+)?video/i,
      /(?:want|like)\s+(?:to\s+)?(?:see\s+)?(?:a\s+)?video\s+(?:of\s+)?you/i,
    ];
    
    for (const pattern of selfiePatterns) {
      if (pattern.test(normalized)) {
        return 'selfie';
      }
    }
    
    for (const pattern of videoPatterns) {
      if (pattern.test(normalized)) {
        return 'video';
      }
    }
    
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setSending(true);
    
    // Capture and clear attached files
    const filesToProcess = [...attachedFiles];
    setAttachedFiles([]);

    // Check for Council Mode trigger
    const isCouncilMode = currentInput.toLowerCase().startsWith('[council mode]') ||
                          currentInput.toLowerCase().startsWith('[council]');
    
    // Check for media request (selfie/video) - LLM tool invocation
    const mediaRequest = detectMediaRequest(currentInput);

    try {
      // Get mood tracker and update from user message
      const moodTracker = getMoodTracker();
      // Content is always string for user messages in this context
      const messageText = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : userMessage.content.find(p => p.type === 'text')?.text || '';
      moodTracker.updateFromUserMessage(messageText);
      
      // Get active character
      const activeChar = character || getActiveCharacter();

      // ================== COUNCIL MODE ==================
      if (isCouncilMode) {
        // Strip the council mode prefix from the question
        const question = currentInput
          .replace(/^\[council\s*mode\]\s*/i, '')
          .replace(/^\[council\]\s*/i, '')
          .trim() || 'What are your thoughts?';

        try {
          const councilResult = await executeCouncilMode({
            userQuestion: question,
            conversationHistory: messages,
          });

          // Build a rich response with perspectives
          let councilResponse = '';
          
          if (councilResult.perspectives.length > 0) {
            councilResponse += '🏛️ **Council of Wisdom Perspectives:**\n\n';
            for (const p of councilResult.perspectives) {
              if (p.success) {
                councilResponse += `**${p.persona}** _(${p.role})_:\n${p.answer}\n\n`;
              }
            }
            councilResponse += '---\n\n';
            councilResponse += `**${councilResult.leadConsultant}'s Synthesis:**\n${councilResult.synthesis}`;
          } else {
            councilResponse = councilResult.synthesis || 'The council could not reach a consensus.';
          }

          const assistantMessage: ChatMessageWithMedia = {
            role: "assistant",
            content: councilResponse,
            thinking: councilResult.thinking,
          };

          setMessages((prev) => [...prev, assistantMessage]);
        } catch (e) {
          console.error('[Council Mode] Error:', e);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "The Council of Wisdom is unavailable at the moment. Please try again." },
          ]);
        }
        
        setSending(false);
        return; // Exit early - council mode handled
      }

      // ================== MEDIA REQUEST (SELFIE/VIDEO) ==================
      if (mediaRequest) {
        // User requested a selfie or video through natural language
        // Show an acknowledgment message, then trigger the generation panel
        const mediaAck: ChatMessageWithMedia = {
          role: "assistant",
          content: mediaRequest === 'selfie'
            ? `📸 Sure! Let me take a selfie for you...`
            : `🎬 Of course! Let me create a video for you...`,
        };
        setMessages((prev) => [...prev, mediaAck]);
        
        // Small delay for user to see the message, then open the panel
        setTimeout(() => {
          if (mediaRequest === 'selfie') {
            setShowImageGen(true);
          } else {
            setShowVideoGen(true);
          }
        }, 500);
        
        setSending(false);
        return; // Exit early - media request handled
      }

      // ================== REGULAR CHAT ==================
      // Build structured system prompt (from desktop promptConstants.js)
      
      // Get emotional context from mood tracker
      const moodContext = moodTracker.getPromptContext();
      
      const systemPrompt = buildChatSystemPrompt({
        userName: userDisplayName,
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
      
      // Process attached files - read content and prepare for context
      const processedFiles: Array<{ filename: string; content: string }> = [];
      for (const file of filesToProcess) {
        try {
          const content = await file.text();
          // Truncate very large files (max 50KB per file)
          const truncated = content.length > 50000 
            ? content.substring(0, 50000) + '\n... [File truncated - too large]'
            : content;
          processedFiles.push({ filename: file.name, content: truncated });
        } catch (e) {
          console.warn(`[Chat] Failed to read file ${file.name}:`, e);
        }
      }
      
      // Build Context Canvas content (persistent documents with ZERO truncation)
      let canvasContext = '';
      try {
        await loadContextCanvas();
        const canvasResult = buildFullCanvasContext();
        if (canvasResult.fileCount > 0) {
          canvasContext = canvasResult.content;
          setCanvasTokenCount(canvasResult.tokenCount);
          console.log(`[Chat] Context Canvas: ${canvasResult.fileCount} files, ~${canvasResult.tokenCount} tokens`);
        }
      } catch (e) {
        console.warn('[Chat] Context Canvas load failed (continuing without):', e);
      }
      
      // Build the enriched user message with Context Canvas + RAG context + attached files
      const contextPrefix = buildContextPrefix({ 
        ragContext,
        attachedFiles: processedFiles.length > 0 ? processedFiles : undefined,
      });
      
      // Combine: Canvas (persistent) + Context Prefix (RAG + attachments) + User Message
      const fullContext = canvasContext + contextPrefix;
      const enrichedContent = fullContext 
        ? fullContext + messageText 
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

      const assistantMessage: ChatMessageWithMedia = {
        role: "assistant",
        content: response.choices[0]?.message?.content || getErrorResponse('unknown'),
        thinking: response.choices[0]?.message?.thinking,  // Capture AI's reasoning
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

  const handlePromptSelect = (prompt: { content: string | object; type: string }) => {
    // Insert prompt content into chat input
    const content = typeof prompt.content === 'string' 
      ? prompt.content 
      : JSON.stringify(prompt.content);
    
    if (prompt.type === 'chat') {
      setInput(content);
      textareaRef.current?.focus();
    } else if (prompt.type === 'image') {
      // For image prompts, open the image generator with the prompt
      setShowImageGen(true);
      // TODO: Pass prompt to ImageGenPanel
    } else if (prompt.type === 'video') {
      setShowVideoGen(true);
      // TODO: Pass prompt to VideoGenPanel
    }
  };

  const handlePowerKnowledgeResult = (content: string) => {
    // Insert web research results into chat as context and prepare for analysis
    const contextMsg: ChatMessageWithMedia = {
      role: 'user',
      content: `[Web Research Context]\n\n${content}\n\n---\nPlease analyze or summarize this information.`,
    };
    setMessages(prev => [...prev, contextMsg]);
    
    // Set input for user to optionally modify and send
    setInput('Based on the web research above, please provide a helpful analysis or summary.');
    textareaRef.current?.focus();
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
  const charIconPath = character?.iconPath || '/characters/icon_elara.png';

  // Helper to render avatar (always uses image - no emoji fallback)
  const renderAvatar = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizes = {
      sm: { width: 28, height: 28 },
      md: { width: 40, height: 40 },
      lg: { width: 80, height: 80 },
    };
    const s = sizes[size];
    
    return (
      <img 
        src={charIconPath} 
        alt={charName}
        className="elara-avatar-img"
        style={{ width: s.width, height: s.height, borderRadius: '50%', objectFit: 'cover' }}
      />
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
    <>
      <TrialBanner />
      <div className="chat-container">
        {/* AI Disclaimer Modal */}
        {showDisclaimer && (
          <div className="disclaimer-modal">
            <div className="disclaimer-content">
              <h2>⚠️ AI Content Disclosure</h2>

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

            <h3>Content Guidelines</h3>
            <p>
              This application does <strong>not filter or moderate</strong> AI-generated content. The quality and appropriateness of outputs depend on your prompts and the AI providers you use.
            </p>

            <div className="disclaimer-accept">
              <button 
                className="nexus-btn nexus-btn-primary"
                onClick={handleAcceptDisclaimer}
              >
                I understand this application generates AI content
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

      {/* Prompt Manager Modal */}
      <PromptManager
        isOpen={showPromptManager}
        onClose={() => setShowPromptManager(false)}
        onSelectPrompt={handlePromptSelect}
      />

      {/* Knowledge Base Panel */}
      {showKnowledgePanel && (
        <div className="modal-overlay" onClick={() => setShowKnowledgePanel(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <KnowledgePanel onClose={() => setShowKnowledgePanel(false)} />
          </div>
        </div>
      )}

      {/* Storage Manager Panel */}
      {showStorageManager && (
        <div className="modal-overlay" onClick={() => setShowStorageManager(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <StorageManager onClose={() => setShowStorageManager(false)} />
          </div>
        </div>
      )}

      {/* Power Knowledge - Web Search & Research */}
      <PowerKnowledge
        isOpen={showPowerKnowledge}
        onClose={() => setShowPowerKnowledge(false)}
        onSendToChat={handlePowerKnowledgeResult}
      />

      {/* File Converter */}
      <FileConverter
        isOpen={showFileConverter}
        onClose={() => setShowFileConverter(false)}
      />

      {/* Context Canvas - Persistent Documents */}
      <ContextCanvas
        isOpen={showContextCanvas}
        onClose={() => {
          setShowContextCanvas(false);
          // Update token count when closing
          const stats = getTokenStats();
          setCanvasTokenCount(stats.usedTokens);
        }}
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
                <button className="menu-option" onClick={() => { handleNewChat(); setShowFileMenu(false); }}>✨ New Chat</button>
                <button className="menu-option" onClick={handleClearHistory}>🗑️ Clear Chat History</button>
                <button className="menu-option" onClick={handleExportChat}>💾 Export Chat</button>
                <button className="menu-option" onClick={() => { setShowContextCanvas(true); setShowFileMenu(false); }}>📌 Context Canvas</button>
                <button className="menu-option" onClick={() => { setShowPromptManager(true); setShowFileMenu(false); }}>📋 Prompt Manager</button>
                <button className="menu-option" onClick={() => { setShowKnowledgePanel(true); setShowFileMenu(false); }}>🧠 Knowledge Base</button>
                <button className="menu-option" onClick={() => { setShowStorageManager(true); setShowFileMenu(false); }}>💾 Storage Manager</button>
                <button className="menu-option" onClick={() => { setShowFileConverter(true); setShowFileMenu(false); }}>🔄 File Converter</button>
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

          {/* Tools - Power Knowledge */}
          <button 
            className="menu-label"
            onClick={() => setShowPowerKnowledge(true)}
            title="Web Search & Research"
          >
            🧠 Power Knowledge
          </button>

          {/* Account & Settings */}
          <button 
            className="menu-label"
            onClick={() => router.push("/account")}
          >
            ⚙️ Account
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
              <img 
                src={charIconPath} 
                alt={charName}
                className="persona-toggle-img"
              />
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

        <div className="ribbon-stat ribbon-model-selector" onClick={() => setShowModelSelector(true)}>
          <span className="ribbon-icon">🤖</span>
          <span className="ribbon-label">Model:</span>
          <span className="ribbon-value ribbon-model-value">
            {currentModel ? getModelDisplayName(currentModel) : 'Select Model'}
            <span className="model-dropdown-arrow">▼</span>
          </span>
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

        {/* Context Canvas Indicator */}
        <div className="ribbon-separator">•</div>
        <div 
          className={`ribbon-stat ribbon-canvas ${canvasTokenCount > 0 ? 'active' : ''}`}
          onClick={() => setShowContextCanvas(true)}
          title="Open Context Canvas - Pin documents for persistent AI context"
        >
          <span className="ribbon-icon">📌</span>
          <span className="ribbon-label">Canvas:</span>
          <span className="ribbon-value">
            {canvasTokenCount > 0 
              ? `${Math.round(canvasTokenCount / 1000)}k tokens` 
              : 'Empty'}
          </span>
        </div>
      </div>

      {/* Modal Overlays */}
      {showImageGen && (
        <div className="modal-overlay" onClick={() => setShowImageGen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ImageGenPanel 
              onClose={() => setShowImageGen(false)}
              onImageGenerated={handleImageGenerated}
              conversationContext={messages.slice(-5).map(m => 
                `${m.role}: ${typeof m.content === 'string' ? m.content : '[attachment]'}`
              ).join('\n')}
            />
          </div>
        </div>
      )}

      {showVideoGen && (
        <div className="modal-overlay" onClick={() => setShowVideoGen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <VideoGenPanel 
              onClose={() => setShowVideoGen(false)}
              conversationContext={messages.slice(-5).map(m => 
                `${m.role}: ${typeof m.content === 'string' ? m.content : '[attachment]'}`
              ).join('\n')}
            />
          </div>
        </div>
      )}

      {/* Model Selector Modal */}
      {showModelSelector && (
        <div className="modal-overlay" onClick={() => setShowModelSelector(false)}>
          <div className="model-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 Select Chat Model</h2>
              <button className="modal-close-btn" onClick={() => setShowModelSelector(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="model-selector-grid">
                {availableChatModels.length > 0 ? (
                  availableChatModels.map(model => (
                    <button
                      key={model.id}
                      className={`model-card ${model.id === currentModel ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentModel(model.id);
                        setSelectedModel('chat', model.id);
                        setShowModelSelector(false);
                      }}
                    >
                      <div className="model-card-header">
                        <span className="model-card-name">{model.metadata?.displayName || model.displayName || model.id.split('/').pop()}</span>
                        {model.id === currentModel && <span className="model-badge current">✓</span>}
                      </div>
                      <div className="model-card-badges">
                        {(model.metadata as any)?.free && <span className="model-badge free">FREE</span>}
                        {(model.metadata as any)?.recommended && <span className="model-badge rec">★ RECOMMENDED</span>}
                      </div>
                      {model.metadata?.description && (
                        <div className="model-card-description">{model.metadata.description}</div>
                      )}
                    </button>
                  ))
                ) : (
                  Object.entries(CHAT_MODEL_METADATA).map(([id, meta]) => (
                    <button
                      key={id}
                      className={`model-card ${id === currentModel ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentModel(id);
                        setSelectedModel('chat', id);
                        setShowModelSelector(false);
                      }}
                    >
                      <div className="model-card-header">
                        <span className="model-card-name">{meta.displayName}</span>
                        {id === currentModel && <span className="model-badge current">✓</span>}
                      </div>
                      <div className="model-card-badges">
                        {meta.free && <span className="model-badge free">FREE</span>}
                        {meta.recommended && <span className="model-badge rec">★ RECOMMENDED</span>}
                      </div>
                      {meta.description && (
                        <div className="model-card-description">{meta.description}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-container">
            <div className="welcome-avatar">
              <img 
                src={charIconPath} 
                alt={charName}
                className="elara-avatar-img elara-avatar-lg"
              />
              <div className="elara-status-indicator" />
            </div>
            <h2 className="welcome-title">
              Hey{userDisplayName && userDisplayName !== 'User' ? `, ${userDisplayName.split(" ")[0]}` : ""}! 👋
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
              <button 
                className="quick-prompt council-prompt"
                onClick={() => setInput("[Council Mode] ")}
                title="Consult the Council of Wisdom - all personas weigh in"
              >
                🏛️ Ask the Council
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
                <img 
                  src={charIconPath} 
                  alt={charName}
                  className="message-avatar-img"
                />
              </div>
            )}
            <div className="message-content">
              {/* Render AI thinking in collapsible section (desktop-style) */}
              {msg.role === 'assistant' && (msg as ChatMessageWithMedia).thinking && (
                <details className="thinking-section">
                  <summary className="thinking-toggle">
                    <span className="thinking-icon">💭</span>
                    <span className="thinking-label">Show reasoning</span>
                  </summary>
                  <div className="thinking-content">
                    {(msg as ChatMessageWithMedia).thinking}
                  </div>
                </details>
              )}
              
              <div style={{ whiteSpace: "pre-wrap" }}>
                {typeof msg.content === 'string' 
                  ? msg.content 
                  : msg.content.find(p => p.type === 'text')?.text || ''}
              </div>
              
              {/* Render generated image if present */}
              {(msg as ChatMessageWithMedia).image && (
                <div className="message-image-container">
                  <img 
                    src={(msg as ChatMessageWithMedia).image!.dataUrl} 
                    alt="Generated" 
                    className="message-image"
                    onClick={() => handleDownloadImage((msg as ChatMessageWithMedia).image!.signedContent, (msg as ChatMessageWithMedia).image!.prompt)}
                  />
                  <div className="image-actions">
                    <button 
                      className="nexus-btn nexus-btn-primary nexus-btn-sm"
                      onClick={() => handleDownloadImage((msg as ChatMessageWithMedia).image!.signedContent, (msg as ChatMessageWithMedia).image!.prompt)}
                    >
                      💾 Download with Metadata
                    </button>
                    <details className="image-metadata">
                      <summary>📋 Provenance</summary>
                      <pre>{(msg as ChatMessageWithMedia).image!.signedContent.metadataJson}</pre>
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
              <img 
                src={charIconPath} 
                alt={charName}
                className="message-avatar-img"
              />
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

        <div className="chat-form">
          {/* Quick Action Buttons - Selfie, Video & Context Canvas */}
          <div className="quick-action-buttons">
            <button
              type="button"
              className="quick-action-btn selfie-btn"
              title={`Request a selfie from ${charName}`}
              onClick={() => setShowImageGen(true)}
            >
              📸
            </button>
            <button
              type="button"
              className="quick-action-btn video-btn"
              title={`Request a video from ${charName}`}
              onClick={() => setShowVideoGen(true)}
            >
              🎬
            </button>
            <button
              type="button"
              className={`quick-action-btn canvas-btn ${canvasTokenCount > 0 ? 'active' : ''}`}
              title="Context Canvas - Pin documents"
              onClick={() => setShowContextCanvas(true)}
            >
              📌
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
            rows={3}
          />

          {/* Send Button with Attachments and Voice */}
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
              {/* Voice Input Button */}
              {isSTTSupported() && (
                <button 
                  type="button" 
                  className={`voice-btn ${isRecording ? 'recording' : ''} ${transcribing ? 'transcribing' : ''}`}
                  title={isRecording ? "Stop Recording" : transcribing ? "Transcribing..." : "Voice Input"}
                  onClick={handleVoiceToggle}
                  disabled={transcribing}
                >
                  {transcribing ? '⏳' : isRecording ? '⏹️' : '🎤'}
                </button>
              )}
              {isRecording && (
                <button 
                  type="button" 
                  className="voice-cancel-btn"
                  title="Cancel Recording"
                  onClick={handleVoiceCancel}
                >
                  ✕
                </button>
              )}
            </div>
            <button 
              className="send-btn-main" 
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? "..." : "Send"}
            </button>
            {/* Keyboard Shortcut Toggle */}
            <div className="keyboard-shortcut-container">
              <input 
                type="checkbox" 
                id="ctrl-enter-toggle" 
                checked={ctrlEnterSend}
                onChange={(e) => handleCtrlEnterToggle(e.target.checked)}
              />
              <label htmlFor="ctrl-enter-toggle">⌨️ Ctrl+Enter</label>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--main-bg-color);
          overflow: hidden;
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
          min-width: 200px;
          background: #1a1f2e;
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 8px;
          padding: 6px 0;
          z-index: 100;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.1);
        }

        .menu-option {
          display: block;
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: #f0f4f8;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .menu-option:hover {
          background: rgba(0, 212, 255, 0.15);
          color: #00d4ff;
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
          position: relative;
          z-index: 100;
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
          color: #d1d5db;
        }

        .mood-reset-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .mood-reset-btn:hover {
          background: rgba(139, 92, 246, 0.2);
          color: #00d4ff;
        }

        .ribbon-separator {
          color: #6b7280;
          opacity: 0.8;
        }

        .ribbon-icon {
          font-size: 14px;
        }

        .ribbon-label {
          color: #a8b2c1;
        }

        .ribbon-value {
          color: #f0f4f8;
          font-weight: 600;
        }

        /* ============== MODEL SELECTOR ============== */
        .ribbon-model-selector {
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .ribbon-model-selector:hover {
          background: rgba(0, 212, 255, 0.1);
        }

        .ribbon-model-value {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .model-dropdown-arrow {
          font-size: 10px;
          opacity: 0.6;
          transition: transform 0.2s ease;
        }

        .ribbon-model-selector:hover .model-dropdown-arrow {
          opacity: 1;
        }

        .model-selector-modal {
          background: var(--secondary-bg-color);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          max-width: 900px;
          width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }

        .model-selector-modal .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--glass-border);
        }

        .model-selector-modal .modal-header h2 {
          margin: 0;
          color: var(--accent-color);
          font-size: 1.5rem;
        }

        .model-selector-modal .modal-close-btn {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          font-size: 2rem;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .model-selector-modal .modal-close-btn:hover {
          color: var(--accent-color);
          transform: scale(1.1);
        }

        .model-selector-modal .modal-body {
          padding: 20px;
          overflow-y: auto;
        }

        .model-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .model-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px;
          background: rgba(0, 212, 255, 0.03);
          border: 2px solid var(--glass-border);
          border-radius: 12px;
          color: var(--main-text-color);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .model-card:hover {
          background: rgba(0, 212, 255, 0.08);
          border-color: var(--accent-color);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 212, 255, 0.2);
        }

        .model-card.active {
          background: rgba(0, 212, 255, 0.15);
          border: 2px solid var(--accent-color);
          box-shadow: 0 0 24px rgba(0, 212, 255, 0.3);
        }

        .model-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .model-card-name {
          font-weight: 600;
          font-size: 1rem;
          color: var(--accent-color);
          flex: 1;
        }

        .model-card-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .model-badge {
          font-size: 0.7rem;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          white-space: nowrap;
        }

        .model-badge.free {
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
          border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .model-badge.rec {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
          border: 1px solid rgba(255, 193, 7, 0.3);
        }

        .model-badge.current {
          background: rgba(0, 212, 255, 0.3);
          color: var(--accent-color);
          border: 1px solid var(--accent-color);
        }

        .model-card-description {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
          line-height: 1.5;
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

        .modal-container {
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          overflow: auto;
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

        /* ============== THINKING SECTION (Desktop-style) ============== */
        .thinking-section {
          margin-bottom: var(--spacing-sm);
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: var(--border-radius);
          overflow: hidden;
        }

        .thinking-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          color: #a78bfa;
          font-size: 0.85rem;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .thinking-toggle:hover {
          background: rgba(139, 92, 246, 0.15);
        }

        .thinking-icon {
          font-size: 1rem;
        }

        .thinking-label {
          opacity: 0.8;
        }

        .thinking-content {
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(139, 92, 246, 0.2);
          font-size: 0.85rem;
          line-height: 1.5;
          color: #d1d5db;
          white-space: pre-wrap;
          max-height: 300px;
          overflow-y: auto;
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

        .council-prompt {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.4);
          font-weight: 600;
        }

        .council-prompt:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(0, 212, 255, 0.2) 100%);
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
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
          gap: 6px;
          margin-top: 8px;
          font-size: 10px;
          color: var(--secondary-text-color);
        }

        .keyboard-shortcut-container input[type="checkbox"] {
          accent-color: var(--accent-color);
          cursor: pointer;
        }

        .keyboard-shortcut-container label {
          cursor: pointer;
          user-select: none;
        }

        .chat-form {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        /* Quick Action Buttons - Selfie & Video */
        .quick-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .quick-action-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.2s ease;
        }

        .quick-action-btn:hover {
          transform: scale(1.1);
        }

        .quick-action-btn.selfie-btn:hover {
          background: rgba(236, 72, 153, 0.2);
          border-color: #ec4899;
          box-shadow: 0 0 12px rgba(236, 72, 153, 0.3);
        }

        .quick-action-btn.video-btn:hover {
          background: rgba(139, 92, 246, 0.2);
          border-color: #8b5cf6;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
        }

        .quick-action-btn.canvas-btn:hover {
          background: rgba(0, 212, 255, 0.2);
          border-color: #00d4ff;
          box-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
        }

        .quick-action-btn.canvas-btn.active {
          background: rgba(0, 212, 255, 0.15);
          border-color: rgba(0, 212, 255, 0.5);
        }

        /* Context Canvas Ribbon Indicator */
        .ribbon-canvas {
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .ribbon-canvas:hover {
          background: rgba(0, 212, 255, 0.1);
        }

        .ribbon-canvas.active {
          background: rgba(0, 212, 255, 0.15);
          border: 1px solid rgba(0, 212, 255, 0.3);
        }

        .ribbon-canvas.active .ribbon-value {
          color: #00d4ff;
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

        /* Voice Input Button */
        .voice-btn {
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

        .voice-btn:hover:not(:disabled) {
          background: var(--glass-bg-hover);
          border-color: var(--accent-color);
        }

        .voice-btn.recording {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          animation: voicePulse 1s ease-in-out infinite;
        }

        .voice-btn.transcribing {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          cursor: wait;
        }

        .voice-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }

        .voice-cancel-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          border-radius: 4px;
          color: #ef4444;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .voice-cancel-btn:hover {
          background: rgba(239, 68, 68, 0.3);
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

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          /* Full viewport on mobile */
          .chat-container {
            height: 100vh;
            height: 100dvh; /* Dynamic viewport height for mobile browsers */
          }

          /* Menubar */
          .nexus-menubar {
            padding: 6px 12px;
            flex-wrap: wrap;
            gap: 6px;
          }

          .menu-label {
            padding: 4px 8px;
            font-size: 12px;
          }

          .persona-toggle-btn {
            padding: 4px 8px;
            font-size: 12px;
          }

          /* Stats ribbon - stack vertically on small screens */
          .stats-ribbon {
            flex-wrap: wrap;
            padding: 6px 12px;
            gap: 8px;
            font-size: 11px;
          }

          .ribbon-stat {
            gap: 4px;
          }

          .ribbon-separator {
            display: none;
          }

          .ribbon-model-selector {
            width: 100%;
            justify-content: center;
          }

          /* Messages container */
          .messages-container {
            padding: 12px 8px;
          }

          .chat-message {
            max-width: 92%;
            padding: 10px 12px;
          }

          .message-header {
            font-size: 0.8rem;
            margin-bottom: 6px;
          }

          .message-content {
            font-size: 0.95rem;
            line-height: 1.5;
          }

          /* Thinking boxes */
          .thinking-box {
            margin-top: 8px;
          }

          .thinking-header {
            padding: 8px 10px;
            font-size: 0.8rem;
          }

          .thinking-content {
            padding: 10px;
            font-size: 0.8rem;
          }

          /* Image in messages */
          .message-image-container {
            max-width: 100%;
          }

          .message-image {
            max-height: 300px;
          }

          /* Welcome screen */
          .welcome-container {
            padding: var(--spacing-md);
          }

          .welcome-title {
            font-size: 1.5rem;
          }

          .welcome-subtitle {
            font-size: 1rem;
          }

          .quick-prompts {
            max-width: 100%;
          }

          .quick-prompt {
            font-size: 0.8rem;
            padding: 8px 12px;
          }

          /* Input area - critical for mobile */
          .chat-input-area {
            padding: 10px 8px;
          }

          .chat-form {
            gap: 8px;
          }

          /* Quick action buttons - smaller on mobile */
          .quick-action-buttons {
            gap: 6px;
          }

          .quick-action-btn {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }

          /* Text input */
          .chat-textarea {
            font-size: 16px; /* Prevents zoom on iOS */
            min-height: 44px; /* Touch-friendly */
          }

          /* Input buttons row */
          .input-buttons-row {
            flex-wrap: wrap;
            gap: 6px;
          }

          .attach-btn,
          .voice-btn {
            width: 40px;
            height: 40px;
            font-size: 18px;
          }

          .send-btn-main {
            padding: 10px 20px;
            font-size: 14px;
            min-width: 80px;
          }

          /* Attached files */
          .attached-files {
            gap: 6px;
            margin-bottom: 8px;
          }

          .attached-file {
            font-size: 11px;
            padding: 4px 8px;
          }

          .file-name {
            max-width: 100px;
          }

          /* Model selector modal */
          .model-selector-modal {
            width: 95vw;
            max-height: 90vh;
          }

          .model-selector-modal .modal-header {
            padding: 16px;
          }

          .model-selector-modal .modal-header h2 {
            font-size: 1.25rem;
          }

          .model-selector-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .model-card {
            padding: 14px;
          }

          .model-card-name {
            font-size: 0.9rem;
          }

          .model-card-description {
            font-size: 0.8rem;
          }

          /* Disclaimer modal */
          .disclaimer-modal {
            padding: 12px;
          }

          .disclaimer-content {
            padding: 20px;
            max-height: 85vh;
          }

          .disclaimer-content h2 {
            font-size: 1.5rem;
          }

          .disclaimer-content h3 {
            font-size: 0.95rem;
          }

          .disclaimer-content p,
          .disclaimer-content ul {
            font-size: 0.85rem;
          }

          /* Keyboard shortcut toggle */
          .keyboard-shortcut-container {
            font-size: 11px;
            margin-top: 6px;
          }
        }

        /* Extra small screens (iPhone SE, small Android) */
        @media (max-width: 375px) {
          .nexus-menubar {
            padding: 4px 8px;
          }

          .stats-ribbon {
            padding: 4px 8px;
            font-size: 10px;
          }

          .messages-container {
            padding: 8px 4px;
          }

          .chat-message {
            max-width: 95%;
            padding: 8px 10px;
          }

          .message-content {
            font-size: 0.9rem;
          }

          .chat-input-area {
            padding: 8px 6px;
          }

          .quick-action-btn {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }

          .send-btn-main {
            padding: 8px 16px;
            font-size: 13px;
            min-width: 70px;
          }

          .welcome-title {
            font-size: 1.25rem;
          }

          .welcome-subtitle {
            font-size: 0.9rem;
          }
        }

        /* Landscape mobile */
        @media (max-width: 768px) and (orientation: landscape) {
          .stats-ribbon {
            display: none; /* Save space in landscape */
          }

          .messages-container {
            padding: 8px;
          }

          .chat-input-area {
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
    </>
  );
}
