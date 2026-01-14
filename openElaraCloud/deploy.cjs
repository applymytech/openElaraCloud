const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'deploy.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const { adminEmail, firestoreRulesFile, storageRulesFile } = config;

// --- Generate Firestore Rules ---
const firestoreTemplate = fs.readFileSync(path.resolve(__dirname, 'firestore.rules.template'), 'utf-8');
const finalFirestoreRules = firestoreTemplate.replace(/YOUR_EMAIL@example.com/g, adminEmail);
fs.writeFileSync(path.resolve(__dirname, firestoreRulesFile), finalFirestoreRules);
console.log(`Successfully generated ${firestoreRulesFile}`);

// --- Generate Storage Rules ---
const storageTemplate = fs.readFileSync(path.resolve(__dirname, 'storage.rules.template'), 'utf-8');
const finalStorageRules = storageTemplate.replace(/YOUR_EMAIL@example.com/g, adminEmail);
fs.writeFileSync(path.resolve(__dirname, storageRulesFile), finalStorageRules);
console.log(`Successfully generated ${storageRulesFile}`);
