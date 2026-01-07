/**
 * Image Generation Panel Component - AGENTIC WORKFLOW
 * 
 * PORTED FROM DESKTOP: The AI decides the scene based on mood/context
 * 
 * Flow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire
 * 3. AI's scene description goes to image generation model
 * 4. Result is character-authentic, not just generic
 * 5. Auto-stores to cloud storage for later download
 */

import { useState } from 'react';
import { 
  generateImage, 
  IMAGE_MODELS, 
  type GeneratedImage,
  generateAgenticSelfie,
} from '../lib/mediaGeneration';
import { getActiveCharacter } from '../lib/characters';
import { downloadWithMetadata } from '../lib/signing';
import { MoodTracker, getMoodState } from '../lib/mood';
import { storeMedia, cutMedia, formatBytes } from '../lib/storage';

interface ImageGenPanelProps {
  onClose: () => void;
  onImageGenerated?: (image: GeneratedImage) => void;
  conversationContext?: string; // Recent conversation for context
}

export default function ImageGenPanel({ onClose, onImageGenerated, conversationContext }: ImageGenPanelProps) {
  const [mode, setMode] = useState<'selfie' | 'custom'>('selfie');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('black-forest-labs/FLUX.1-schnell');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [storedMediaId, setStoredMediaId] = useState<string | null>(null);
  const [aiDecision, setAiDecision] = useState<string | null>(null); // Show what AI decided
  const [generationPhase, setGenerationPhase] = useState<string>(''); // UI feedback
  
  const character = getActiveCharacter();
  
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setAiDecision(null);
    setStoredMediaId(null);
    
    try {
      let image: GeneratedImage;
      
      if (mode === 'selfie') {
        // AGENTIC WORKFLOW: AI decides the scene based on mood/persona
        setGenerationPhase(`${character.name} is deciding the scene...`);
        
        // Get current mood state
        const moodState = getMoodState(character.id);
        
        // Generate with agentic workflow - AI chooses scene/attire
        const agenticResult = await generateAgenticSelfie({
          sceneSuggestion: prompt || undefined,
          model,
          character,
          moodState,
          conversationContext,
        });
        
        setAiDecision(agenticResult.aiSceneDecision);
        setGenerationPhase('Generating image...');
        
        image = agenticResult.image;
      } else {
        setGenerationPhase('Generating custom image...');
        image = await generateImage({ prompt, model });
      }
      
      // Auto-store to cloud for organized storage
      setGenerationPhase('Saving to cloud...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${character.name}_${mode}_${timestamp}.png`;
      
      try {
        const stored = await storeMedia(image.signedContent, filename, 'image/png');
        setStoredMediaId(stored.id);
      } catch (storageError: any) {
        console.warn('Could not store to cloud (continuing):', storageError.message);
        // Non-fatal - user can still download directly
      }
      
      setResult(image);
      setGenerationPhase('');
      onImageGenerated?.(image);
    } catch (e: any) {
      setError(e.message);
      setGenerationPhase('');
    } finally {
      setGenerating(false);
    }
  };
  
  // Download directly (without cloud)
  const handleDownloadDirect = () => {
    if (!result) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${character.name}_${mode}_${timestamp}.png`;
    downloadWithMetadata(result.signedContent, filename);
  };
  
  // Download and delete from cloud (CUT operation)
  const handleCut = async () => {
    if (!storedMediaId) {
      handleDownloadDirect();
      return;
    }
    
    try {
      await cutMedia(storedMediaId);
      setStoredMediaId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  return (
    <div className="image-gen-panel">
      <div className="panel-header">
        <h3>📸 Generate Image</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>
      
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button 
          className={`mode-btn ${mode === 'selfie' ? 'active' : ''}`}
          onClick={() => setMode('selfie')}
        >
          📸 {character.name} Selfie
        </button>
        <button 
          className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
          onClick={() => setMode('custom')}
        >
          🎨 Custom Image
        </button>
      </div>
      
      {/* Model Selection */}
      <div className="form-group">
        <label>Model</label>
        <select 
          value={model} 
          onChange={(e) => setModel(e.target.value)}
          className="nexus-input"
        >
          {Object.entries(IMAGE_MODELS).map(([id, config]) => (
            <option key={id} value={id}>{config.displayName}</option>
          ))}
        </select>
      </div>
      
      {/* Prompt Input */}
      <div className="form-group">
        <label>
          {mode === 'selfie' 
            ? `Scene Suggestion (optional) - ${character.name} will decide the final pose` 
            : 'Prompt'}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === 'selfie' 
            ? 'e.g., relaxing on a beach, at a coffee shop, in a garden...' 
            : 'Describe the image you want to create...'}
          className="nexus-input"
          rows={3}
        />
      </div>
      
      {/* Character Preview (Selfie Mode) */}
      {mode === 'selfie' && (
        <div className="character-preview">
          <div className="preview-header">
            <span className="preview-icon">{character.iconEmoji}</span>
            <span className="preview-name">{character.name}</span>
          </div>
          <p className="preview-description">
            {character.descriptionSafe.slice(0, 200)}...
          </p>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="form-error">⚠️ {error}</div>
      )}
      
      {/* Generation Phase Feedback */}
      {generationPhase && (
        <div className="generation-phase">
          <span className="nexus-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          {generationPhase}
        </div>
      )}
      
      {/* AI's Scene Decision (Agentic Workflow) */}
      {aiDecision && !generating && (
        <div className="ai-decision">
          <div className="ai-decision-header">
            <span className="ai-decision-icon">{character.iconEmoji}</span>
            <span className="ai-decision-label">{character.name}'s Decision</span>
          </div>
          <p className="ai-decision-text">{aiDecision}</p>
        </div>
      )}
      
      {/* Generate Button */}
      <button 
        onClick={handleGenerate}
        disabled={generating || (mode === 'custom' && !prompt.trim())}
        className="nexus-btn nexus-btn-primary nexus-btn-full"
      >
        {generating ? (
          <>
            <span className="nexus-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            {generationPhase || 'Generating...'}
          </>
        ) : (
          `Generate ${mode === 'selfie' ? 'Selfie' : 'Image'}`
        )}
      </button>
      
      {/* Result Display */}
      {result && (
        <div className="result-container">
          <img 
            src={result.signedContent.dataUrl} 
            alt="Generated" 
            className="result-image"
          />
          
          {/* Storage Status */}
          {storedMediaId && (
            <div className="storage-status">
              ☁️ Saved to cloud storage
            </div>
          )}
          
          <div className="result-actions">
            <button onClick={handleCut} className="nexus-btn nexus-btn-primary">
              📥 Download & Clear
            </button>
            <button onClick={handleDownloadDirect} className="nexus-btn nexus-btn-secondary">
              💾 Download Only
            </button>
          </div>
          
          <div className="result-hint">
            <p>💡 "Download & Clear" saves the file with metadata and removes it from cloud storage.</p>
          </div>
          
          <div className="result-metadata">
            <details>
              <summary>📋 Provenance Metadata</summary>
              <pre>{result.signedContent.metadataJson}</pre>
            </details>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .image-gen-panel {
          background: var(--glass-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
        }
        
        .panel-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          font-size: 1.25rem;
          cursor: pointer;
        }
        
        .close-btn:hover {
          color: var(--main-text-color);
        }
        
        .mode-toggle {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }
        
        .mode-btn {
          flex: 1;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          color: var(--secondary-text-color);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .mode-btn:hover {
          border-color: var(--accent-color);
        }
        
        .mode-btn.active {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
        
        .form-group {
          margin-bottom: var(--spacing-md);
        }
        
        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin-bottom: var(--spacing-xs);
        }
        
        .character-preview {
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }
        
        .preview-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
        }
        
        .preview-icon {
          font-size: 1.5rem;
        }
        
        .preview-name {
          font-weight: 600;
          color: var(--accent-color);
        }
        
        .preview-description {
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin: 0;
        }
        
        .result-container {
          margin-top: var(--spacing-lg);
          text-align: center;
        }
        
        .result-image {
          max-width: 100%;
          border-radius: var(--border-radius);
          box-shadow: var(--glow-primary);
        }
        
        .result-actions {
          margin-top: var(--spacing-md);
        }
        
        .result-metadata {
          margin-top: var(--spacing-md);
          text-align: left;
        }
        
        .result-metadata summary {
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 0.875rem;
        }
        
        .result-metadata pre {
          font-size: 0.75rem;
          background: var(--secondary-bg-color);
          padding: var(--spacing-sm);
          border-radius: var(--border-radius);
          overflow-x: auto;
          max-height: 200px;
        }
        
        .generation-phase {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--accent-color-subtle);
          border-radius: var(--border-radius);
          margin-bottom: var(--spacing-md);
          font-size: 0.875rem;
          color: var(--accent-color);
        }
        
        .ai-decision {
          background: linear-gradient(135deg, var(--glass-bg-secondary), var(--accent-color-subtle));
          border: 1px solid var(--accent-color);
          border-radius: var(--border-radius);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }
        
        .ai-decision-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
          font-weight: 600;
        }
        
        .ai-decision-icon {
          font-size: 1.25rem;
        }
        
        .ai-decision-label {
          color: var(--accent-color);
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .ai-decision-text {
          margin: 0;
          font-style: italic;
          color: var(--main-text-color);
          line-height: 1.5;
        }
        
        .storage-status {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: var(--border-radius);
          padding: var(--spacing-sm);
          margin: var(--spacing-md) 0;
          text-align: center;
          font-size: 0.875rem;
          color: var(--accent-color);
        }
        
        .result-hint {
          margin-top: var(--spacing-sm);
          padding: var(--spacing-sm);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
        }
        
        .result-hint p {
          margin: 0;
          font-size: 0.75rem;
          color: var(--secondary-text-color);
        }
      `}</style>
    </div>
  );
}
