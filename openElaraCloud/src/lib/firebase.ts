import {
  getApps, initializeApp, FirebaseApp 
} from "firebase/app";
import {
  getAuth, Auth, Unsubscribe, User, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "firebase/auth";
import {
  getFirestore, Firestore, doc, getDoc, setDoc, updateDoc, collection, 
  query, where, getDocs, deleteDoc, Timestamp, orderBy, limit, addDoc, 
  runTransaction, writeBatch, collectionGroup, increment
} from "firebase/firestore";
import { 
  getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL, deleteObject,
  listAll, getMetadata
} from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Check if running in the browser and if Firebase is not already initialized.
if (typeof window !== 'undefined' && getApps().length === 0 && firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else if (getApps().length > 0) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export type { Unsubscribe, User };
export { 
  app, auth, db, storage,
  // Auth
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  // Firestore
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc, 
  Timestamp, orderBy, limit, addDoc, runTransaction, writeBatch, collectionGroup, increment,
  // Storage
  ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata
};
