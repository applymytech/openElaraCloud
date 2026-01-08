import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { auth } from "@/lib/firebase";
import { ingestSystemManual } from "@/lib/rag";

export default function App({ Component, pageProps }: AppProps) {
  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then(
          (registration) => {
            if (process.env.NODE_ENV === 'development') {
              console.log("SW registered: ", registration);
            }
          },
          (err) => {
            console.error("SW registration failed: ", err);
          }
        );
      });
    }
  }, []);

  // Auto-ingest system manual into RAG for LLM self-awareness
  // This runs once per user on first authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) {
        // Ingest system manual (idempotent - checks if already exists)
        ingestSystemManual().catch((e) => {
          console.warn('[App] System manual ingestion failed:', e);
          // Non-critical, continue anyway
        });
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
