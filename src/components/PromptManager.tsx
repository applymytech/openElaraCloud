/**
 * Prompt Manager Component - Quick Prompt Templates
 * 
 * PORTED FROM DESKTOP: prompt-manager/prompt-manager-renderer.js
 * 
 * Features:
 * - Predefined prompts for chat/image/video
 * - Character-specific templates
 * - Custom user prompts (saved to localStorage)
 * - Quick insert into chat/image/video generation
 */

import { useState, useEffect } from 'react';
import { getActiveCharacter, Character, ELARA, AERON, AELIRA, ANDROS, ARCHITECT } from '@/lib/characters';

// ============================================================================
// TYPES
// ============================================================================

export interface Prompt {
  id: string;
  name: string;
  type: 'chat' | 'image' | 'video';
  content: string | StructuredImagePrompt;
  isTemplate?: boolean;
  isBuiltIn?: boolean;
}

export interface StructuredImagePrompt {
  promptType: 'structured';
  character?: string;
  scene?: string;
  action?: string;
  attire?: string;
  effects?: string;
}

// ============================================================================
// BUILT-IN PROMPTS
// ============================================================================

const BUILTIN_CHAT_PROMPTS: Prompt[] = [
  {
    id: 'chat_creative_writer',
    name: '✍️ Creative Writer',
    type: 'chat',
    content: 'You are a creative writer with a vivid imagination. Help users develop stories, poems, and creative content.',
    isBuiltIn: true,
  },
  {
    id: 'chat_code_helper',
    name: '💻 Code Helper',
    type: 'chat',
    content: 'Help me write clean, efficient code. Explain your approach and suggest best practices.',
    isBuiltIn: true,
  },
  {
    id: 'chat_brainstorm',
    name: '💡 Brainstorm Partner',
    type: 'chat',
    content: 'Help me brainstorm ideas. Be creative, suggest unexpected angles, and build on my thoughts.',
    isBuiltIn: true,
  },
  {
    id: 'chat_teacher',
    name: '📚 Patient Teacher',
    type: 'chat',
    content: 'Explain this concept to me like I\'m a curious beginner. Use analogies and examples.',
    isBuiltIn: true,
  },
];

const BUILTIN_IMAGE_PROMPTS: Prompt[] = [
  {
    id: 'image_portrait',
    name: '📸 Portrait',
    type: 'image',
    content: 'professional portrait photography, soft lighting, shallow depth of field, elegant pose',
    isBuiltIn: true,
  },
  {
    id: 'image_action',
    name: '⚡ Action Shot',
    type: 'image',
    content: 'dynamic action pose, dramatic lighting, motion blur effects, intense expression',
    isBuiltIn: true,
  },
  {
    id: 'image_cozy',
    name: '☕ Cozy Scene',
    type: 'image',
    content: 'cozy indoor setting, warm lighting, comfortable atmosphere, relaxed pose with a cup of tea',
    isBuiltIn: true,
  },
  {
    id: 'image_fantasy',
    name: '🔮 Fantasy',
    type: 'image',
    content: 'magical fantasy setting, ethereal lighting, mystical atmosphere, enchanting pose',
    isBuiltIn: true,
  },
  {
    id: 'image_cyberpunk',
    name: '🌆 Cyberpunk',
    type: 'image',
    content: 'neon-lit cyberpunk cityscape, rain reflections, holographic displays, futuristic outfit',
    isBuiltIn: true,
  },
];

const BUILTIN_VIDEO_PROMPTS: Prompt[] = [
  {
    id: 'video_walk',
    name: '🚶 Walking Scene',
    type: 'video',
    content: 'walking confidently, camera follows from behind then circles around, cinematic lighting',
    isBuiltIn: true,
  },
  {
    id: 'video_wave',
    name: '👋 Greeting',
    type: 'video',
    content: 'looking at camera, smiling warmly, giving a friendly wave, soft focus background',
    isBuiltIn: true,
  },
  {
    id: 'video_dramatic',
    name: '🎭 Dramatic Turn',
    type: 'video',
    content: 'dramatic slow turn to face camera, hair flowing in wind, intense lighting, cinematic reveal',
    isBuiltIn: true,
  },
];

// ============================================================================
// LOCAL STORAGE
// ============================================================================

const STORAGE_KEY = 'elara_custom_prompts';

