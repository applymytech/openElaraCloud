/**
 * Error Monitoring Setup
 *
 * This file contains configuration for error monitoring services.
 * Uncomment and configure your preferred service.
 */

import React from "react";

// ============================================================================
// SENTRY CONFIGURATION (Recommended - Free tier available)
// ============================================================================

/**
 * To enable Sentry:
 * 1. npm install --save @sentry/nextjs
 * 2. Create account at https://sentry.io
 * 3. Get your DSN
 * 4. Add NEXT_PUBLIC_SENTRY_DSN to .env.local
 * 5. Uncomment code below
 */

/*
import * as Sentry from "@sentry/nextjs";

export function initErrorMonitoring() {
  if (typeof window === 'undefined') return;
  
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions
    debug: false,
    
    // Don't send errors in development
    enabled: process.env.NODE_ENV === 'production',
    
    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      // Filter out trial expiration (expected)
      if (error && typeof error === 'object' && 'message' in error) {
        if (error.message?.includes('trial') || error.message?.includes('Trial')) {
          return null;
        }
      }
      
      return event;
    },
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}
*/

// ============================================================================
// BUGSNAG CONFIGURATION (Alternative)
// ============================================================================

/**
 * To enable Bugsnag:
 * 1. npm install --save @bugsnag/js @bugsnag/plugin-react
 * 2. Get API key from https://bugsnag.com
 * 3. Add NEXT_PUBLIC_BUGSNAG_API_KEY to .env.local
 * 4. Uncomment code below
 */

/*
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import React from 'react';

export function initErrorMonitoring() {
  if (typeof window === 'undefined') return;
  
  const apiKey = process.env.NEXT_PUBLIC_BUGSNAG_API_KEY;
  if (!apiKey) return;
  
  Bugsnag.start({
    apiKey,
    plugins: [new BugsnagPluginReact()],
    enabledReleaseStages: ['production'],
    releaseStage: process.env.NODE_ENV,
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  Bugsnag.notify(error, (event) => {
    event.addMetadata('custom', context || {});
  });
}

export const ErrorBoundary = Bugsnag.getPlugin('react')?.createErrorBoundary(React) || React.Fragment;
*/

// ============================================================================
// ROLLBAR CONFIGURATION (Alternative)
// ============================================================================

/**
 * To enable Rollbar:
 * 1. npm install --save rollbar
 * 2. Get access token from https://rollbar.com
 * 3. Add NEXT_PUBLIC_ROLLBAR_TOKEN to .env.local
 * 4. Uncomment code below
 */

/*
import Rollbar from 'rollbar';

let rollbar: Rollbar | null = null;

export function initErrorMonitoring() {
  if (typeof window === 'undefined') return;
  
  const token = process.env.NEXT_PUBLIC_ROLLBAR_TOKEN;
  if (!token) return;
  
  rollbar = new Rollbar({
    accessToken: token,
    captureUncaught: true,
    captureUnhandledRejections: true,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  if (rollbar) {
    rollbar.error(error, context);
  }
}
*/

// ============================================================================
// FALLBACK (Console logging with structured format)
// ============================================================================

export function initErrorMonitoring() {
	if (typeof window === "undefined") {
		return;
	}

	// Set up global error handler
	window.addEventListener("error", (event) => {
		if (process.env.NODE_ENV === "production") {
			// In production, log to console in structured format
			// You can send this to your own logging service
			logError(event.error, {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
			});
		}
	});

	window.addEventListener("unhandledrejection", (event) => {
		if (process.env.NODE_ENV === "production") {
			logError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
				reason: event.reason,
			});
		}
	});
}

export function logError(error: Error, context?: Record<string, any>) {
	if (process.env.NODE_ENV === "production") {
		// Structured error log that can be collected by monitoring tools
		const errorLog = {
			timestamp: new Date().toISOString(),
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
			context,
			userAgent: navigator.userAgent,
			url: window.location.href,
		};

		// Log to console (can be collected by Firebase Monitoring or other tools)
		window.console.error("[Error Monitor]", JSON.stringify(errorLog, null, 2));

		// TODO: Send to your backend or logging service
		// fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorLog) });
	} else {
		// Development: full error to console
		window.console.error("[Dev Error]", error, context);
	}
}

// No-op boundary for fallback
export const ErrorBoundary = ({ children }: { children: React.ReactNode }) =>
	React.createElement(React.Fragment, null, children);
