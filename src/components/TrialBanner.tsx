/**
 * Trial Warning Banner - Shows daily reminders about trial expiration
 */

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getTrialStatus, getTrialWarningMessage, type TrialStatus } from "@/lib/trial";

export default function TrialBanner() {
	const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const _router = useRouter();

	useEffect(() => {
		const checkTrial = async () => {
			if (!auth.currentUser) {
				return;
			}
			const status = await getTrialStatus();
			setTrialStatus(status);
		};

		checkTrial();
		const interval = setInterval(checkTrial, 60000); // Check every minute
		return () => clearInterval(interval);
	}, []);

	if (!trialStatus || trialStatus.warningLevel === "none" || dismissed) {
		return null;
	}

	const handleDeploy = () => {
		window.open("https://github.com/applymytech/openElaraCloud", "_blank");
	};

	const getBannerStyle = () => {
		switch (trialStatus.warningLevel) {
			case "expired":
				return "trial-banner-expired";
			case "urgent":
				return "trial-banner-urgent";
			case "warning":
				return "trial-banner-warning";
			default:
				return "trial-banner-info";
		}
	};

	return (
		<div className={`trial-banner ${getBannerStyle()}`}>
			<div className="trial-banner-content">
				<div className="trial-banner-icon">{trialStatus.isExpired ? "🚫" : "⏰"}</div>
				<div className="trial-banner-text">
					<strong>
						{trialStatus.isExpired
							? "Trial Expired"
							: `${trialStatus.daysRemaining} Day${trialStatus.daysRemaining === 1 ? "" : "s"} Remaining`}
					</strong>
					<span>{getTrialWarningMessage(trialStatus)}</span>
				</div>
				<div className="trial-banner-actions">
					<button onClick={handleDeploy} className="trial-banner-btn trial-banner-btn-primary">
						🚀 Deploy Your Own
					</button>
					{!trialStatus.isExpired && (
						<button onClick={() => setDismissed(true)} className="trial-banner-btn trial-banner-btn-ghost">
							Dismiss
						</button>
					)}
				</div>
			</div>

			<style jsx>{`
        .trial-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          padding: 12px 24px;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .trial-banner-info {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%);
        }

        .trial-banner-warning {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%);
        }

        .trial-banner-urgent {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%);
          animation: pulse 2s ease-in-out infinite;
        }

        .trial-banner-expired {
          background: linear-gradient(135deg, rgba(127, 29, 29, 0.98) 0%, rgba(153, 27, 27, 0.98) 100%);
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.9;
          }
        }

        .trial-banner-content {
          display: flex;
          align-items: center;
          gap: 16px;
          max-width: 1400px;
          margin: 0 auto;
          color: white;
        }

        .trial-banner-icon {
          font-size: 2rem;
        }

        .trial-banner-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .trial-banner-text strong {
          font-size: 1.1rem;
        }

        .trial-banner-text span {
          font-size: 0.9rem;
          opacity: 0.95;
        }

        .trial-banner-actions {
          display: flex;
          gap: 12px;
        }

        .trial-banner-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          font-size: 0.9rem;
        }

        .trial-banner-btn-primary {
          background: white;
          color: #1e40af;
        }

        .trial-banner-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .trial-banner-btn-ghost {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .trial-banner-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        @media (max-width: 768px) {
          .trial-banner-content {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }

          .trial-banner-actions {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
		</div>
	);
}
