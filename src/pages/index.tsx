/**
 * Login Page - Private Sovereign Cloud AI
 *
 * Single-user authentication via Email/Password.
 * This is YOUR private deployment - no trials, no public signup.
 */

import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { DEFAULT_STORAGE_QUOTA_GB } from "@/lib/constants";
import ELARA from "@/lib/elara";
import { auth, db, getFirebaseConfigError, isFirebaseConfigured } from "@/lib/firebase";
import { createLogger } from "@/lib/logger";

const FirebaseConfigError = dynamic(() => import("@/components/FirebaseConfigError"), { ssr: false });

const logger = createLogger("Login");

export default function Login() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isLoggingIn, setIsLoggingIn] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showResetForm, setShowResetForm] = useState(false);
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
	const [showInstallButton, setShowInstallButton] = useState(false);

	// Check Firebase configuration first
	const configError = getFirebaseConfigError();
	if (configError) {
		return <FirebaseConfigError error={configError.error} setupInstructions={configError.setupInstructions} />;
	}

	useEffect(() => {
		if (!isFirebaseConfigured()) {
			logger.error("Firebase not configured");
			return;
		}

		// Listen for PWA install prompt
		const handleBeforeInstall = (e: any) => {
			e.preventDefault();
			setDeferredPrompt(e);
			setShowInstallButton(true);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstall);

		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (user) {
				// Initialize user profile if needed
				await initializeUserProfile(user);
				// Go to chat
				router.push("/chat");
			}
			setLoading(false);
		});

		return () => {
			unsubscribe();
			window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
		};
	}, [router, initializeUserProfile]);

	/**
	 * Initialize user profile (first login)
	 */
	async function initializeUserProfile(user: User) {
		const userRef = doc(db, "users", user.uid);
		const userSnap = await getDoc(userRef);

		if (!userSnap.exists()) {
			// First time login - create profile
			await setDoc(userRef, {
				email: user.email,
				displayName: user.displayName || user.email?.split("@")[0],
				createdAt: serverTimestamp(),
				lastLoginAt: serverTimestamp(),
				quota: {
					storageLimitGB: DEFAULT_STORAGE_QUOTA_GB,
					storageUsedBytes: 0,
				},
				settings: {
					theme: "nexus",
					defaultModel: null, // Set dynamically on first chat load
				},
			});
		} else {
			// Update last login
			await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
		}
	}

	const handleEmailSignIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setIsLoggingIn(true);

		try {
			await signInWithEmailAndPassword(auth, email, password);
			// onAuthStateChanged will handle redirect
		} catch (e: any) {
			logger.error("Login failed:", e);
			if (
				e.code === "auth/invalid-credential" ||
				e.code === "auth/wrong-password" ||
				e.code === "auth/user-not-found"
			) {
				setError("Invalid email or password");
			} else if (e.code === "auth/too-many-requests") {
				setError("Too many attempts. Please try again later.");
			} else {
				setError(e.message || "Login failed");
			}
		} finally {
			setIsLoggingIn(false);
		}
	};

	const handlePasswordReset = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);

		if (!email) {
			setError("Please enter your email address");
			return;
		}

		try {
			await sendPasswordResetEmail(auth, email);
			setSuccess("Password reset email sent! Check your inbox.");
			setShowResetForm(false);
		} catch (e: any) {
			logger.error("Password reset failed:", e);
			if (e.code === "auth/user-not-found") {
				setError("No account found with this email");
			} else {
				setError(e.message || "Failed to send reset email");
			}
		}
	};

	const handleInstallApp = async () => {
		if (!deferredPrompt) {
			return;
		}

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			setShowInstallButton(false);
		}

		setDeferredPrompt(null);
	};

	if (loading) {
		return (
			<div className="center-content">
				<div className="nexus-spinner" />
			</div>
		);
	}

	return (
		<div className="login-page">
			{/* Animated Background */}
			<div className="stars-layer stars-1" />
			<div className="stars-layer stars-2" />
			<div className="gradient-orb orb-1" />
			<div className="gradient-orb orb-2" />

			{/* Login Container */}
			<div className="login-container">
				<div className="auth-panel">
					<div className="auth-content">
						{/* Brand */}
						<div className="brand-header">
							<img src="/icon.png" alt="OpenElara" className="brand-icon" />
							<div className="brand-text">
								<h1 className="brand-name">{ELARA.NAME}</h1>
								<p className="brand-tagline">Private Cloud AI</p>
							</div>
						</div>

						{/* Welcome */}
						<div className="welcome-section">
							<h2>{showResetForm ? "Reset Password" : "Sign In"}</h2>
							<p>{showResetForm ? "Enter your email to receive a reset link" : "Access your sovereign AI assistant"}</p>
						</div>

						{/* Messages */}
						{error && (
							<div className="auth-error">
								<span className="error-icon">⚠️</span>
								<span>{error}</span>
							</div>
						)}

						{success && (
							<div className="auth-success">
								<span className="success-icon">✓</span>
								<span>{success}</span>
							</div>
						)}

						{/* Login Form */}
						{!showResetForm ? (
							<form onSubmit={handleEmailSignIn} className="auth-form">
								<div className="form-group">
									<label htmlFor="email">Email</label>
									<input
										type="email"
										id="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="your@email.com"
										required
										autoComplete="email"
										disabled={isLoggingIn}
									/>
								</div>

								<div className="form-group">
									<label htmlFor="password">Password</label>
									<input
										type="password"
										id="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••"
										required
										autoComplete="current-password"
										disabled={isLoggingIn}
									/>
								</div>

								<button type="submit" disabled={isLoggingIn} className="signin-btn">
									{isLoggingIn ? "Signing In..." : "Sign In"}
								</button>

								<button type="button" onClick={() => setShowResetForm(true)} className="forgot-btn">
									Forgot password?
								</button>
							</form>
						) : (
							<form onSubmit={handlePasswordReset} className="auth-form">
								<div className="form-group">
									<label htmlFor="reset-email">Email</label>
									<input
										type="email"
										id="reset-email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="your@email.com"
										required
										autoComplete="email"
									/>
								</div>

								<button type="submit" className="signin-btn">
									Send Reset Link
								</button>

								<button type="button" onClick={() => setShowResetForm(false)} className="forgot-btn">
									Back to Sign In
								</button>
							</form>
						)}

						{/* PWA Install Button */}
						{showInstallButton && (
							<button onClick={handleInstallApp} className="install-btn">
								<span className="install-icon">📱</span>
								<span>Install App</span>
							</button>
						)}

						{/* Footer */}
						<div className="auth-footer">
							<p>Sovereign AI • Your Keys • Your Data</p>
						</div>
					</div>
				</div>
			</div>

			<style jsx>{`
        /* ============================================
           BASE & LAYOUT
        ============================================ */
        .login-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: #0a0e1a;
          color: var(--main-text-color, #ffffff);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          padding: 20px;
        }

        /* ============================================
           ANIMATED BACKGROUND
        ============================================ */
        .stars-layer {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
        }

        .stars-1 {
          background-image: 
            radial-gradient(2px 2px at 20px 30px, white, transparent),
            radial-gradient(2px 2px at 60px 70px, white, transparent),
            radial-gradient(1px 1px at 50px 50px, white, transparent),
            radial-gradient(1px 1px at 130px 80px, white, transparent),
            radial-gradient(2px 2px at 90px 10px, white, transparent);
          background-size: 200px 200px;
          animation: starsMove 120s linear infinite;
          opacity: 0.4;
        }

        .stars-2 {
          background-image: 
            radial-gradient(1px 1px at 40px 60px, #00d4ff, transparent),
            radial-gradient(2px 2px at 110px 90px, #a855f7, transparent),
            radial-gradient(1px 1px at 150px 30px, white, transparent);
          background-size: 300px 300px;
          animation: starsMove 180s linear infinite;
          opacity: 0.3;
        }

        @keyframes starsMove {
          from { background-position: 0 0; }
          to { background-position: 600px 600px; }
        }

        .gradient-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 1;
          animation: orbFloat 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%);
          top: -250px;
          left: -250px;
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
          bottom: -200px;
          right: -200px;
          animation-delay: -10s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -30px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(10px, 10px) scale(1.02); }
        }

        /* ============================================
           AUTH PANEL
        ============================================ */
        .auth-panel {
          background: rgba(15, 20, 35, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
        }

        .auth-content {
          display: flex;
          flex-direction: column;
        }

        /* Brand Header */
        .brand-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .brand-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
        }

        .brand-name {
          font-size: 1.75rem;
          margin: 0;
          background: linear-gradient(135deg, #00d4ff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-tagline {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 4px 0 0 0;
        }

        /* Welcome Section */
        .welcome-section {
          margin-bottom: 24px;
        }

        .welcome-section h2 {
          font-size: 1.5rem;
          margin: 0 0 8px 0;
          color: #ffffff;
        }

        .welcome-section p {
          margin: 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.95rem;
        }

        /* Messages */
        .auth-error, .auth-success {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 0.9rem;
        }

        .auth-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .auth-success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .error-icon, .success-icon {
          flex-shrink: 0;
        }

        /* Form */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
        }

        .form-group input {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: #ffffff;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: #00d4ff;
          background: rgba(0, 212, 255, 0.05);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .form-group input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-group input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Buttons */
        .signin-btn {
          padding: 14px 24px;
          background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
          border: none;
          border-radius: 12px;
          color: #000000;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 8px;
        }

        .signin-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 212, 255, 0.3);
        }

        .signin-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .forgot-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
          cursor: pointer;
          padding: 8px;
          transition: color 0.2s ease;
        }

        .forgot-btn:hover {
          color: #00d4ff;
        }

        .install-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          margin-top: 16px;
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 10px;
          color: #c4b5fd;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .install-btn:hover {
          background: rgba(168, 85, 247, 0.25);
          border-color: rgba(168, 85, 247, 0.5);
        }

        /* Footer */
        .auth-footer {
          text-align: center;
          padding-top: 24px;
          margin-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .auth-footer p {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.4);
        }

        /* ============================================
           RESPONSIVE (MOBILE)
        ============================================ */
        @media (max-width: 480px) {
          .login-container {
            padding: 16px;
          }

          .auth-panel {
            padding: 28px 24px;
            border-radius: 20px;
          }

          .brand-header {
            margin-bottom: 24px;
          }

          .brand-icon {
            width: 48px;
            height: 48px;
          }

          .brand-name {
            font-size: 1.5rem;
          }

          .welcome-section h2 {
            font-size: 1.35rem;
          }

          .form-group input {
            padding: 11px 14px;
          }

          .signin-btn {
            padding: 12px 20px;
          }
        }
      `}</style>
		</div>
	);
}
