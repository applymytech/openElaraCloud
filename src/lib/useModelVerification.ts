/**
 * useModelVerification - React Hook for Dynamic Model Discovery
 * ==============================================================
 *
 * THE PATTERN:
 * 1. On app load → Check cache, use if fresh
 * 2. Background sync → Refresh models without blocking UI
 * 3. On login → Full verification if stale
 *
 * This hook exposes verified models to UI components.
 * Free models are ping-tested. Paid models are trusted from /models.
 *
 * Usage:
 *   const { models, isLoading, error, refresh } = useModelVerification('together');
 *   const { grouped } = useModelVerification('together', { grouped: true });
 */

import { logger } from "./logger";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	clearVerificationCache,
	getCachedVerification,
	getFastestModel,
	getVerifiedModels,
	groupModelsForUI,
	isModelAvailable,
	type VerifiedModel,
} from "./modelVerification";

// ============================================================================
// TYPES
// ============================================================================

interface UseModelVerificationOptions {
	/** Skip verification, just use cache (for initial render) */
	cacheOnly?: boolean;
	/** Group models by free/publisher for UI */
	grouped?: boolean;
	/** Auto-refresh in background on mount */
	autoRefresh?: boolean;
}

interface UseModelVerificationResult {
	/** All verified models for this provider */
	models: VerifiedModel[];
	/** Models grouped for UI display */
	grouped: {
		free: VerifiedModel[];
		byPublisher: Record<string, VerifiedModel[]>;
	} | null;
	/** Is verification in progress? */
	isLoading: boolean;
	/** Is background refresh in progress? */
	isRefreshing: boolean;
	/** Error message if verification failed */
	error: string | null;
	/** Current progress (for loading UI) */
	progress: { current: number; total: number; modelId: string } | null;
	/** Force refresh models */
	refresh: () => Promise<void>;
	/** Clear cache and re-verify */
	clearAndRefresh: () => Promise<void>;
	/** Check if a specific model is available */
	checkModel: (modelId: string) => boolean;
	/** Get the fastest working model */
	fastest: VerifiedModel | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useModelVerification(
	provider: "together" | "openrouter",
	options: UseModelVerificationOptions = {},
): UseModelVerificationResult {
	const { cacheOnly = false, grouped = false, autoRefresh = true } = options;

	const [models, setModels] = useState<VerifiedModel[]>([]);
	const [isLoading, setIsLoading] = useState(!cacheOnly);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<{ current: number; total: number; modelId: string } | null>(null);

	const hasInitialized = useRef(false);

	// Load from cache immediately on mount
	useEffect(() => {
		const cache = getCachedVerification();
		const cached = cache?.[provider];
		if (cached) {
			setModels(cached.models);
			setIsLoading(false);
		}
	}, [provider]);

	// Verification function
	const verify = useCallback(
		async (forceRefresh: boolean = false) => {
			if (cacheOnly && !forceRefresh) {
				return;
			}

			const isInitial = !hasInitialized.current;
			hasInitialized.current = true;

			if (isInitial) {
				setIsLoading(true);
			} else {
				setIsRefreshing(true);
			}

			setError(null);

			try {
				const result = await getVerifiedModels(provider, {
					forceRefresh,
					onProgress: (current, total, modelId) => {
						setProgress({ current, total, modelId });
					},
				});
				setModels(result);
			} catch (err: any) {
				setError(err.message || "Failed to verify models");
				// Keep existing models on error
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
				setProgress(null);
			}
		},
		[provider, cacheOnly],
	);

	// Auto-refresh on mount (background)
	useEffect(() => {
		if (autoRefresh && !cacheOnly) {
			verify(false);
		}
	}, [autoRefresh, cacheOnly, verify]);

	// Public refresh function
	const refresh = useCallback(async () => {
		await verify(true);
	}, [verify]);

	// Clear cache and refresh
	const clearAndRefresh = useCallback(async () => {
		clearVerificationCache();
		setModels([]);
		await verify(true);
	}, [verify]);

	// Check if specific model is available
	const checkModel = useCallback((modelId: string) => {
		return isModelAvailable(modelId);
	}, []);

	// Compute grouped models
	const groupedModels = grouped ? groupModelsForUI(models) : null;

	// Get fastest model
	const fastest = getFastestModel(provider);

	return {
		models,
		grouped: groupedModels,
		isLoading,
		isRefreshing,
		error,
		progress,
		refresh,
		clearAndRefresh,
		checkModel,
		fastest,
	};
}

// ============================================================================
// COMBINED PROVIDERS HOOK
// ============================================================================

interface UseAllProvidersResult {
	together: {
		models: VerifiedModel[];
		isLoading: boolean;
		error: string | null;
	};
	openrouter: {
		models: VerifiedModel[];
		isLoading: boolean;
		error: string | null;
	};
	allModels: VerifiedModel[];
	isAnyLoading: boolean;
	refreshAll: () => Promise<void>;
}

export function useAllProviders(): UseAllProvidersResult {
	const together = useModelVerification("together");
	const openrouter = useModelVerification("openrouter");

	const allModels = [...together.models, ...openrouter.models];
	const isAnyLoading = together.isLoading || openrouter.isLoading;

	const refreshAll = useCallback(async () => {
		await Promise.all([together.refresh(), openrouter.refresh()]);
	}, [together.refresh, openrouter.refresh]);

	return {
		together: {
			models: together.models,
			isLoading: together.isLoading,
			error: together.error,
		},
		openrouter: {
			models: openrouter.models,
			isLoading: openrouter.isLoading,
			error: openrouter.error,
		},
		allModels,
		isAnyLoading,
		refreshAll,
	};
}

// ============================================================================
// BACKGROUND SYNC SERVICE
// ============================================================================

let backgroundSyncInterval: NodeJS.Timeout | null = null;

/**
 * Start background sync service.
 * Runs verification every 4 hours while app is open.
 */
export function startBackgroundSync(): void {
	if (backgroundSyncInterval) {
		return; // Already running
	}

	const SYNC_INTERVAL_MS = 1000 * 60 * 60 * 4; // 4 hours

	backgroundSyncInterval = setInterval(async () => {
		logger.debug("Background sync started", { component: "ModelVerification" });
		try {
			await Promise.all([
				getVerifiedModels("together", { forceRefresh: true }),
				getVerifiedModels("openrouter", { forceRefresh: true }),
			]);
			logger.debug("Background sync complete", { component: "ModelVerification" });
		} catch (err) {
			console.warn("[ModelVerification] Background sync failed:", err);
		}
	}, SYNC_INTERVAL_MS);
}

/**
 * Stop background sync service.
 */
export function stopBackgroundSync(): void {
	if (backgroundSyncInterval) {
		clearInterval(backgroundSyncInterval);
		backgroundSyncInterval = null;
	}
}
