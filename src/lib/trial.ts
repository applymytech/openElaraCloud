/**
 * Trial Management for OpenElara Cloud Demo
 * 
 * This is a PUBLIC DEMO to showcase the code.
 * Users get 7 days to try it, then MUST deploy their own instance.
 * 
 * Trial Policy:
 * - 7 days from account creation
 * - Daily warnings shown in UI
 * - After expiration: blocked from login
 * - API keys: Never stored (localStorage only)
 * - User content: Kept 30 days for migration (personas, images, videos)
 */

import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  expiresAt: Date;
  createdAt: Date;
  isExpired: boolean;
  warningLevel: 'none' | 'info' | 'warning' | 'urgent' | 'expired';
}

const TRIAL_DAYS = 7;
const CONTENT_RETENTION_DAYS = 30;

/**
 * Initialize trial for new user
 */
export async function initializeTrial(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  
  // Calculate trial expiration (7 days from now)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const contentDeleteAt = new Date(expiresAt.getTime() + CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  
  await setDoc(userRef, {
    trialCreatedAt: serverTimestamp(),
    trialExpiresAt: Timestamp.fromDate(expiresAt),
    contentDeleteAt: Timestamp.fromDate(contentDeleteAt),
    trialWarningsShown: 0,
  }, { merge: true });
}

/**
 * Get current trial status
 */
export async function getTrialStatus(userId?: string): Promise<TrialStatus | null> {
  const user = userId || auth.currentUser?.uid;
  if (!user) return null;
  
  const userRef = doc(db, 'users', user);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return null;
  
  const data = userSnap.data();
  const expiresAt = data.trialExpiresAt?.toDate();
  const createdAt = data.trialCreatedAt?.toDate();
  
  if (!expiresAt || !createdAt) {
    // No trial info - might be old user, initialize it
    await initializeTrial(user);
    return getTrialStatus(user);
  }
  
  const now = new Date();
  const timeRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
  const isExpired = daysRemaining <= 0;
  
  let warningLevel: TrialStatus['warningLevel'] = 'none';
  if (isExpired) {
    warningLevel = 'expired';
  } else if (daysRemaining <= 1) {
    warningLevel = 'urgent';
  } else if (daysRemaining <= 3) {
    warningLevel = 'warning';
  } else if (daysRemaining <= 5) {
    warningLevel = 'info';
  }
  
  return {
    isActive: !isExpired,
    daysRemaining: Math.max(0, daysRemaining),
    expiresAt,
    createdAt,
    isExpired,
    warningLevel,
  };
}

/**
 * Get warning message for current trial status
 */
export function getTrialWarningMessage(status: TrialStatus): string {
  if (status.isExpired) {
    return `🚀 Trial Expired - Deploy Your Own!\n\nYour 7-day trial has ended. Deploy your own instance to continue using OpenElara Cloud with YOUR API keys in YOUR infrastructure.`;
  }
  
  if (status.daysRemaining === 1) {
    return `⚠️ Last Day! Your trial expires tomorrow. Deploy your own instance now!`;
  }
  
  if (status.daysRemaining <= 3) {
    return `⏰ ${status.daysRemaining} days remaining. Time to deploy your own sovereign cloud AI!`;
  }
  
  if (status.daysRemaining <= 5) {
    return `ℹ️ ${status.daysRemaining} days left in trial. Start planning your deployment!`;
  }
  
  return `✨ ${status.daysRemaining} days remaining in demo. Enjoy exploring!`;
}

/**
 * Check if user's trial is expired (for auth guard)
 */
export async function isTrialExpired(userId?: string): Promise<boolean> {
  const status = await getTrialStatus(userId);
  return status?.isExpired || false;
}

/**
 * Clear API keys from localStorage (should be called on logout/expiry)
 */
export function clearAPIKeys(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove = [
    'elara_api_keys',
    'elara_together_key',
    'elara_openrouter_key',
    'elara_exa_key',
    'elara_openai_key',
    'elara_anthropic_key',
  ];
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('[Trial] API keys cleared from localStorage');
}
