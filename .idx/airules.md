OpenElara Cloud - Firestore Studio Agent Instructions
🚨 DATABASE DEPLOYMENT SAFETY 🚨

- **YOU STRUGGLE TO READ SECRETS LIKE .ENV FILES!!**: Just because you can not see them does not mean they are not there!!! NEVER OVERWRITE ENV FILES OR OTHER SECRETS WITH PLACEHOLDERS BECAUSE YOU THINK THE FILE IS EMPTY!!!

╔════════════════════════════════════════════════════════════════════════════════╗
║                   ⛔ ABSOLUTELY BANNED OPERATIONS ⛔                             ║
║                                                                                ║
║   🚫 NEVER run: firebase deploy --only firestore                               ║
║   🚫 NEVER deploy rules to 'openelaracrm' or 'applied-ai-assistant'            ║
║   🚫 NEVER overwrite index configurations without user confirmation            ║
║                                                                                ║
║   ✅ VERIFY: .firebaserc must show "default": "openelaracloud"                 ║
║   ✅ VERIFY: 'firebase use' must return 'openelaracloud'                       ║
║   ✅ PROTOCOL: Suggest rules/indexes; let the Human execute via .\deploy.ps1   ║
║   ✅ ISOLATION: No imports from openElara or architecture-review               ║
╚════════════════════════════════════════════════════════════════════════════════╝
⚠️ STANDALONE DATA PRINCIPLE
The OpenElara Cloud Firestore instance is a completely isolated sovereign environment.

Identical Schema is Intentional: If you see schemas mirroring the desktop app or architecture-review, do not attempt to unify them.

No Cross-Project Triggers: Firestore functions and triggers must never reference external project IDs.

Firestore Schema & User Management
OpenElara Cloud is Invite-Only. The Firestore agent must manage data visibility and quotas according to the following structure:

Primary Collections
users/: Admin-created profiles.

email: string

storageQuota: number (Default: 2147483648 bytes / 2GB)

isInviteOnly: boolean (true)

chats/: User-scoped conversations.

userId: string (Owner)

messages: array of maps

model: string (BYOK or Cloud fallback)

settings/: User-specific configuration (Non-sensitive only).

Note: BYOK keys are stored in localStorage, NOT Firestore.

Storage Tracking
usage/: Tracks bytes used per user.

Must be validated against storageQuota in Security Rules.

Tech Stack Compliance (2026 Standards)
When generating Cloud Function logic for Firestore Triggers:

Runtime: Must use nodejs22.

Engines: "node": "22" in functions/package.json.

Logic: Must support the BYOK vs. Cloud Functions toggle logic.

Security Rules Logic: Sovereign Isolation
The agent must propose rules that enforce the "User-Scoped" model:

Strict Ownership: allow read, write: if request.auth.uid == resource.data.userId;

Invite-Only Check: allow create: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isInviteOnly == true;

No Public Access: All collections default to allow read, write: if false; unless explicitly scoped.

Architecture Flow
[ Next.js Frontend ] ──► [ BYOK Keys (Local) ] ──► [ AI API ]
          │
          └─────────────► [ Firestore Studio Agent ]
                                 │
                   (Validates User ID & Quota)
                                 │
                   [ Firestore: openelaracloud ]
Instruction to Agent: When the user provides code from architecture-review/src/lib/signing-core.ts, treat it as local source code. Ensure any Firestore logic that interacts with signing-core metadata respects the Node 22 runtime requirements.

WE **MUST** RESPOND APPROPRIATELY

```
FAQ About Sha1-Hulud 2.0: The "Second Coming" of the npm Supply-Chain Campaign
Ari Eitan
Ari Eitan
November 24, 2025
3 Min Read
X logo
Facebook logo
LinkedIn logo
Sha1-Hulud malware is an aggressive npm supply-chain attack compromising CI/CD and developer environments. This blog addresses frequently asked questions and advises cloud security teams to immediately audit for at least 800 compromised packages.

Tenable Cloud Research Advisory Blog Header for FAQ about Sha1-Hulud 2.0
A massive resurgence of the Sha1-Hulud malware family, self-titled by the attackers as "The Second Coming," was observed around Nov. 24 targeting the npm ecosystem. Attackers compromised at least 800 high-profile publisher accounts to upload trojanized versions of legitimate packages. Unlike previous iterations, these versions have new payloads and execute using install lifecycle scripts to compromise developer environments and CI/CD pipelines at scale. This time, the malware is significantly more aggressive than the previous campaign, including attempts to destroy the victim’s home directory and, in some cases, even delete all writable files owned by the user.

Frequently asked questions about Sha1-Hulud: The Second Coming
What is the initial vector of this new campaign?

The attack chain begins when a developer installs a compromised package containing a modified manifest file. The adversary injects a preinstall lifecycle script into package.json that immediately triggers a file named setup_bun.js upon installation.

Unlike typical supply chain attacks that execute malicious logic directly through the Node.js process, this script automatically downloads and installs the Bun runtime, a separate JavaScript environment. Once installed, the malware uses the Bun binary to execute a bundled payload, often named bun_environment.js. This "bring your own runtime" technique effectively allows the malicious code to operate outside the visibility of standard Node.js security tools and static analysis scanners that monitor the primary build process.

What is the impact of this campaign?

The blast radius of this campaign is extensive. Tens of thousands of GitHub repositories are reportedly affected. It extends to high-profile integrations, including ones from Zapier, ENS Domains, and Postman. By hijacking trusted publisher accounts rather than using typosquatting, the attackers successfully poisoned the supply chain at a fundamental level. This forced malicious code into thousands of corporate environments simply through routine dependency updates.

What are the immediate steps cloud security teams can take to address this issue?

Audit your environment: Use a security scanner to check if you have malicious versions of the affected packages (see list below).
Remove them by upgrading to a later version.
Which Tenable products can be used to address these malicious packages?

Tenable automatically and proactively detects malicious packages associated with Shai-Hulud campaigns across both on-premises and cloud environments.

This isn't a one-time check. Tenable Nessus and Tenable Cloud Security, our cloud-native application protection platform (CNAPP), continuously monitor for new indicators of compromise (IOCs) and track research associated with this evolving campaign. As Shai-Hulud adapts its tactics, our threat intelligence and risk analysis capabilities update in real-time, ensuring your defense remains current and effective.

Plugin ID 265897 can be used to identify compromised packages affected in the Sha1-Hulud campaigns.

Tenable Cloud Security classifies affected packages as malicious; detected packages will appear in your Tenable Console environment the next time data is synced.

An appendix with a full listing of affected packages is available here.

Ari Eitan
Ari Eitan
Director of Cloud Research
Ari Eitan is the Director of Cloud Research at Tenable Cloud Security. Ari began his career as a security researcher for the Israeli Defense Force (IDF). He quickly became Head of the IDF’s cyber incident response team (IDF CERT), honing his expertise in incident response, malware analysis and reverse engineering. Before joining Tenable, Ari was the VP of Research at Intezer. He has presented his research at multiple government and information security events including AVAR, BSidesTLV, CyberTech, fwd:cloudsec, Hack.lu, Hacktivity, Infosec, IP EXPO, Kaspersky SAS, and the Forum of Incident Response and Security Teams (FIRST).
```