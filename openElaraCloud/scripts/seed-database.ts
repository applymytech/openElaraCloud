/**
 * OpenElara Cloud - Database Seeder
 * 
 * This script performs the initial seeding of the Firestore database.
 * It is designed to be run ONCE after the Sovereign Commander has set up the
 * cloud environment and before the first run of the application.
 * 
 * It performs the most critical integrity test: ensuring the AI's core
 * self-awareness document (the User Manual) is ingested into the RAG system.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ingestKnowledgeFile } from '../src/lib/rag'; 
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
// This script requires environment variables to be set. It will automatically
// load them from your .env.local file if it exists.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- SCRIPT LOGIC ---

async function main() {
  console.log('--- OpenElara Database Seeder ---');

  // 1. Validate Configuration
  if (!firebaseConfig.apiKey) {
    console.error('\n[ERROR] Firebase configuration is missing.');
    console.error('Please ensure you have run the Sovereign Commander and the Firebase sdkconfig command to create a .env.local file.');
    process.exit(1);
  }
  console.log(`[1/4] Firebase config loaded for project: ${firebaseConfig.projectId}`);

  // 2. Initialize Firebase
  // Note: We are using the client SDK here to mirror the app's own behavior.
  const app = initializeApp(firebaseConfig);
  getAuth(app);
  getFirestore(app);
  
  // This script needs to run as an "admin" or the first user.
  // For simplicity in this automated script, we will rely on the default 
  // open security rules for the very first write. More complex auth will be handled by the app itself.
  console.log('[2/4] Initialized Firebase connection.');

  // 3. Read the User Manual
  const manualPath = path.resolve(__dirname, '../src/lib/userManual.ts');
  if (!fs.existsSync(manualPath)) {
    console.error(`\n[ERROR] Could not find user manual at: ${manualPath}`);
    process.exit(1);
  }
  const manualContent = fs.readFileSync(manualPath, 'utf-8');
  const manualFile = {
      name: 'OpenElara_User_Manual.ts',
      type: 'text/typescript',
      content: manualContent,
      size: manualContent.length
  };
  console.log('[3/4] Loaded User Manual content.');

  // 4. Ingest the Manual into RAG
  console.log('Attempting to ingest manual into the RAG system...');
  try {
    // We are re-purposing ingestKnowledgeFile for this system-critical task.
    // The function requires a File object, so we will mock one.
    const mockedFile = new File([manualFile.content], manualFile.name, { type: manualFile.type });
    
    const ragDocument = await ingestKnowledgeFile(mockedFile, ['system_manual', 'permanent']);
    
    console.log('\n[SUCCESS] Database seeding complete!');
    console.log(` -> Document ID: ${ragDocument.id}`);
    console.log(` -> Title: ${ragDocument.title}`);
    console.log(` -> Type: ${ragDocument.type}`);
    console.log('\nThe application\'s core self-awareness has been successfully ingested.');
    console.log('You can now run `npm run dev` or `npm run build`.');

  } catch (error) {
    console.error('\n[FATAL] Failed to ingest the user manual!', error);
    console.error('\n- Check the Firebase security rules for your Firestore database.');
    console.error('- Ensure the database was created in the Firebase console.');
    process.exit(1);
  }
}

main();
