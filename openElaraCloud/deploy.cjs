const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'deploy.config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ Error: deploy.config.json missing. Create it from deploy.config.template.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const adminEmail = config.appAdminUserEmail;

if (!adminEmail || adminEmail.includes('REPLACE')) {
  console.error('❌ Error: appAdminUserEmail not configured in deploy.config.json');
  process.exit(1);
}

const { firestoreRulesFile, storageRulesFile } = config;

// --- Generate Firestore Rules ---
const firestoreTemplate = fs.readFileSync(path.resolve(__dirname, 'firestore.rules.template'), 'utf-8');
const finalFirestoreRules = firestoreTemplate.replace(/YOUR_EMAIL@example.com/g, adminEmail);
fs.writeFileSync(path.resolve(__dirname, firestoreRulesFile || 'firestore.rules'), finalFirestoreRules);
console.log(`Successfully generated ${firestoreRulesFile || 'firestore.rules'}`);

// --- Generate Storage Rules ---
const storageTemplate = fs.readFileSync(path.resolve(__dirname, 'storage.rules.template'), 'utf-8');
const finalStorageRules = storageTemplate.replace(/YOUR_EMAIL@example.com/g, adminEmail);
fs.writeFileSync(path.resolve(__dirname, storageRulesFile || 'storage.rules'), finalStorageRules);
console.log(`Successfully generated ${storageRulesFile || 'storage.rules'}`);
