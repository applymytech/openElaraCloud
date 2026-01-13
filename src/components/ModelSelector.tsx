/**
 * ModelSelector Component - Enhanced Model Selection Modal
 *
 * ████████████████████████████████████████████████████████████████████████████
 * █                                                                          █
 * █   🚫 NO HARDCODED MODELS - All models discovered via /models API 🚫      █
 * █   Models are verified by ping test on app load.                          █
 * █   Response times shown for speed comparison.                             █
 * █                                                                          █
 * ████████████████████████████████████████████████████████████████████████████
 *
 * Features:
 * - Provider detection from available API keys
 * - Tabbed interface for each provider
 * - Free models at top (verified working), then grouped by publisher
 * - Response time indicators for speed comparison
 * - Star/favorite system with localStorage persistence
 * - Custom REST API support (OpenAI-compatible)
 */

import { useEffect, useMemo, useState } from "react";
import { getAllAPIKeysSync } from "@/lib/byok";
import { useModelVerification } from "@/lib/useModelVerification";

// ============================================================================
// TYPES
// ============================================================================

interface ModelSelectorProps {
	currentModel: string;
	onSelect: (modelId: string) => void;
	onClose: () => void;
}

interface GroupedModel {
	id: string;
	displayName: string;
	publisher: string;
	isFavorite: boolean;
	isFree: boolean;
	isVerified: boolean;
	responseTimeMs: number | null;
	contextLength: number;
	pricing: { input: number; output: number };
	error?: string;
}

type Provider = "together" | "openrouter" | "custom";

// ============================================================================
// HELPERS
// ============================================================================

