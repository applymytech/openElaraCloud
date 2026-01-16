#!/bin/bash
# OpenElara Sovereign Integrity Suite (Fixed v2.3)
set -e

# Ensure we are in the root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting OpenElara Sovereign Integrity Suite..."

# 1. Environment & Secrets Check
echo "🔐 Step 1: Validating Sovereign Configuration..."
CONFIG_FILE="openElaraCloud/deploy.config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: deploy.config.json missing."
    exit 1
fi

# Extract appAdminUserEmail for validation
ADMIN_EMAIL=$(grep -o '"appAdminUserEmail": "[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)
if [ -z "$ADMIN_EMAIL" ] || [[ $ADMIN_EMAIL == *"REPLACE"* ]]; then
    echo "❌ Error: appAdminUserEmail not configured in deploy.config.json."
    exit 1
fi

# 2. Rule Synchronization
echo "⚙️ Step 2: Synchronizing Security Rules & Signing Logic..."
(cd openElaraCloud && node deploy.cjs)

# 3. Cryptographic Code Audit
echo "🔍 Step 3: Auditing Cryptographic Code for Leakage..."
if grep -r "ELARA_SIGNING_PRIVATE_KEY" openElaraCloud/src; then
    echo "❌ FATAL: Private Key reference found in client-side code!"
    exit 1
fi

# 4. Security Rules & Integration Testing
echo "🛡️ Step 4: Running Integrity Tests (Emulator Required)..."
# We wrap this to ensure we return to root regardless of outcome
cd openElaraCloud/functions
npm run build
# Use firebase emulators:exec to ensure environment is set correctly
firebase emulators:exec --project openelaracloud "npx mocha --require ts-node/register test/*.ts test/integration/*.ts" || { echo "❌ Integration tests failed!"; exit 1; }
cd "$SCRIPT_DIR"

# 5. Build Integrity
echo "🏗️ Step 5: Testing Production Build Stability..."
cd openElaraCloud
npm run build
cd "$SCRIPT_DIR"

echo "✅ [SUCCESS] Sovereign Integrity Suite Passed!"
echo "Your app is secure, private, and ready for deployment."
