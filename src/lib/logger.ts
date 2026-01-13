/**
 * Environment-Aware Logger
 *
 * Replaces console.log with production-safe logging.
 *
 * Development: Full logging with context
 * Production: Errors and warnings only, no debug spam
 */

import { DEBUG_ENABLED } from "./constants";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	component?: string;
	action?: string;
	userId?: string;
	metadata?: Record<string, any>;
}

class Logger {
	private isDevelopment = DEBUG_ENABLED;

	/**
	 * Debug-level logging (dev only)
	 */
	debug(message: string, context?: LogContext): void {
		if (!this.isDevelopment) {
			return;
		}

		const prefix = this.formatPrefix("DEBUG", context);
		console.log(prefix, message, context?.metadata || "");
	}

	/**
	 * Info-level logging (dev only)
	 */
	info(message: string, context?: LogContext): void {
		if (!this.isDevelopment) {
			return;
		}

		const prefix = this.formatPrefix("INFO", context);
		console.log(prefix, message, context?.metadata || "");
	}

	/**
	 * Warning-level logging (always shown)
	 */
	warn(message: string, context?: LogContext): void {
		const prefix = this.formatPrefix("WARN", context);
		console.warn(prefix, message, context?.metadata || "");
	}

	/**
	 * Error-level logging (always shown)
	 */
	error(message: string, error?: Error | unknown, context?: LogContext): void {
		const prefix = this.formatPrefix("ERROR", context);
		console.error(prefix, message);

		if (error) {
			if (error instanceof Error) {
				console.error("  ↳", error.message);
				if (this.isDevelopment && error.stack) {
					console.error("  ↳ Stack:", error.stack);
				}
			} else {
				console.error("  ↳", error);
			}
		}

		if (context?.metadata) {
			console.error("  ↳ Context:", context.metadata);
		}

		// In production, you'd send to error tracking service here
		// trackError(message, error, context);
	}

	/**
	 * Format log prefix with context
	 */
	private formatPrefix(level: string, context?: LogContext): string {
		const parts = [`[${level}]`];

		if (context?.component) {
			parts.push(`[${context.component}]`);
		}

		if (context?.action) {
			parts.push(`<${context.action}>`);
		}

		return parts.join(" ");
	}

	/**
	 * Group-based logging for related operations
	 */
	group(label: string, fn: () => void): void {
		if (!this.isDevelopment) {
			fn();
			return;
		}

		console.group(label);
		try {
			fn();
		} finally {
			console.groupEnd();
		}
	}

	/**
	 * Performance timing (dev only)
	 */
	time(label: string): void {
		if (this.isDevelopment) {
			console.time(label);
		}
	}

	/**
	 * End performance timing (dev only)
	 */
	timeEnd(label: string): void {
		if (this.isDevelopment) {
			console.timeEnd(label);
		}
	}

	/**
	 * Table logging for structured data (dev only)
	 */
	table(data: any): void {
		if (this.isDevelopment) {
			console.table(data);
		}
	}
}

// Singleton instance
export const logger = new Logger();

// Convenience exports with pre-filled components
export const createLogger = (component: string) => ({
	debug: (message: string, metadata?: any) => logger.debug(message, { component, metadata }),
	info: (message: string, metadata?: any) => logger.info(message, { component, metadata }),
	warn: (message: string, metadata?: any) => logger.warn(message, { component, metadata }),
	error: (message: string, error?: Error | unknown, metadata?: any) =>
		logger.error(message, error, { component, metadata }),
});

export default logger;