function loadCustomPrompts(): Prompt[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomPrompts(prompts: Prompt[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

// ============================================================================
// COMPONENT
// ============================================================================

interface PromptManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: Prompt) => void;
  filterType?: 'chat' | 'image' | 'video' | 'all';
}

export default function PromptManager({ 
  isOpen, 
  onClose, 
  onSelectPrompt,
  filterType = 'all'
}: PromptManagerProps) {
  const [filter, setFilter] = useState<'all' | 'chat' | 'image' | 'video'>(filterType === 'all' ? 'all' : filterType);
  const [customPrompts, setCustomPrompts] = useState<Prompt[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState<Partial<Prompt>>({ type: 'chat', name: '', content: '' });
  const [character, setCharacter] = useState<Character | null>(null);

  useEffect(() => {
    setCustomPrompts(loadCustomPrompts());
    setCharacter(getActiveCharacter());
  }, [isOpen]);

  // Combine all prompts
  const allPrompts: Prompt[] = [
    ...BUILTIN_CHAT_PROMPTS,
    ...BUILTIN_IMAGE_PROMPTS,
    ...BUILTIN_VIDEO_PROMPTS,
    // Character-specific templates
    ...(character ? [
      {
        id: `char_${character.id}_safe`,
        name: `📷 ${character.name} - Safe Description`,
        type: 'image' as const,
        content: character.descriptionSafe,
        isTemplate: true,
        isBuiltIn: true,
      },
      {
        id: `char_${character.id}_full`,
        name: `📷 ${character.name} - Full Description`,
        type: 'image' as const,
        content: character.description,
        isTemplate: true,
        isBuiltIn: true,
      },
    ] : []),
    ...customPrompts,
  ];

  // Filter prompts
  const filteredPrompts = filter === 'all' 
    ? allPrompts 
    : allPrompts.filter(p => p.type === filter);

  const handleAddPrompt = () => {
    if (!newPrompt.name || !newPrompt.content || !newPrompt.type) return;
    
    const prompt: Prompt = {
      id: `custom_${Date.now()}`,
      name: newPrompt.name,
      type: newPrompt.type as 'chat' | 'image' | 'video',
      content: newPrompt.content as string,
      isBuiltIn: false,
    };
    
    const updated = [...customPrompts, prompt];
    setCustomPrompts(updated);
    saveCustomPrompts(updated);
    setNewPrompt({ type: 'chat', name: '', content: '' });
    setShowAddForm(false);
  };

  const handleDeletePrompt = (id: string) => {
    const updated = customPrompts.filter(p => p.id !== id);
    setCustomPrompts(updated);
    saveCustomPrompts(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-manager-overlay" onClick={onClose}>
      <div className="prompt-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="pm-header">
          <h2>📋 Prompt Manager</h2>
          <button className="pm-close" onClick={onClose}>✕</button>
        </div>

        {/* Filter Tabs */}
        <div className="pm-tabs">
          <button 
            className={`pm-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`pm-tab ${filter === 'chat' ? 'active' : ''}`}
            onClick={() => setFilter('chat')}
          >
            💬 Chat
          </button>
          <button 
            className={`pm-tab ${filter === 'image' ? 'active' : ''}`}
            onClick={() => setFilter('image')}
          >
            📸 Image
          </button>
          <button 
            className={`pm-tab ${filter === 'video' ? 'active' : ''}`}
            onClick={() => setFilter('video')}
          >
            🎬 Video
          </button>
        </div>

        {/* Prompt List */}
        <div className="pm-prompts">
          {filteredPrompts.map(prompt => (
            <div 
              key={prompt.id} 
              className={`pm-prompt ${prompt.isTemplate ? 'template' : ''}`}
              onClick={() => {
                onSelectPrompt(prompt);
                onClose();
              }}
            >
              <div className="pm-prompt-header">
                <span className="pm-prompt-name">{prompt.name}</span>
                <span className={`pm-prompt-type type-${prompt.type}`}>
                  {prompt.type}
                </span>
              </div>
              <div className="pm-prompt-preview">
                {typeof prompt.content === 'string' 
                  ? prompt.content.slice(0, 100) + (prompt.content.length > 100 ? '...' : '')
                  : '[Structured Prompt]'}
              </div>
              {!prompt.isBuiltIn && (
                <button 
                  className="pm-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePrompt(prompt.id);
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Custom Prompt */}
        {showAddForm ? (
          <div className="pm-add-form">
            <input
              type="text"
              placeholder="Prompt Name"
              value={newPrompt.name}
              onChange={e => setNewPrompt({...newPrompt, name: e.target.value})}
            />
            <select 
              value={newPrompt.type}
              onChange={e => setNewPrompt({...newPrompt, type: e.target.value as 'chat' | 'image' | 'video'})}
            >
              <option value="chat">Chat</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <textarea
              placeholder="Prompt Content"
              value={newPrompt.content as string}
              onChange={e => setNewPrompt({...newPrompt, content: e.target.value})}
            />
            <div className="pm-form-buttons">
              <button className="pm-btn pm-btn-cancel" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button className="pm-btn pm-btn-save" onClick={handleAddPrompt}>
                Save Prompt
              </button>
            </div>
          </div>
        ) : (
          <button className="pm-add-btn" onClick={() => setShowAddForm(true)}>
            + Add Custom Prompt
          </button>
        )}

        <style jsx>{`
          .prompt-manager-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            backdrop-filter: blur(4px);
          }

          .prompt-manager-modal {
            background: var(--secondary-bg-color, #1a1f2e);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 212, 255, 0.1);
          }

          .pm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(0, 212, 255, 0.2);
          }

          .pm-header h2 {
            margin: 0;
            font-size: 1.25rem;
            background: linear-gradient(135deg, #00d4ff, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .pm-close {
            background: transparent;
            border: none;
            color: #9ca3af;
            font-size: 1.25rem;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            transition: all 0.2s ease;
          }

          .pm-close:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
          }

          .pm-tabs {
            display: flex;
            gap: 8px;
            padding: 12px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .pm-tab {
            padding: 8px 16px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #9ca3af;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pm-tab:hover {
            background: rgba(0, 212, 255, 0.1);
            border-color: rgba(0, 212, 255, 0.3);
          }

          .pm-tab.active {
            background: rgba(0, 212, 255, 0.15);
            border-color: #00d4ff;
            color: #00d4ff;
          }

          .pm-prompts {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .pm-prompt {
            position: relative;
            padding: 14px 16px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pm-prompt:hover {
            background: rgba(0, 212, 255, 0.1);
            border-color: rgba(0, 212, 255, 0.3);
            transform: translateX(4px);
          }

          .pm-prompt.template {
            border-left: 3px solid #a78bfa;
          }

          .pm-prompt-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }

          .pm-prompt-name {
            font-weight: 600;
            color: #f0f4f8;
          }

          .pm-prompt-type {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
          }

          .type-chat { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
          .type-image { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
          .type-video { background: rgba(236, 72, 153, 0.2); color: #ec4899; }

          .pm-prompt-preview {
            font-size: 13px;
            color: #9ca3af;
            line-height: 1.4;
            padding-right: 30px;
          }

          .pm-delete-btn {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .pm-prompt:hover .pm-delete-btn {
            opacity: 1;
          }

          .pm-add-btn {
            margin: 12px 20px 20px;
            padding: 12px;
            background: rgba(0, 212, 255, 0.1);
            border: 1px dashed rgba(0, 212, 255, 0.4);
            border-radius: 10px;
            color: #00d4ff;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pm-add-btn:hover {
            background: rgba(0, 212, 255, 0.2);
            border-style: solid;
          }

          .pm-add-form {
            margin: 12px 20px 20px;
            padding: 16px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .pm-add-form input,
          .pm-add-form select,
          .pm-add-form textarea {
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            color: #f0f4f8;
            font-size: 14px;
          }

          .pm-add-form textarea {
            min-height: 100px;
            resize: vertical;
          }

          .pm-form-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          }

          .pm-btn {
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pm-btn-cancel {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #9ca3af;
          }

          .pm-btn-cancel:hover {
            background: rgba(255, 255, 255, 0.05);
          }

          .pm-btn-save {
            background: linear-gradient(135deg, #00d4ff, #00a3cc);
            border: none;
            color: white;
            font-weight: 600;
          }

          .pm-btn-save:hover {
            transform: scale(1.02);
          }
        `}</style>
      </div>
    </div>
  );
}