function formatResponseTime(ms: number | null): string {
	if (ms === null) {
		return "";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatPrice(price: number): string {
	if (price === 0) {
		return "FREE";
	}
	if (price < 0) {
		return ""; // Unknown
	}
	// Price is per 1M tokens
	if (price < 0.01) {
		return `$${(price * 1000).toFixed(3)}/K`;
	}
	return `$${price.toFixed(2)}/M`;
}

function getSpeedBadge(ms: number | null): { label: string; class: string } | null {
	if (ms === null) {
		return null;
	}
	if (ms < 500) {
		return { label: "⚡ FAST", class: "speed-fast" };
	}
	if (ms < 1500) {
		return { label: "🏃 QUICK", class: "speed-quick" };
	}
	if (ms < 3000) {
		return { label: "🐢 SLOW", class: "speed-slow" };
	}
	return { label: "🦥 VERY SLOW", class: "speed-very-slow" };
}

// ============================================================================
// FAVORITES MANAGEMENT
// ============================================================================

const FAVORITES_KEY = "elara_favorite_models";

function getFavorites(): Set<string> {
	if (typeof window === "undefined") {
		return new Set();
	}
	const stored = localStorage.getItem(FAVORITES_KEY);
	return stored ? new Set(JSON.parse(stored)) : new Set();
}

function toggleFavorite(modelId: string): void {
	if (typeof window === "undefined") {
		return;
	}
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
	const keys = getAllAPIKeysSync();
	const providers: Provider[] = [];

	if (keys.together) {
		providers.push("together");
	}
	if (keys.openrouter) {
		providers.push("openrouter");
	}

	// Check for custom REST API keys (stored with custom_ prefix)
	if (typeof window !== "undefined") {
		const customKeys = Object.keys(localStorage).filter((k) => k.startsWith("elara_apikey_custom_"));
		if (customKeys.length > 0) {
			providers.push("custom");
		}
	}

	return providers;
}

function getProviderName(provider: Provider): string {
	switch (provider) {
		case "together":
			return "🚀 Together.ai";
		case "openrouter":
			return "🌐 OpenRouter";
		case "custom":
			return "⚙️ Custom API";
		default:
			return provider;
	}
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ModelSelector({ currentModel, onSelect, onClose }: ModelSelectorProps) {
	const [activeTab, setActiveTab] = useState<Provider>("together");
	const [favorites, setFavorites] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	// Get verified models from the verification service
	const together = useModelVerification("together", { autoRefresh: false });
	const openrouter = useModelVerification("openrouter", { autoRefresh: false });

	const availableProviders = useMemo(() => detectAvailableProviders(), []);

	useEffect(() => {
		setFavorites(getFavorites());
		// Set initial tab to first available provider
		if (availableProviders.length > 0 && !availableProviders.includes(activeTab)) {
			setActiveTab(availableProviders[0]);
		}
	}, [availableProviders, activeTab]);

	const handleToggleFavorite = (modelId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		toggleFavorite(modelId);
		setFavorites(getFavorites());
	};

	// Get verification data for current tab
	const currentVerification = activeTab === "together" ? together : openrouter;

	// Merge verified models with any legacy models
	const filteredModels = useMemo(() => {
		const verifiedModels = currentVerification.models;

		// Convert verified models to GroupedModel format
		const models: GroupedModel[] = verifiedModels
			.filter((m) => m.isVerified && !m.error) // Only show working models
			.map((m) => ({
				id: m.id,
				displayName: m.displayName,
				publisher: m.publisher,
				isFavorite: favorites.has(m.id),
				isFree: m.isFree,
				isVerified: m.isVerified,
				responseTimeMs: m.responseTimeMs,
				contextLength: m.contextLength,
				pricing: m.pricing,
			}));

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			return models.filter(
				(m) =>
					m.id.toLowerCase().includes(query) ||
					m.displayName.toLowerCase().includes(query) ||
					m.publisher.toLowerCase().includes(query),
			);
		}

		return models;
	}, [currentVerification.models, favorites, searchQuery]);

	// Sort models: favorites → free (by speed) → paid (by publisher)
	const sortedModels = useMemo(() => {
		return [...filteredModels].sort((a, b) => {
			// 1. Favorites first
			if (a.isFavorite && !b.isFavorite) {
				return -1;
			}
			if (!a.isFavorite && b.isFavorite) {
				return 1;
			}

			// 2. Free models next, sorted by response time
			if (a.isFree && !b.isFree) {
				return -1;
			}
			if (!a.isFree && b.isFree) {
				return 1;
			}

			// 3. Within same tier, sort by response time (faster first)
			if (a.responseTimeMs !== null && b.responseTimeMs !== null) {
				return a.responseTimeMs - b.responseTimeMs;
			}

			// 4. Then by publisher
			const pubCompare = a.publisher.localeCompare(b.publisher);
			if (pubCompare !== 0) {
				return pubCompare;
			}

			// 5. Finally by name
			return a.displayName.localeCompare(b.displayName);
		});
	}, [filteredModels]);

	// Group by publisher for section headers
	const modelsByPublisher = useMemo(() => {
		const grouped = new Map<string, GroupedModel[]>();

		// Favorites section
		const favs = sortedModels.filter((m) => m.isFavorite);
		if (favs.length > 0) {
			grouped.set("⭐ Favorites", favs);
		}

		// Free section (verified working)
		const free = sortedModels.filter((m) => m.isFree && !m.isFavorite);
		if (free.length > 0) {
			grouped.set("🆓 Free Models (Verified)", free);
		}

		// Group remaining by publisher
		const remaining = sortedModels.filter((m) => !m.isFavorite && !m.isFree);
		remaining.forEach((model) => {
			const pub = `💰 ${model.publisher}`;
			if (!grouped.has(pub)) {
				grouped.set(pub, []);
			}
			grouped.get(pub)?.push(model);
		});

		return grouped;
	}, [sortedModels]);

	return (
		<div className="model-selector-modal" onClick={(e) => e.stopPropagation()}>
			<div className="modal-header">
				<h2>🤖 Select Chat Model</h2>
				<button className="modal-close-btn" onClick={onClose}>
					×
				</button>
			</div>

			{/* Provider Tabs */}
			<div className="provider-tabs">
				{availableProviders.map((provider) => (
					<button
						key={provider}
						className={`provider-tab ${activeTab === provider ? "active" : ""}`}
						onClick={() => setActiveTab(provider)}
					>
						{getProviderName(provider)}
						{provider === "together" && together.isLoading && <span className="loading-dot">●</span>}
						{provider === "openrouter" && openrouter.isLoading && <span className="loading-dot">●</span>}
					</button>
				))}
			</div>

			{/* Search Bar */}
			<div className="model-search">
				<input
					type="text"
					placeholder="Search models by name, publisher..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="search-input"
				/>
				{currentVerification.isRefreshing && <span className="refresh-indicator">🔄 Refreshing...</span>}
			</div>

			{/* Loading State */}
			{currentVerification.isLoading && (
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Verifying models...</p>
					{currentVerification.progress && (
						<p className="progress-text">
							Testing {currentVerification.progress.current}/{currentVerification.progress.total}
							<br />
							<small>{currentVerification.progress.modelId}</small>
						</p>
					)}
				</div>
			)}

			{/* Models Grid */}
			{!currentVerification.isLoading && (
				<div className="modal-body">
					{modelsByPublisher.size === 0 ? (
						<div className="no-models">
							{currentVerification.error ? (
								<>
									<p>⚠️ {currentVerification.error}</p>
									<button className="retry-btn" onClick={() => currentVerification.refresh()}>
										Retry Verification
									</button>
								</>
							) : !availableProviders.includes(activeTab) ? (
								<>
									<p>No models found for {getProviderName(activeTab)}</p>
									<p className="hint">Configure your API key in Settings to see available models</p>
								</>
							) : (
								<>
									<p>No models match your search</p>
									<p className="hint">Try a different search term</p>
								</>
							)}
						</div>
					) : (
						Array.from(modelsByPublisher.entries()).map(([publisher, models]) => (
							<div key={publisher} className="publisher-group">
								<h3 className="publisher-header">
									{publisher}
									<span className="model-count">({models.length})</span>
								</h3>
								<div className="model-selector-grid">
									{models.map((model) => {
										const speedBadge = getSpeedBadge(model.responseTimeMs);
										return (
											<button
												key={model.id}
												className={`model-card ${model.id === currentModel ? "active" : ""} ${model.isFavorite ? "favorited" : ""}`}
												onClick={() => onSelect(model.id)}
											>
												<div className="model-card-header">
													<span className="model-card-name">{model.displayName}</span>
													<button
														className={`favorite-btn ${model.isFavorite ? "active" : ""}`}
														onClick={(e) => handleToggleFavorite(model.id, e)}
														title={model.isFavorite ? "Remove from favorites" : "Add to favorites"}
													>
														{model.isFavorite ? "⭐" : "☆"}
													</button>
												</div>

												<div className="model-card-badges">
													{model.id === currentModel && <span className="model-badge current">✓ ACTIVE</span>}
													{model.isFree && <span className="model-badge free">FREE</span>}
													{!model.isFree && model.pricing.input > 0 && (
														<span className="model-badge paid">{formatPrice(model.pricing.input)}</span>
													)}
													{speedBadge && <span className={`model-badge ${speedBadge.class}`}>{speedBadge.label}</span>}
												</div>

												<div className="model-card-meta">
													{model.contextLength > 0 && <span>📏 {(model.contextLength / 1000).toFixed(0)}K ctx</span>}
													{model.responseTimeMs !== null && (
														<span className="response-time">⏱️ {formatResponseTime(model.responseTimeMs)}</span>
													)}
												</div>

												<div className="model-id-hint">{model.id}</div>
											</button>
										);
									})}
								</div>
							</div>
						))
					)}
				</div>
			)}

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
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .provider-tab:hover {
          color: var(--accent-color);
          background: var(--glass-bg-hover);
        }
        
        .provider-tab.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }
        
        .loading-dot {
          color: #22c55e;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        /* Search Bar */
        .model-search {
          padding: 16px 24px;
          background: var(--secondary-bg-color);
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .search-input {
          flex: 1;
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
        
        .refresh-indicator {
          font-size: 12px;
          color: var(--accent-color);
          animation: pulse 1s infinite;
        }
        
        /* Loading State */
        .loading-state {
          padding: 60px 24px;
          text-align: center;
          color: var(--secondary-text-color);
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--glass-border);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          margin: 0 auto 16px;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .progress-text {
          font-size: 13px;
          color: var(--tertiary-text-color);
        }
        
        .progress-text small {
          display: block;
          margin-top: 4px;
          font-family: monospace;
          opacity: 0.7;
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
        
        .retry-btn {
          margin-top: 16px;
          padding: 8px 16px;
          background: var(--accent-color);
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-weight: 600;
        }
        
        .retry-btn:hover {
          opacity: 0.9;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .model-count {
          font-size: 12px;
          font-weight: normal;
          opacity: 0.7;
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
        
        .model-badge.paid {
          background: rgba(249, 115, 22, 0.15);
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.25);
        }
        
        .model-badge.speed-fast {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        
        .model-badge.speed-quick {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        
        .model-badge.speed-slow {
          background: rgba(249, 115, 22, 0.15);
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.25);
        }
        
        .model-badge.speed-very-slow {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        
        .model-card-meta {
          font-size: 11px;
          color: var(--tertiary-text-color);
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .response-time {
          color: var(--accent-color);
        }
        
        .model-id-hint {
          font-size: 10px;
          color: var(--tertiary-text-color);
          font-family: monospace;
          opacity: 0.6;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
