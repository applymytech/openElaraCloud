/**
 * Login Page - Invite Only System
 * 
 * Users must be pre-created by admin in Firebase Console.
 * Supports email/password with password reset.
 */

import { auth, db } from "@/lib/firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ELARA from "@/lib/elara";

const DEFAULT_QUOTA_GB = 2; // Default storage quota for new users

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Initialize user profile if first login
        await initializeUserProfile(user);
        router.push("/chat");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  /**
   * Initialize user profile in Firestore on first login
   */
  async function initializeUserProfile(user: User) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time login - create profile with default quota
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0],
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        quota: {
          storageLimitGB: DEFAULT_QUOTA_GB,
          storageUsedBytes: 0,
        },
        settings: {
          theme: "nexus",
          defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
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
    setIsLoggingIn(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle redirect
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        setError("No account found with this email. This is an invite-only system.");
      } else if (e.code === "auth/wrong-password") {
        setError("Incorrect password. Use 'Forgot Password' to reset.");
      } else if (e.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later or reset your password.");
      } else {
        setError(e.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
      setShowResetForm(false);
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError(e.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="center-content">
        <div className="elara-logo">
          <img src="/icon.png" alt="OpenElara" className="elara-logo-icon-img" />
          <div className="elara-logo-text">
            <span className="elara-logo-name">{ELARA.NAME}</span>
          </div>
        </div>
        <div className="nexus-spinner" />
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Cover Background */}
      <div className="cover-bg" />
      <div className="cover-overlay" />
      
      <div className="login-content">
        {/* Logo */}
        <div className="elara-logo">
          <img src="/icon.png" alt="OpenElara" className="elara-logo-icon-img" />
          <div className="elara-logo-text">
            <span className="elara-logo-name">{ELARA.NAME}</span>
            <span className="elara-logo-tagline">Your Sovereign AI</span>
          </div>
        </div>

        <div className="form-container">
        {/* Error/Message Display */}
        {error && <div className="form-error">⚠️ {error}</div>}
        {message && <div className="form-success">✓ {message}</div>}

        {/* Login Form or Reset Form */}
        {showResetForm ? (
          <form onSubmit={handlePasswordReset}>
            <h2 className="form-title">Reset Password</h2>
            <p className="form-subtitle">Enter your email to receive a reset link.</p>

            <div className="form-group">
              <label className="nexus-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                className="nexus-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <button type="submit" className="nexus-btn nexus-btn-primary nexus-btn-full">
              Send Reset Link
            </button>

            <button
              type="button"
              className="nexus-btn nexus-btn-ghost nexus-btn-full"
              onClick={() => {
                setShowResetForm(false);
                setError(null);
              }}
              style={{ marginTop: '12px' }}
            >
              ← Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSignIn}>
            <div className="form-group">
              <label className="nexus-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="nexus-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="nexus-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="nexus-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              className="nexus-btn nexus-btn-primary nexus-btn-full"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <span className="nexus-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <button
              type="button"
              className="nexus-btn nexus-btn-ghost nexus-btn-full"
              onClick={() => {
                setShowResetForm(true);
                setError(null);
                setMessage(null);
              }}
              style={{ marginTop: '12px' }}
            >
              Forgot Password?
            </button>
          </form>
        )}

        <div className="divider">Invite Only</div>

        {/* Invite Only Notice */}
        <div className="invite-notice">
          <p>🔒 This is a private instance of {ELARA.NAME}.</p>
          <p>Contact your administrator for access.</p>
        </div>
      </div>

        {/* Footer */}
        <div className="login-footer">
          <span>Powered by BYOK (Bring Your Own Key)</span>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cover-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('/cover.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: -2;
        }

        .cover-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            rgba(10, 14, 23, 0.85) 0%,
            rgba(19, 24, 33, 0.9) 50%,
            rgba(10, 14, 23, 0.95) 100%
          );
          backdrop-filter: blur(2px);
          z-index: -1;
        }

        .login-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-lg);
          width: 100%;
          max-width: 500px;
        }

        .elara-logo-icon-img {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          box-shadow: 
            0 0 30px rgba(0, 212, 255, 0.4),
            0 0 60px rgba(168, 85, 247, 0.2);
          animation: logoGlow 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% {
            box-shadow: 
              0 0 30px rgba(0, 212, 255, 0.4),
              0 0 60px rgba(168, 85, 247, 0.2);
          }
          50% {
            box-shadow: 
              0 0 40px rgba(0, 212, 255, 0.6),
              0 0 80px rgba(168, 85, 247, 0.3);
          }
        }

        .invite-notice {
          text-align: center;
          padding: var(--spacing-md);
          background: var(--glass-bg-secondary);
          border-radius: var(--border-radius);
          border: 1px solid var(--glass-border);
        }

        .invite-notice p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .invite-notice p:first-child {
          margin-bottom: 4px;
        }

        .login-footer {
          margin-top: var(--spacing-xl);
          text-align: center;
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .elara-logo-icon-img {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>
    </div>
  );
}
