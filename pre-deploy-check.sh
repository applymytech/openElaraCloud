#!/bin/bash
set -e

echo "🚀 Starting OpenElara Sovereign Integrity Suite..."

# 1. Environment & Secrets Check
echo "🔐 Step 1: Validating Sovereign Configuration..."
if [ ! -f "openElaraCloud/deploy.config.json" ]; then
    echo "❌ Error: deploy.config.json missing. Integrity check cannot proceed."
    exit 1
fi

# Extract admin email for validation
ADMIN_EMAIL=$(grep -o '"adminEmail": "[^"]*' openElaraCloud/deploy.config.json | cut -d'"' -f4)
if [[ $ADMIN_EMAIL == *"REPLACE"* ]]; then
    echo "❌ Error: Admin email not configured in deploy.config.json."
    exit 1
fi

# 2. Rule Synchronization
echo "⚙️ Step 2: Synchronizing Security Rules & Signing Logic..."
cd openElaraCloud && node deploy.js && cd ..

# 3. Cryptographic Code Audit
echo "🔍 Step 3: Auditing Cryptographic Code for Leakage..."
# Check if Private Key mentions exist in frontend code
if grep -r "ELARA_SIGNING_PRIVATE_KEY" openElaraCloud/src; then
    echo "❌ FATAL: Private Key reference found in client-side code!"
    exit 1
fi

# 4. Security Rules Unit Testing (The "Sovereignty" Check)
echo "🛡️ Step 4: Running Security Rules Integrity Tests..."
cd openElaraCloud/functions && npm run build && npm test && cd ../..

# 5. Build Integrity
echo "🏗️ Step 5: Testing Production Build Stability..."
cd openElaraCloud && npm run build && cd ..

echo "✅ [SUCCESS] Sovereign Integrity Suite Passed!"
echo "Your app is secure, private, and ready for deployment."
