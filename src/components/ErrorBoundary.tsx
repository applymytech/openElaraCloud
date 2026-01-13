/**
 * Error Boundary - Graceful Error Handling
 *
 * Catches React errors and displays user-friendly messages
 * instead of crashing the entire app.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(_error: Error): Partial<State> {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Log error for debugging (only in development)
		if (process.env.NODE_ENV === "development") {
			console.error("[ErrorBoundary] Caught error:", error);
			console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
		}

		this.setState({
			error,
			errorInfo,
		});

		// In production, you'd send to error tracking service (e.g., Sentry)
		// trackError(error, errorInfo);
	}

	reset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render() {
		if (this.state.hasError) {
			// Custom fallback if provided
			if (this.props.fallback && this.state.error) {
				return this.props.fallback(this.state.error, this.reset);
			}

			// Default error UI
			return (
				<div
					style={{
						minHeight: "100vh",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						padding: "20px",
					}}
				>
					<div
						style={{
							background: "rgba(0, 0, 0, 0.85)",
							border: "2px solid rgba(138, 43, 226, 0.5)",
							borderRadius: "12px",
							padding: "40px",
							maxWidth: "600px",
							color: "white",
							boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
						}}
					>
						<h1
							style={{
								fontSize: "24px",
								marginBottom: "16px",
								color: "#a78bfa",
							}}
						>
							⚠️ Something Went Wrong
						</h1>

						<p
							style={{
								fontSize: "16px",
								lineHeight: "1.6",
								marginBottom: "24px",
								opacity: 0.9,
							}}
						>
							The application encountered an unexpected error. Don't worry—your data is safe. Try refreshing the page or
							return to the home screen.
						</p>

						{process.env.NODE_ENV === "development" && this.state.error && (
							<details
								style={{
									marginBottom: "24px",
									padding: "16px",
									background: "rgba(255, 0, 0, 0.1)",
									border: "1px solid rgba(255, 0, 0, 0.3)",
									borderRadius: "8px",
									fontSize: "14px",
								}}
							>
								<summary style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "8px" }}>
									🐛 Error Details (Dev Mode)
								</summary>
								<pre
									style={{
										overflow: "auto",
										fontSize: "12px",
										lineHeight: "1.4",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
									}}
								>
									{this.state.error.toString()}
									{this.state.errorInfo?.componentStack}
								</pre>
							</details>
						)}

						<div style={{ display: "flex", gap: "12px" }}>
							<button
								type="button"
								onClick={this.reset}
								style={{
									flex: 1,
									padding: "12px 24px",
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
									border: "none",
									borderRadius: "8px",
									color: "white",
									fontSize: "16px",
									fontWeight: "bold",
									cursor: "pointer",
									transition: "opacity 0.2s",
								}}
								onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
								onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
							>
								Try Again
							</button>

							<button
								type="button"
								onClick={() => { window.location.href = "/"; }}
								style={{
									flex: 1,
									padding: "12px 24px",
									background: "rgba(255, 255, 255, 0.1)",
									border: "1px solid rgba(255, 255, 255, 0.2)",
									borderRadius: "8px",
									color: "white",
									fontSize: "16px",
									fontWeight: "bold",
									cursor: "pointer",
									transition: "background 0.2s",
								}}
								onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
							>
								Go Home
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
