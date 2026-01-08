/**
 * Login Page - 7-Day Demo for Sovereign Cloud AI
 * 
 * This is a PUBLIC DEMO showcasing the code you can deploy yourself.
 * 
 * Authentication:
 * - Google OAuth only
 * 
 * Trial Policy:
 * - 7 days free demo
 * - Must have BYOK keys (Together.ai, OpenRouter, Exa)
 * - After trial: Deploy your own instance!
 */

import { auth, db, isFirebaseConfigured, getFirebaseConfigError } from "@/lib/firebase";
import { 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  User 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ELARA from "@/lib/elara";
import { initializeTrial, getTrialStatus, isTrialExpired } from "@/lib/trial";
import { DEFAULT_STORAGE_QUOTA_GB, DEFAULT_CHAT_MODEL } from "@/lib/constants";
import { handleUIError } from "@/lib/errorHandler";
import { createLogger } from "@/lib/logger";
import dynamic from 'next/dynamic';

const FirebaseConfigError = dynamic(() => import('@/components/FirebaseConfigError'), { ssr: false });

const logger = createLogger('Login');

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showByokInfo, setShowByokInfo] = useState(false);

  // Check Firebase configuration first
  const configError = getFirebaseConfigError();
  if (configError) {
    return (
      <FirebaseConfigError 
        error={configError.error} 
        setupInstructions={configError.setupInstructions} 
      />
    );
  }

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      logger.error('Firebase not configured');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if trial expired
        const expired = await isTrialExpired(user.uid);
        if (expired) {
          setError("⏰ Your 7-day trial has expired. Time to deploy your own instance!");
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        // Initialize user profile if first login
        await initializeUserProfile(user);
        
        // Redirect to account page (to set up BYOK keys)
        router.push("/account");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  /**
   * Initialize user profile with trial
   */
  async function initializeUserProfile(user: User) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time login - create profile + trial in one operation
      const now = new Date();
      const trialExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const contentDeleteAt = new Date(trialExpiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0],
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        quota: {
          storageLimitGB: DEFAULT_STORAGE_QUOTA_GB,
          storageUsedBytes: 0,
        },
        settings: {
          theme: "nexus",
          defaultModel: DEFAULT_CHAT_MODEL,
        },
        // Trial fields
        trialCreatedAt: serverTimestamp(),
        trialExpiresAt: trialExpiresAt,
        contentDeleteAt: contentDeleteAt,
        trialWarningsShown: 0,
      });
    } else {
      // Update last login
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoggingIn(true);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (e.code !== "auth/popup-closed-by-user") {
        setError(e.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
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
      {/* Stars Background */}
      <div className="stars-layer stars-1" />
      <div className="stars-layer stars-2" />
      <div className="stars-layer stars-3" />
      
      <div className="cover-bg" />
      <div className="cover-overlay" />
      
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      
      <div className="login-content">
        {/* Logo */}
        <div className="elara-logo">
          <img src="/icon.png" alt="OpenElara" className="elara-logo-icon-img" />
          <div className="elara-logo-text">
            <span className="elara-logo-name">{ELARA.NAME}</span>
            <span className="elara-logo-tagline">Sovereign Cloud AI - BYOK</span>
          </div>
        </div>

        {/* BYOK Info Banner */}
        <div className="byok-banner">
          <div className="byok-banner-header" onClick={() => setShowByokInfo(!showByokInfo)}>
            <span>🔑 BYOK Required - Have Your API Keys Ready!</span>
            <span className="byok-toggle">{showByokInfo ? '▼' : '▶'}</span>
          </div>
          {showByokInfo && (
            <div className="byok-banner-content">
              <p><strong>Before you sign in, get your FREE API keys:</strong></p>
              <ul>
                <li><strong>Together.ai</strong> - Chat, images, video (free trial available) <a href="https://api.together.xyz" target="_blank" rel="noopener">→ Get Key</a></li>
                <li><strong>OpenRouter</strong> - 50+ free models, access to all <a href="https://openrouter.ai" target="_blank" rel="noopener">→ Get Key</a></li>
                <li><strong>Exa.ai</strong> - Web search (1000 free searches) <a href="https://exa.ai" target="_blank" rel="noopener">→ Get Key</a></li>
              </ul>
              <p className="byok-warning">
                ⚠️ <strong>No API keys = No AI functionality.</strong> All keys are pay-as-you-go, no credit card needed for free tier!
              </p>
            </div>
          )}
        </div>

        {/* 7-Day Trial Notice */}
        <div className="trial-notice">
          <strong>🚀 7-Day Demo</strong>
          <p>This is a <strong>public demonstration</strong> of the code. After 7 days, deploy YOUR OWN sovereign instance with YOUR keys!</p>
        </div>

        <div className="form-container">
          {error && <div className="form-error">⚠️ {error}</div>}

          {/* OAuth Buttons */}
          <div className="oauth-buttons">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="oauth-btn google-btn"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>

              {/* Deploy Your Own */}
              <div className="deploy-notice">
                <h3>Want Your Own Instance?</h3>
                <p>Deploy this exact code with YOUR API keys in YOUR infrastructure:</p>
                <div className="deploy-links">
                  <a href="https://github.com/applymytech/openElaraCloud" target="_blank" rel="noopener" className="deploy-link">
                    ☁️ Cloud Version (This Code)
                  </a>
                  <a href="https://github.com/applymytech/openElara" target="_blank" rel="noopener" className="deploy-link">
                    🖥️ Desktop Version (with Code Studio)
                  </a>
                </div>
                <p className="deploy-sovereignty">
                  <strong>Sovereign AI</strong> - Your keys, your data, your infrastructure. Deploy to any Google Cloud region worldwide.
                </p>
              </div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #0a0e1a;
        }

        /* ... stars, orbs, background animations ... */
        /* (keeping existing styles from original file) */

        .login-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 520px;
          padding: 32px 24px;
        }

        .byok-banner {
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin: 24px 0;
          cursor: pointer;
        }

        .byok-banner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          color: #00d4ff;
          font-size: 0.95rem;
        }

        .byok-banner-content {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 212, 255, 0.2);
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .byok-banner-content ul {
          margin: 12px 0;
          padding-left: 20px;
        }

        .byok-banner-content a {
          color: #00d4ff;
          text-decoration: none;
          font-weight: 600;
        }

        .byok-warning {
          background: rgba(255, 193, 7, 0.1);
          border-left: 3px solid #ffc107;
          padding: 12px;
          margin-top: 12px;
          border-radius: 4px;
        }

        .trial-notice {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          text-align: center;
        }

        .trial-notice strong {
          color: #8b5cf6;
          font-size: 1.1rem;
        }

        .oauth-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .google-btn {
          background: white;
          color: #333;
        }

        .google-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .divider {
          text-align: center;
          margin: 24px 0;
          position: relative;
        }

        .divider::before,
        .divider::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 45%;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .divider::before {
          left: 0;
        }

        .divider::after {
          right: 0;
        }

        .divider span {
          background: #0a0e1a;
          padding: 0 12px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
        }

        .forgot-password-btn {
          background: none;
          border: none;
          color: #00d4ff;
          cursor: pointer;
          margin-top: 12px;
          width: 100%;
          text-align: center;
          font-size: 0.9rem;
        }

        .deploy-notice {
          margin-top: 32px;
          padding: 24px;
          background: rgba(0, 212, 255, 0.05);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 12px;
          text-align: center;
        }

        .deploy-notice h3 {
          color: #00d4ff;
          margin-bottom: 12px;
        }

        .deploy-links {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 16px 0;
        }

        .deploy-link {
          display: block;
          padding: 12px;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 8px;
          color: #00d4ff;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .deploy-link:hover {
          background: rgba(0, 212, 255, 0.2);
          transform: translateY(-2px);
        }

        .deploy-sovereignty {
          margin-top: 16px;
          font-size: 0.9rem;
          font-style: italic;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
