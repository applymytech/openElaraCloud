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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

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

    // Listen for PWA install prompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

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

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
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

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
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
      <div className="stars-layer stars-3" />
      <div className="gradient-orb orb-1" />
      <div className="gradient-orb orb-2" />
      <div className="gradient-orb orb-3" />
      
      {/* Desktop: Split Layout | Mobile: Single Column */}
      <div className="login-container">
        
        {/* Left Panel - Hero Section (Desktop Only) */}
        <div className="hero-panel">
          <div className="hero-content">
            {/* Logo */}
            <div className="brand-header">
              <img src="/icon.png" alt="OpenElara" className="brand-icon" />
              <div className="brand-text">
                <h1 className="brand-name">{ELARA.NAME}</h1>
                <p className="brand-tagline">Sovereign Cloud AI Assistant</p>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🔑</div>
                <h3>BYOK Architecture</h3>
                <p>Bring Your Own Keys - you control the AI providers, you pay for usage</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">☁️</div>
                <h3>Cloud Native</h3>
                <p>Deploy to Firebase in minutes. Your infrastructure, your rules.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">🧠</div>
                <h3>Deep Thought</h3>
                <p>Multi-turn agentic reasoning with web search, images, and video generation</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">🌐</div>
                <h3>Multi-Model</h3>
                <p>Access 50+ LLMs via OpenRouter, Together.ai, OpenAI, Anthropic</p>
              </div>
            </div>

            {/* Trial Badge */}
            <div className="trial-badge">
              <div className="trial-icon">🚀</div>
              <div className="trial-text">
                <strong>7-Day Demo Instance</strong>
                <p>Try it now, deploy your own sovereign stack later</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="auth-panel">
          <div className="auth-content">
            
            {/* Mobile Logo */}
            <div className="mobile-brand">
              <img src="/icon.png" alt="OpenElara" className="mobile-brand-icon" />
              <div className="mobile-brand-text">
                <h1>{ELARA.NAME}</h1>
                <p>Sovereign Cloud AI</p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="welcome-section">
              <h2>Welcome Back</h2>
              <p>Sign in to your sovereign AI assistant</p>
            </div>

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="google-signin-btn"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" className="google-icon">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isLoggingIn ? 'Signing In...' : 'Continue with Google'}</span>
            </button>

            {/* Desktop Download Button */}
            {showInstallButton && (
              <button 
                onClick={handleInstallApp}
                className="desktop-download-btn"
              >
                <span className="download-icon">💻</span>
                <div className="download-text">
                  <strong>Install as App</strong>
                  <span>Windows, macOS, Android, iOS</span>
                </div>
                <span className="download-arrow">→</span>
              </button>
            )}

            {/* BYOK Requirements */}
            <div className="byok-requirements">
              <div 
                className="byok-header" 
                onClick={() => setShowByokInfo(!showByokInfo)}
              >
                <span className="byok-title">🔑 BYOK Requirements</span>
                <span className="byok-chevron">{showByokInfo ? '▼' : '▶'}</span>
              </div>
              
              {showByokInfo && (
                <div className="byok-details">
                  <p className="byok-intro">Get your FREE API keys before signing in:</p>
                  
                  <div className="byok-providers">
                    <a 
                      href="https://api.together.xyz" 
                      target="_blank" 
                      rel="noopener"
                      className="provider-link"
                    >
                      <div className="provider-info">
                        <strong>Together.ai</strong>
                        <span>Chat, Images, Video</span>
                      </div>
                      <span className="provider-arrow">→</span>
                    </a>
                    
                    <a 
                      href="https://openrouter.ai" 
                      target="_blank" 
                      rel="noopener"
                      className="provider-link"
                    >
                      <div className="provider-info">
                        <strong>OpenRouter</strong>
                        <span>50+ Free Models</span>
                      </div>
                      <span className="provider-arrow">→</span>
                    </a>
                    
                    <a 
                      href="https://exa.ai" 
                      target="_blank" 
                      rel="noopener"
                      className="provider-link"
                    >
                      <div className="provider-info">
                        <strong>Exa.ai</strong>
                        <span>1000 Free Searches</span>
                      </div>
                      <span className="provider-arrow">→</span>
                    </a>
                  </div>

                  <div className="byok-alert">
                    <span className="alert-icon">⚠️</span>
                    <div className="alert-text">
                      <strong>No keys = No AI</strong>
                      <p>All providers offer free tiers with no credit card required</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Deploy Info */}
            <div className="deploy-info">
              <h3>Deploy Your Own Sovereign Instance</h3>
              <p className="deploy-description">
                This is open-source code. Deploy with YOUR keys on YOUR infrastructure.
              </p>
              
              <div className="deploy-links">
                <a 
                  href="https://github.com/applymytech/openElaraCloud" 
                  target="_blank" 
                  rel="noopener"
                  className="deploy-link-card"
                >
                  <div className="deploy-icon">☁️</div>
                  <div className="deploy-link-info">
                    <strong>Cloud Version</strong>
                    <span>This exact application</span>
                  </div>
                </a>
                
                <a 
                  href="https://github.com/applymytech/openElara" 
                  target="_blank" 
                  rel="noopener"
                  className="deploy-link-card"
                >
                  <div className="deploy-icon">🖥️</div>
                  <div className="deploy-link-info">
                    <strong>Desktop Version</strong>
                    <span>With Code Studio</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="auth-footer">
              <p>Sovereign AI • Your Keys • Your Data • Your Control</p>
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
        }

        .login-container {
          display: flex;
          min-height: 100vh;
          position: relative;
          z-index: 10;
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

        .stars-3 {
          background-image: 
            radial-gradient(2px 2px at 70px 40px, #00d4ff, transparent),
            radial-gradient(1px 1px at 20px 100px, #a855f7, transparent);
          background-size: 250px 250px;
          animation: starsMove 240s linear infinite reverse;
          opacity: 0.2;
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

        .orb-3 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -5s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }

        /* ============================================
           HERO PANEL (Left Side - Desktop Only)
        ============================================ */
        .hero-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(168, 85, 247, 0.03) 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
        }

        .hero-content {
          max-width: 600px;
          width: 100%;
        }

        .brand-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 60px;
        }

        .brand-icon {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          box-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .brand-name {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #00d4ff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-tagline {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(0, 212, 255, 0.3);
          transform: translateY(-4px);
        }

        .feature-icon {
          font-size: 2rem;
          margin-bottom: 12px;
        }

        .feature-card h3 {
          font-size: 1.1rem;
          margin: 0 0 8px 0;
          color: #ffffff;
        }

        .feature-card p {
          font-size: 0.9rem;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        /* Trial Badge */
        .trial-badge {
          display: flex;
          align-items: center;
          gap: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 20px;
        }

        .trial-icon {
          font-size: 2rem;
          filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.5));
        }

        .trial-text strong {
          display: block;
          font-size: 1.1rem;
          color: #a855f7;
          margin-bottom: 4px;
        }

        .trial-text p {
          margin: 0;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.7);
        }

        /* ============================================
           AUTH PANEL (Right Side)
        ============================================ */
        .auth-panel {
          width: 100%;
          max-width: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          background: rgba(10, 14, 26, 0.8);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.05);
        }

        .auth-content {
          width: 100%;
          max-width: 420px;
        }

        /* Mobile Brand (Hidden on Desktop) */
        .mobile-brand {
          display: none;
        }

        /* Welcome Section */
        .welcome-section {
          margin-bottom: 32px;
        }

        .welcome-section h2 {
          font-size: 1.75rem;
          margin: 0 0 8px 0;
          color: #ffffff;
        }

        .welcome-section p {
          margin: 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.95rem;
        }

        /* Error Message */
        .auth-error {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          color: #f87171;
          font-size: 0.9rem;
        }

        .error-icon {
          font-size: 1.2rem;
        }

        /* Google Sign In Button */
        .google-signin-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 24px;
          background: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 28px;
        }

        .google-signin-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .google-signin-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .google-icon {
          flex-shrink: 0;
        }

        /* Desktop Download Button */
        .desktop-download-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 16px 20px;
          background: linear-gradient(135deg, #00d4ff 0%, #0099ff 100%);
          border: none;
          border-radius: 12px;
          color: white;
          text-decoration: none;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 28px;
        }

        .desktop-download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 212, 255, 0.4);
        }

        .download-icon {
          font-size: 28px;
          flex-shrink: 0;
        }

        .download-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
        }

        .download-text strong {
          font-size: 16px;
          font-weight: 600;
        }

        .download-text span {
          font-size: 13px;
          opacity: 0.9;
        }

        .download-arrow {
          font-size: 24px;
          flex-shrink: 0;
        }

        /* BYOK Requirements */
        .byok-requirements {
          background: rgba(0, 212, 255, 0.05);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 28px;
        }

        .byok-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
        }

        .byok-title {
          font-weight: 600;
          color: #00d4ff;
          font-size: 0.95rem;
        }

        .byok-chevron {
          color: rgba(0, 212, 255, 0.6);
          font-size: 0.8rem;
          transition: transform 0.2s;
        }

        .byok-details {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 212, 255, 0.15);
        }

        .byok-intro {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 16px 0;
        }

        .byok-providers {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        .provider-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: rgba(0, 212, 255, 0.05);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 8px;
          color: inherit;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .provider-link:hover {
          background: rgba(0, 212, 255, 0.1);
          border-color: rgba(0, 212, 255, 0.4);
          transform: translateX(4px);
        }

        .provider-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .provider-info strong {
          font-size: 0.95rem;
          color: #ffffff;
        }

        .provider-info span {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .provider-arrow {
          color: #00d4ff;
          font-size: 1.2rem;
        }

        .byok-alert {
          display: flex;
          gap: 12px;
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 8px;
          padding: 12px;
        }

        .alert-icon {
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .alert-text strong {
          display: block;
          color: #fbbf24;
          margin-bottom: 4px;
          font-size: 0.9rem;
        }

        .alert-text p {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Deploy Info */
        .deploy-info {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .deploy-info h3 {
          font-size: 1rem;
          margin: 0 0 8px 0;
          color: #ffffff;
        }

        .deploy-description {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .deploy-links {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .deploy-link-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 12px;
          background: rgba(0, 212, 255, 0.05);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 8px;
          color: inherit;
          text-decoration: none;
          transition: all 0.2s ease;
          text-align: center;
        }

        .deploy-link-card:hover {
          background: rgba(0, 212, 255, 0.1);
          border-color: rgba(0, 212, 255, 0.4);
          transform: translateY(-4px);
        }

        .deploy-icon {
          font-size: 2rem;
        }

        .deploy-link-info strong {
          display: block;
          font-size: 0.9rem;
          color: #ffffff;
          margin-bottom: 2px;
        }

        .deploy-link-info span {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Footer */
        .auth-footer {
          text-align: center;
          padding-top: 24px;
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
        @media (max-width: 1024px) {
          /* Hide hero panel on tablets and below */
          .hero-panel {
            display: none;
          }

          .login-container {
            justify-content: center;
          }

          .auth-panel {
            max-width: 100%;
            border-left: none;
          }
        }

        @media (max-width: 768px) {
          .auth-panel {
            padding: 32px 24px;
            background: rgba(10, 14, 26, 0.95);
          }

          .auth-content {
            max-width: 100%;
          }

          /* Show mobile brand */
          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 32px;
          }

          .mobile-brand-icon {
            width: 56px;
            height: 56px;
            border-radius: 12px;
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
          }

          .mobile-brand-text h1 {
            font-size: 1.75rem;
            margin: 0;
            background: linear-gradient(135deg, #00d4ff 0%, #a855f7 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .mobile-brand-text p {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.6);
            margin: 4px 0 0 0;
          }

          .welcome-section h2 {
            font-size: 1.5rem;
          }

          .deploy-links {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .auth-panel {
            padding: 24px 16px;
          }

          .welcome-section {
            margin-bottom: 24px;
          }

          .welcome-section h2 {
            font-size: 1.35rem;
          }

          .google-signin-btn {
            padding: 12px 20px;
            font-size: 0.95rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .byok-requirements {
            padding: 14px;
          }

          .deploy-info {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
