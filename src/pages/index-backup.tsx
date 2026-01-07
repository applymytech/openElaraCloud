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
        // Go to account page first (user journey: login → account → chat)
        router.push("/account");
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
      {/* Stars Background Animation */}
      <div className="stars-layer stars-1" />
      <div className="stars-layer stars-2" />
      <div className="stars-layer stars-3" />
      
      {/* Cover Background */}
      <div className="cover-bg" />
      <div className="cover-overlay" />
      
      {/* Floating Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      
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
          <p>Interested in access?</p>
        </div>
        
        <a 
          href="mailto:openelara@applymytech.ai?subject=OpenElara%20Cloud%20Access%20Request"
          className="nexus-btn nexus-btn-secondary nexus-btn-full apply-btn"
        >
          📧 Apply for Account
        </a>
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
          overflow: hidden;
        }

        /* Stars Animation Layers */
        .stars-layer {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: -3;
          pointer-events: none;
        }

        .stars-1 {
          background: 
            radial-gradient(1px 1px at 25px 5px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 50px 25px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 125px 20px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 50px 75px, rgba(0,212,255,0.9), transparent),
            radial-gradient(1px 1px at 175px 80px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 300px 95px, rgba(168,85,247,0.8), transparent),
            radial-gradient(1px 1px at 350px 40px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.5px 1.5px at 375px 150px, rgba(0,212,255,0.7), transparent),
            radial-gradient(1px 1px at 100px 125px, rgba(255,255,255,0.8), transparent);
          background-size: 400px 200px;
          animation: starsMove 90s linear infinite;
        }

        .stars-2 {
          background: 
            radial-gradient(1px 1px at 75px 10px, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 150px 45px, rgba(0,255,136,0.6), transparent),
            radial-gradient(1px 1px at 225px 15px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 275px 85px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 25px 95px, rgba(168,85,247,0.7), transparent),
            radial-gradient(1px 1px at 325px 55px, rgba(255,255,255,0.5), transparent);
          background-size: 350px 150px;
          animation: starsMove 120s linear infinite reverse;
          opacity: 0.8;
        }

        .stars-3 {
          background: 
            radial-gradient(1.5px 1.5px at 100px 30px, rgba(0,212,255,0.8), transparent),
            radial-gradient(1px 1px at 200px 70px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 50px 120px, rgba(0,255,136,0.5), transparent),
            radial-gradient(1px 1px at 250px 20px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 300px 100px, rgba(168,85,247,0.6), transparent);
          background-size: 500px 250px;
          animation: starsMove 150s linear infinite;
          opacity: 0.6;
        }

        @keyframes starsMove {
          from { transform: translateY(0) translateX(0); }
          to { transform: translateY(-200px) translateX(-200px); }
        }

        /* Floating Orbs */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          z-index: -2;
          pointer-events: none;
          animation: orbFloat 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%);
          top: -100px;
          right: -100px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%);
          bottom: -50px;
          left: -50px;
          animation-delay: -7s;
        }

        .orb-3 {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(0,255,136,0.1) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
        }

        @keyframes orbFloat {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.5;
          }
          25% {
            transform: translate(30px, -30px) scale(1.1);
            opacity: 0.7;
          }
          50% {
            transform: translate(-20px, 20px) scale(0.95);
            opacity: 0.6;
          }
          75% {
            transform: translate(15px, 25px) scale(1.05);
            opacity: 0.55;
          }
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
          z-index: -4;
        }

        .cover-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            rgba(10, 14, 23, 0.92) 0%,
            rgba(19, 24, 33, 0.88) 50%,
            rgba(10, 14, 23, 0.95) 100%
          );
          backdrop-filter: blur(2px);
          z-index: -3;
        }

        .login-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-lg);
          width: 100%;
          max-width: 500px;
          position: relative;
          z-index: 1;
        }

        .elara-logo {
          margin-bottom: var(--spacing-xl);
        }

        .elara-logo-icon-img {
          width: 96px;
          height: 96px;
          border-radius: 24px;
          box-shadow: 
            0 0 40px rgba(0, 212, 255, 0.5),
            0 0 80px rgba(168, 85, 247, 0.3),
            0 0 120px rgba(0, 212, 255, 0.2);
          animation: logoGlow 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% {
            box-shadow: 
              0 0 40px rgba(0, 212, 255, 0.5),
              0 0 80px rgba(168, 85, 247, 0.3),
              0 0 120px rgba(0, 212, 255, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 
              0 0 60px rgba(0, 212, 255, 0.7),
              0 0 100px rgba(168, 85, 247, 0.4),
              0 0 150px rgba(0, 212, 255, 0.3);
            transform: scale(1.02);
          }
        }

        .elara-logo-name {
          font-size: 2.2rem;
          background: linear-gradient(135deg, #00d4ff 0%, #a855f7 50%, #00ff88 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: nameGradient 4s ease-in-out infinite;
        }

        @keyframes nameGradient {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }

        .elara-logo-tagline {
          color: var(--secondary-text-color);
          font-size: 1rem;
          letter-spacing: 0.5px;
        }

        .form-container {
          background: rgba(19, 24, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .invite-notice {
          text-align: center;
          padding: var(--spacing-md);
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(168, 85, 247, 0.08));
          border-radius: var(--border-radius);
          border: 1px solid rgba(0, 212, 255, 0.2);
        }

        .invite-notice p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .invite-notice p:first-child {
          margin-bottom: 4px;
          color: var(--accent-color);
        }

        .login-footer {
          margin-top: var(--spacing-xl);
          text-align: center;
          font-size: 0.8rem;
          color: var(--tertiary-text-color);
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .elara-logo-icon-img {
            width: 72px;
            height: 72px;
          }
          
          .elara-logo-name {
            font-size: 1.8rem;
          }

          .orb {
            filter: blur(60px);
          }

          .orb-1 {
            width: 250px;
            height: 250px;
          }

          .orb-2 {
            width: 200px;
            height: 200px;
          }

          .orb-3 {
            width: 150px;
            height: 150px;
          }
        }
      `}</style>
    </div>
  );
}
