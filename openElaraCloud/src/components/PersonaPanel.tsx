/**
 * Persona Panel - Desktop-Style Character Switcher
 * 
 * PORTED FROM DESKTOP APP UI
 * 
 * Features:
 * - Slide-out panel matching desktop's persona-panel
 * - Character cards with actual profile images
 * - Role badges (Default, Business, Tactical, Philosophical)
 * - Active character indicator
 * - Image fallback to emoji
 */

import { Character, ELARA, AERON, AELIRA, ANDROS, getActiveCharacter, setActiveCharacter } from '@/lib/characters';
import { useState, useEffect } from 'react';

interface PersonaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCharacterSelected: (character: Character) => void;
}

// Built-in characters with their metadata
const BUILT_IN_CHARACTERS = [
  { 
    character: ELARA, 
    role: 'Creative Partner', 
    badge: 'Default', 
    badgeClass: 'default',
    fallbackEmoji: '👩‍🎨'
  },
  { 
    character: ANDROS, 
    role: 'Business Pro', 
    badge: '⭐ Business', 
    badgeClass: 'business',
    fallbackEmoji: '👨‍💼'
  },
  { 
    character: AERON, 
    role: 'Tactical Mind', 
    badge: 'Strategy', 
    badgeClass: 'tactical',
    fallbackEmoji: '⚔️'
  },
  { 
    character: AELIRA, 
    role: 'Wisdom Keeper', 
    badge: 'Philosophy', 
    badgeClass: 'philosophical',
    fallbackEmoji: '🔮'
  },
];

export default function PersonaPanel({ isOpen, onClose, onCharacterSelected }: PersonaPanelProps) {
  const [activeCharacter, setActive] = useState<Character | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActive(getActiveCharacter());
  }, [isOpen]);

  const handleSelect = (character: Character) => {
    setActiveCharacter(character.id);
    setActive(character);
    onCharacterSelected(character);
    onClose();
  };

  const handleImageError = (charId: string) => {
    setImageErrors(prev => new Set(prev).add(charId));
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="persona-backdrop" 
          onClick={onClose}
        />
      )}
      
      {/* Slide-out Panel */}
      <div className={`persona-panel ${isOpen ? 'open' : ''}`}>
        <div className="persona-panel-header">
          <h3>
            <span className="persona-header-icon">👥</span>
            Switch Persona
          </h3>
          <button className="persona-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="persona-panel-content">
          <div className="persona-grid">
            {BUILT_IN_CHARACTERS.map(({ character, role, badge, badgeClass, fallbackEmoji }) => (
              <div
                key={character.id}
                className={`persona-card ${activeCharacter?.id === character.id ? 'active' : ''}`}
                onClick={() => handleSelect(character)}
                title={`Switch to ${character.name}`}
              >
                <div className="persona-avatar">
                  {character.iconPath && !imageErrors.has(character.id) ? (
                    <img
                      src={character.iconPath}
                      alt={character.name}
                      onError={() => handleImageError(character.id)}
                    />
                  ) : (
                    <span className="persona-avatar-fallback">{fallbackEmoji}</span>
                  )}
                </div>
                <div className="persona-info">
                  <span className="persona-name">{character.name}</span>
                  <span className="persona-role">{role}</span>
                </div>
                <span className={`persona-badge ${badgeClass}`}>{badge}</span>
              </div>
            ))}
          </div>

          <div className="persona-info-footer">
            <p>💡 Each persona has isolated memory. Switching clears the current chat.</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .persona-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 900;
          backdrop-filter: blur(2px);
        }

        .persona-panel {
          position: fixed;
          top: 64px;
          right: 0;
          width: 320px;
          max-height: calc(100vh - 80px);
          background: rgba(19, 24, 33, 0.95);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0 0 0 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(139, 92, 246, 0.15);
          z-index: 901;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .persona-panel.open {
          transform: translateX(0);
        }

        .persona-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .persona-panel-header h3 {
          font-size: 14px;
          font-weight: 700;
          color: #a78bfa;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .persona-header-icon {
          font-size: 16px;
        }

        .persona-panel-close {
          background: transparent;
          border: none;
          color: var(--secondary-text-color);
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .persona-panel-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ff5757;
        }

        .persona-panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .persona-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .persona-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .persona-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(139, 92, 246, 0.5);
          transform: translateX(-4px);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
        }

        .persona-card.active {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
          border-color: #8b5cf6;
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.25), inset 0 0 20px rgba(139, 92, 246, 0.1);
        }

        .persona-card.active::before {
          content: '✓';
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          background: #8b5cf6;
          color: white;
          font-size: 12px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .persona-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 2px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .persona-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .persona-avatar-fallback {
          font-size: 24px;
        }

        .persona-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .persona-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--main-text-color);
        }

        .persona-role {
          font-size: 11px;
          color: var(--secondary-text-color);
        }

        .persona-badge {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--secondary-text-color);
        }

        .persona-badge.default {
          background: rgba(0, 212, 255, 0.15);
          color: #00d4ff;
        }

        .persona-badge.business {
          background: rgba(234, 179, 8, 0.15);
          color: #f59e0b;
        }

        .persona-badge.tactical {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .persona-badge.philosophical {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }

        .persona-info-footer {
          margin-top: 12px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .persona-info-footer p {
          font-size: 11px;
          color: var(--secondary-text-color);
          margin: 0;
          text-align: center;
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .persona-panel {
            width: 100%;
            max-width: 320px;
            border-radius: 16px 0 0 16px;
          }
        }
      `}</style>
    </>
  );
}
