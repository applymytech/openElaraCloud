import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getAllAPIKeysSync } from "@/lib/byok";
import { auth } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { getCachedVerification, getVerifiedModels } from "@/lib/modelVerification";
import { ingestSystemManual } from "@/lib/rag";
import { startBackgroundSync, stopBackgroundSync } from "@/lib/useModelVerification";

export default function App({ Component, pageProps }: AppProps) {
	// Register service worker for PWA
	useEffect(() => {
		if ("serviceWorker" in navigator) {
			window.addEventListener("load", () => {
				navigator.serviceWorker.register("/sw.js").then(
					(registration) => {
						logger.debug("SW registered", { component: "App", metadata: { scope: registration.scope } });
					},
					(err) => {
						console.error("SW registration failed: ", err);
					},
				);
			});
		}
	}, []);

	// Model Verification: Background sync on app load
	// This verifies which models are actually available (ping test)
	useEffect(() => {
		const cache = getCachedVerification();
		const keys = getAllAPIKeysSync();

		// Background verification - non-blocking
		const runBackgroundVerification = async () => {
			logger.debug("Starting background sync...", { component: "ModelVerification" });

			try {
				// Verify Together.ai if we have a key
				if (keys.together) {
					if (!cache?.together) {
						logger.debug("Verifying Together.ai models...", { component: "ModelVerification" });
						await getVerifiedModels("together", { forceRefresh: true });
						logger.debug("Together.ai verification complete", { component: "ModelVerification" });
					}
				}

				// Verify OpenRouter if we have a key
				if (keys.openrouter) {
					if (!cache?.openrouter) {
						logger.debug("Verifying OpenRouter models...", { component: "ModelVerification" });
						await getVerifiedModels("openrouter", { forceRefresh: true });
						logger.debug("OpenRouter verification complete", { component: "ModelVerification" });
					}
				}
			} catch (err) {
				console.warn("[ModelVerification] Background sync failed:", err);
			}
		};

		// Run in background after a small delay (don't block initial render)
		const timeoutId = setTimeout(runBackgroundVerification, 2000);

		// Start periodic background sync
		startBackgroundSync();

		return () => {
			clearTimeout(timeoutId);
			stopBackgroundSync();
		};
	}, []);

	// Auto-ingest system manual into RAG for LLM self-awareness
	// This runs once per user on first authentication
	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
			if (user) {
				try {
					// Force token refresh to ensure we have latest auth state
					// This helps avoid race conditions with Firestore rules
					await user.getIdToken(true);

					// Small delay to ensure token propagation
					await new Promise((resolve) => setTimeout(resolve, 500));

					// Ingest system manual (idempotent - checks if already exists)
					await ingestSystemManual();
				} catch (e) {
					console.warn("[App] System manual ingestion failed:", e);
					// Non-critical, continue anyway
				}
			}
		});

		return () => unsubscribe();
	}, []);

	return (
		<ErrorBoundary>
			<Component {...pageProps} />
		</ErrorBoundary>
	);
}
