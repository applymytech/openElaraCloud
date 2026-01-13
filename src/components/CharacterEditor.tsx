/**
 * Character Editor Component
 *
 * Allows users to:
 * - Create custom characters with all the special fields
 * - Edit existing custom characters
 * - Preview character descriptions
 */

import { useEffect, useState } from "react";
import {
	type Character,
	createBlankCharacter,
	deleteCustomCharacter,
	getActiveCharacter,
	getAllCharacters,
	saveCustomCharacter,
	setActiveCharacter,
} from "../lib/characters";

interface CharacterEditorProps {
	onClose: () => void;
	onCharacterSelected?: (character: Character) => void;
}

export default function CharacterEditor({ onClose, onCharacterSelected }: CharacterEditorProps) {
	const [characters, setCharacters] = useState<Character[]>([]);
	const [activeId, setActiveId] = useState<string>("elara");
	const [editing, setEditing] = useState<Character | null>(null);
	const [saving, setSaving] = useState(false);

	const loadCharacters = () => {
		const allChars = getAllCharacters();
		setCharacters(allChars);
		setActiveId(getActiveCharacter().id);
	};

	useEffect(() => {
		loadCharacters();
	}, []);

	const handleSelectCharacter = (char: Character) => {
		setActiveCharacter(char.id);
		setActiveId(char.id);
		onCharacterSelected?.(char);
	};

	const handleCreateNew = () => {
		setEditing(createBlankCharacter());
	};

	const handleEditCharacter = (char: Character) => {
		if (char.isBuiltIn) {
			// Can't edit built-in, but can clone
			setEditing({
				...char,
				id: `custom_${Date.now()}`,
				name: `${char.name} (Custom)`,
				isBuiltIn: false,
			});
		} else {
			setEditing({ ...char });
		}
	};

	const handleDeleteCharacter = (char: Character) => {
		if (char.isBuiltIn) {
			return;
		}

		if (confirm(`Delete "${char.name}"? This cannot be undone.`)) {
			deleteCustomCharacter(char.id);
			loadCharacters();
		}
	};

	const handleSave = () => {
		if (!editing) {
			return;
		}

		setSaving(true);
		try {
			saveCustomCharacter(editing);
			loadCharacters();
			setEditing(null);
		} catch (e: any) {
			alert(`Failed to save: ${e.message}`);
		} finally {
			setSaving(false);
		}
	};

	const updateField = (field: keyof Character, value: any) => {
		if (!editing) {
			return;
		}
		setEditing({ ...editing, [field]: value });
	};

	// Editor View
	if (editing) {
		return (
			<div className="character-editor">
				<div className="editor-header">
					<h3>{editing.id.startsWith("custom_") && !editing.name ? "Create Character" : `Edit: ${editing.name}`}</h3>
					<button onClick={() => setEditing(null)} className="close-btn">
						✕
					</button>
				</div>

				<div className="editor-form">
					{/* Basic Info */}
					<div className="form-section">
						<h4>Basic Info</h4>

						<div className="form-row">
							<div className="form-group">
								<label>Name *</label>
								<input
									type="text"
									value={editing.name}
									onChange={(e) => updateField("name", e.target.value)}
									placeholder="Character name"
									className="nexus-input"
								/>
							</div>

							<div className="form-group">
								<label>Icon Emoji</label>
								<input
									type="text"
									value={editing.iconEmoji}
									onChange={(e) => updateField("iconEmoji", e.target.value)}
									placeholder="🦊"
									className="nexus-input"
									maxLength={2}
								/>
							</div>
						</div>
					</div>

					{/* Physical Description */}
					<div className="form-section">
						<h4>Physical Description</h4>
						<p className="form-hint">Used for generating selfies and images</p>

						<div className="form-group">
							<label>Full Description (for image gen) *</label>
							<textarea
								value={editing.description}
								onChange={(e) => updateField("description", e.target.value)}
								placeholder="Detailed physical appearance for image generation..."
								className="nexus-input"
								rows={4}
							/>
						</div>

						<div className="form-group">
							<label>Safe Description (no explicit content)</label>
							<textarea
								value={editing.descriptionSafe}
								onChange={(e) => updateField("descriptionSafe", e.target.value)}
								placeholder="Family-friendly description..."
								className="nexus-input"
								rows={3}
							/>
						</div>

						<div className="form-group">
							<label>First-Person Description</label>
							<textarea
								value={editing.descriptionFirstPerson}
								onChange={(e) => updateField("descriptionFirstPerson", e.target.value)}
								placeholder="How the character describes themselves..."
								className="nexus-input"
								rows={3}
							/>
						</div>

						<div className="form-group">
							<label>Attire / Clothing</label>
							<textarea
								value={editing.attire}
								onChange={(e) => updateField("attire", e.target.value)}
								placeholder="Default clothing and accessories..."
								className="nexus-input"
								rows={2}
							/>
						</div>

						<div className="form-group">
							<label>Negative Prompt</label>
							<textarea
								value={editing.negativePrompt}
								onChange={(e) => updateField("negativePrompt", e.target.value)}
								placeholder="Things to avoid in image gen (e.g., 'extra limbs, blurry, low quality')"
								className="nexus-input"
								rows={2}
							/>
						</div>
					</div>

					{/* Personality */}
					<div className="form-section">
						<h4>Personality</h4>

						<div className="form-group">
							<label>Persona / System Prompt *</label>
							<textarea
								value={editing.persona}
								onChange={(e) => updateField("persona", e.target.value)}
								placeholder="The character's personality, behaviors, and communication style..."
								className="nexus-input"
								rows={6}
							/>
						</div>
					</div>

					{/* Voice Profile */}
					<div className="form-section">
						<h4>Voice Profile</h4>
						<p className="form-hint">Used for TTS (text-to-speech)</p>

						<div className="form-row">
							<div className="form-group">
								<label>Voice ID/Name</label>
								<input
									type="text"
									value={editing.voiceProfile?.voice || ""}
									onChange={(e) =>
										updateField("voiceProfile", {
											...editing.voiceProfile,
											voice: e.target.value,
										})
									}
									placeholder="Voice identifier"
									className="nexus-input"
								/>
							</div>

							<div className="form-group">
								<label>TTS Engine</label>
								<select
									value={editing.voiceProfile?.ttsEngine || "together"}
									onChange={(e) =>
										updateField("voiceProfile", {
											...editing.voiceProfile,
											ttsEngine: e.target.value,
										})
									}
									className="nexus-input"
								>
									<option value="together">Together Kokoro</option>
									<option value="elevenlabs">ElevenLabs</option>
									<option value="browser">Browser TTS</option>
								</select>
							</div>
						</div>

						<div className="form-group">
							<label>Voice Characteristics</label>
							<input
								type="text"
								value={editing.voiceProfile?.voiceCharacteristics || ""}
								onChange={(e) =>
									updateField("voiceProfile", {
										...editing.voiceProfile,
										voiceCharacteristics: e.target.value,
									})
								}
								placeholder="e.g., warm, playful, energetic"
								className="nexus-input"
							/>
						</div>
					</div>

					{/* Emotional Profile */}
					<div className="form-section">
						<h4>Emotional Profile</h4>
						<p className="form-hint">Defines emotional patterns (0-100 scale)</p>

						<div className="form-row">
							<div className="form-group">
								<label>Baseline Mood (0-100)</label>
								<input
									type="number"
									min="0"
									max="100"
									value={editing.emotionalProfile?.baseline || 65}
									onChange={(e) =>
										updateField("emotionalProfile", {
											...editing.emotionalProfile,
											baseline: parseInt(e.target.value, 10),
										})
									}
									className="nexus-input"
								/>
							</div>

							<div className="form-group">
								<label>Sensitivity (0-2)</label>
								<input
									type="number"
									min="0"
									max="2"
									step="0.1"
									value={editing.emotionalProfile?.sensitivity || 1}
									onChange={(e) =>
										updateField("emotionalProfile", {
											...editing.emotionalProfile,
											sensitivity: parseFloat(e.target.value),
										})
									}
									className="nexus-input"
								/>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="editor-actions">
						<button onClick={() => setEditing(null)} className="nexus-btn nexus-btn-secondary">
							Cancel
						</button>
						<button
							onClick={handleSave}
							disabled={saving || !editing.name.trim() || !editing.description.trim()}
							className="nexus-btn nexus-btn-primary"
						>
							{saving ? "Saving..." : "Save Character"}
						</button>
					</div>
				</div>

				<style jsx>{`
          .character-editor {
            background: var(--glass-bg-primary);
            border: 1px solid var(--glass-border);
            border-radius: var(--border-radius-lg);
            padding: var(--spacing-lg);
            width: 100%;
            max-width: 100%;
            max-height: 90vh;
            overflow-y: auto;
          }
          
          .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-lg);
          }
          
          .editor-header h3 {
            margin: 0;
          }
          
          .close-btn {
            background: none;
            border: none;
            color: var(--secondary-text-color);
            font-size: 1.25rem;
            cursor: pointer;
          }
          
          .editor-form {
            width: 100%;
          }
          
          .form-section {
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-lg);
            border-bottom: 1px solid var(--glass-border);
          }
          
          .form-section h4 {
            margin: 0 0 var(--spacing-xs);
            color: var(--accent-color);
          }
          
          .form-hint {
            font-size: 0.75rem;
            color: var(--secondary-text-color);
            margin: 0 0 var(--spacing-md);
          }
          
          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-md);
          }
          
          .form-group {
            margin-bottom: var(--spacing-md);
            width: 100%;
          }
          
          .form-group label {
            display: block;
            font-size: 0.875rem;
            color: var(--secondary-text-color);
            margin-bottom: var(--spacing-xs);
          }
          
          .form-group .nexus-input {
            width: 100%;
          }
          
          .form-group textarea.nexus-input {
            width: 100%;
            resize: vertical;
          }
          
          .editor-actions {
            display: flex;
            gap: var(--spacing-md);
            justify-content: flex-end;
          }
        `}</style>
			</div>
		);
	}

	// Character List View
	return (
		<div className="character-selector">
			<div className="selector-header">
				<h3>🎭 Characters</h3>
				<button onClick={onClose} className="close-btn">
					✕
				</button>
			</div>

			<p className="selector-hint">Select an AI character to chat with. Custom characters get all the same features!</p>

			{/* Character List */}
			<div className="character-list">
				{characters.map((char) => (
					<div
						key={char.id}
						className={`character-card ${activeId === char.id ? "active" : ""}`}
						onClick={() => handleSelectCharacter(char)}
					>
						<div className="card-main">
							{char.iconPath ? (
								<img src={char.iconPath} alt={char.name} className="card-avatar" />
							) : (
								<div className="card-avatar-placeholder" />
							)}
							<div className="card-info">
								<div className="card-name">
									{char.name}
									{char.isBuiltIn && <span className="badge">Built-in</span>}
								</div>
								<div className="card-description">{char.descriptionSafe.slice(0, 80)}...</div>
							</div>
						</div>

						<div className="card-actions">
							<button
								onClick={(e) => {
									e.stopPropagation();
									handleEditCharacter(char);
								}}
								className="action-btn"
								title={char.isBuiltIn ? "Clone" : "Edit"}
							>
								{char.isBuiltIn ? "📋" : "✏️"}
							</button>
							{!char.isBuiltIn && (
								<button
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteCharacter(char);
									}}
									className="action-btn delete"
									title="Delete"
								>
									🗑️
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Create New */}
			<button onClick={handleCreateNew} className="nexus-btn nexus-btn-primary nexus-btn-full">
				✨ Create New Character
			</button>

			<style jsx>{`
        .character-selector {
          background: var(--glass-bg-primary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
          width: 100%;
          max-width: 100%;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
        }
        
        .selector-header h3 {
          margin: 0;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          font-size: 1.25rem;
          cursor: pointer;
        }
        
        .selector-hint {
          font-size: 0.875rem;
          color: var(--secondary-text-color);
          margin: 0 0 var(--spacing-lg);
        }
        
        .character-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }
        
        .character-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .character-card:hover {
          border-color: var(--accent-color);
        }
        
        .character-card.active {
          border-color: var(--accent-color);
          box-shadow: var(--glow-primary);
        }
        
        .card-main {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          flex: 1;
          min-width: 0;
        }
        
        .card-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--glass-border);
          flex-shrink: 0;
        }
        
        .character-card.active .card-avatar {
          border-color: var(--accent-color);
          box-shadow: var(--glow-primary);
        }
        
        .card-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--glass-bg-secondary);
          border: 2px solid var(--glass-border);
          flex-shrink: 0;
        }
        
        .card-info {
          min-width: 0;
        }
        
        .card-name {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }
        
        .badge {
          font-size: 0.625rem;
          background: var(--accent-color);
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
        }
        
        .card-description {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .card-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
        
        .action-btn {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity var(--transition-fast);
        }
        
        .action-btn:hover {
          opacity: 1;
        }
        
        .action-btn.delete:hover {
          filter: hue-rotate(180deg);
        }
      `}</style>
		</div>
	);
}
