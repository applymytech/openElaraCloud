/**
 * Capability Cards - Show users what the AI can do
 * 
 * Displays available features based on configured API keys and settings.
 * Helps users understand the app's capabilities and how to enable them.
 */

import { useState, useEffect } from 'react';
import { hasOwnKeys, hasExaKey, hasTogetherKey } from '../lib/byok';

interface CapabilityCard {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  requiredKey?: string;
  action: () => void;
  actionLabel: string;
}

interface CapabilityCardsProps {
  onClose: () => void;
  onEnableDeepThought?: () => void;
  onOpenImageGen?: () => void;
  onOpenSettings?: () => void;
}

export default function CapabilityCards({
  onClose,
  onEnableDeepThought,
  onOpenImageGen,
  onOpenSettings,
}: CapabilityCardsProps) {
  const [capabilities, setCapabilities] = useState<CapabilityCard[]>([]);

  useEffect(() => {
    const hasChat = hasOwnKeys();
    const hasWebSearch = hasExaKey();
    const hasImageGen = hasTogetherKey();

    setCapabilities([
      {
        icon: '💬',
        title: 'Chat & Conversation',
        description: 'Have natural conversations with AI characters. Switch personas for different perspectives.',
        enabled: hasChat,
        requiredKey: hasChat ? undefined : 'Together.ai or OpenRouter',
        action: () => {
          if (!hasChat) onOpenSettings?.();
          onClose();
        },
        actionLabel: hasChat ? 'Start chatting' : 'Add API key',
      },
      {
        icon: '🧠',
        title: 'Deep Thought Mode',
        description: 'Multi-turn reasoning with autonomous tool use. The AI researches, creates images/videos, and synthesizes findings over multiple turns.',
        enabled: hasChat && hasWebSearch,
        requiredKey: !hasChat ? 'Together.ai/OpenRouter' : !hasWebSearch ? 'Exa.ai' : undefined,
        action: () => {
          if (hasChat && hasWebSearch) {
            onEnableDeepThought?.();
          } else {
            onOpenSettings?.();
          }
          onClose();
        },
        actionLabel: hasChat && hasWebSearch ? 'Enable Deep Thought' : 'Add required keys',
      },
      {
        icon: '🔍',
        title: 'Web Research',
        description: 'Search the live web, read URLs, and gather current information. Goes beyond AI training data.',
        enabled: hasWebSearch,
        requiredKey: hasWebSearch ? undefined : 'Exa.ai',
        action: () => {
          if (!hasWebSearch) onOpenSettings?.();
          onClose();
        },
        actionLabel: hasWebSearch ? 'Available in chat' : 'Add Exa key',
      },
      {
        icon: '🎨',
        title: 'Image Generation',
        description: 'Create images with FLUX models. Generate character selfies or custom scenes.',
        enabled: hasImageGen,
        requiredKey: hasImageGen ? undefined : 'Together.ai',
        action: () => {
          if (hasImageGen) {
            onOpenImageGen?.();
          } else {
            onOpenSettings?.();
          }
          onClose();
        },
        actionLabel: hasImageGen ? 'Generate image' : 'Add Together key',
      },
      {
        icon: '🎬',
        title: 'Video Generation',
        description: 'Create short videos with AI. Character scenes, animations, and more.',
        enabled: hasImageGen,
        requiredKey: hasImageGen ? undefined : 'Together.ai',
        action: () => {
          if (!hasImageGen) onOpenSettings?.();
          onClose();
        },
        actionLabel: hasImageGen ? 'Available in chat' : 'Add Together key',
      },
      {
        icon: '📄',
        title: 'Document Creation',
        description: 'Generate structured documents, reports, and content. Export in multiple formats.',
        enabled: hasChat,
        requiredKey: hasChat ? undefined : 'Together.ai or OpenRouter',
        action: () => {
          if (!hasChat) onOpenSettings?.();
          onClose();
        },
        actionLabel: hasChat ? 'Available in chat' : 'Add API key',
      },
      {
        icon: '🏛️',
        title: 'Council Mode',
        description: 'Consult all AI personas simultaneously. Get diverse perspectives synthesized into one answer.',
        enabled: hasChat,
        requiredKey: hasChat ? undefined : 'Together.ai or OpenRouter',
        action: () => {
          if (!hasChat) onOpenSettings?.();
          onClose();
        },
        actionLabel: hasChat ? 'Type [Council Mode]' : 'Add API key',
      },
      {
        icon: '🧠',
        title: 'Knowledge Base',
        description: 'Store documents and conversations for the AI to reference. Build persistent memory.',
        enabled: true,
        action: () => {
          onOpenSettings?.();
          onClose();
        },
        actionLabel: 'Manage knowledge',
      },
    ]);
  }, [onClose, onEnableDeepThought, onOpenImageGen, onOpenSettings]);

  return (
    <div className="capability-cards-modal">
      <div className="capability-cards-header">
        <h2>✨ What Can I Help With?</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="capability-cards-grid">
        {capabilities.map((card, idx) => (
          <div
            key={idx}
            className={`capability-card ${card.enabled ? 'enabled' : 'disabled'}`}
          >
            <div className="card-icon">{card.icon}</div>
            <h3 className="card-title">{card.title}</h3>
            <p className="card-description">{card.description}</p>

            {!card.enabled && card.requiredKey && (
              <div className="card-requirement">
                🔑 Requires: {card.requiredKey}
              </div>
            )}

            <button
              className={`card-action-btn ${card.enabled ? 'enabled' : 'disabled'}`}
              onClick={card.action}
            >
              {card.actionLabel}
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .capability-cards-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid rgba(100, 100, 255, 0.3);
          border-radius: 16px;
          padding: 32px;
          max-width: 1000px;
          width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .capability-cards-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .capability-cards-header h2 {
          margin: 0;
          font-size: 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .close-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 32px;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .capability-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .capability-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          transition: all 0.3s;
        }

        .capability-card.enabled {
          border-color: rgba(100, 255, 100, 0.3);
        }

        .capability-card.disabled {
          border-color: rgba(255, 255, 255, 0.1);
          opacity: 0.7;
        }

        .capability-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(100, 100, 255, 0.2);
        }

        .card-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #fff;
        }

        .card-description {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          flex-grow: 1;
          margin-bottom: 16px;
        }

        .card-requirement {
          font-size: 13px;
          color: #ffa500;
          padding: 8px 12px;
          background: rgba(255, 165, 0, 0.1);
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .card-action-btn {
          width: 100%;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .card-action-btn.enabled {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
        }

        .card-action-btn.enabled:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .card-action-btn.disabled {
          background: rgba(255, 165, 0, 0.2);
          color: #ffa500;
        }

        .card-action-btn.disabled:hover {
          background: rgba(255, 165, 0, 0.3);
        }

        @media (max-width: 768px) {
          .capability-cards-modal {
            width: 95%;
            padding: 20px;
          }

          .capability-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
