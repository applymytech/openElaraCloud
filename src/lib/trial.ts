/**
 * Trial management for OpenElara Cloud
 */

export interface TrialStatus {
	active: boolean;
	expiresAt: Date | null;
	daysRemaining: number;
	warningLevel?: 'none' | 'warning' | 'critical' | 'expired' | 'urgent';
	isExpired?: boolean;
}

export async function getTrialStatus(): Promise<TrialStatus> {
	// Default: no trial restrictions
	return {
		active: false,
		expiresAt: null,
		daysRemaining: -1,
	};
}

export function isTrialExpired(status: TrialStatus): boolean {
	if (!status.active || !status.expiresAt) {
		return false;
	}
	return new Date() > status.expiresAt;
}

export function getTrialWarningMessage(_status?: TrialStatus): string | null {
	return null;
}
