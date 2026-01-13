/**
 * Firebase Configuration Error Component
 *
 * Shows when Firebase is not configured properly.
 * Provides setup instructions instead of crashing.
 */

interface Props {
	error: string;
	setupInstructions?: string;
}

export default function FirebaseConfigError({ error, setupInstructions }: Props) {
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
					border: "2px solid rgba(255, 165, 0, 0.5)",
					borderRadius: "12px",
					padding: "40px",
					maxWidth: "800px",
					color: "white",
					boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
				}}
			>
				<h1
					style={{
						fontSize: "28px",
						marginBottom: "16px",
						color: "#ffa500",
					}}
				>
					⚙️ Firebase Configuration Required
				</h1>

				<p
					style={{
						fontSize: "16px",
						lineHeight: "1.6",
						marginBottom: "24px",
						opacity: 0.9,
					}}
				>
					{error}
				</p>

				{setupInstructions && (
					<details
						open
						style={{
							marginBottom: "24px",
							padding: "20px",
							background: "rgba(255, 255, 255, 0.05)",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "8px",
							fontSize: "14px",
						}}
					>
						<summary
							style={{
								cursor: "pointer",
								fontWeight: "bold",
								marginBottom: "16px",
								fontSize: "16px",
								color: "#ffa500",
							}}
						>
							📋 Setup Instructions
						</summary>
						<pre
							style={{
								overflow: "auto",
								fontSize: "13px",
								lineHeight: "1.6",
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								fontFamily: 'Consolas, Monaco, "Courier New", monospace',
								background: "rgba(0, 0, 0, 0.3)",
								padding: "16px",
								borderRadius: "6px",
							}}
						>
							{setupInstructions}
						</pre>
					</details>
				)}

				<div
					style={{
						padding: "16px",
						background: "rgba(255, 165, 0, 0.1)",
						border: "1px solid rgba(255, 165, 0, 0.3)",
						borderRadius: "8px",
						fontSize: "14px",
						lineHeight: "1.6",
					}}
				>
					<strong>🚀 Production Deployment:</strong>
					<br />
					When you deploy to Firebase Hosting with <code>firebase deploy</code>, the configuration is automatically
					injected. This error only appears during local development without proper environment setup.
				</div>

				<div style={{ marginTop: "24px" }}>
					<a
						href="https://firebase.google.com/docs/web/setup"
						target="_blank"
						rel="noopener noreferrer"
						style={{
							display: "inline-block",
							padding: "12px 24px",
							background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
							border: "none",
							borderRadius: "8px",
							color: "white",
							fontSize: "16px",
							fontWeight: "bold",
							textDecoration: "none",
							transition: "opacity 0.2s",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.opacity = "0.9";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.opacity = "1";
						}}
					>
						📖 Firebase Setup Guide
					</a>
				</div>
			</div>
		</div>
	);
}
