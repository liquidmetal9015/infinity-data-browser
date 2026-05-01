import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { Auth } from "firebase/auth";

const STATIC_MODE = import.meta.env.VITE_DEPLOY_MODE === 'static';

// Replace with actual config from Firebase project in environments
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock_key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_domain",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock_project_id",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

// In static mode, skip Firebase initialization entirely to avoid SDK errors.
let auth: Auth | null = null;
let loginWithGoogle: () => Promise<void> = async () => {};
let logout: () => Promise<void> = async () => {};

if (!STATIC_MODE) {
    const app = initializeApp(firebaseConfig);
    const _auth = getAuth(app);
    const googleProvider = new GoogleAuthProvider();
    auth = _auth;

    loginWithGoogle = async () => {
        try {
            await signInWithPopup(_auth, googleProvider);
        } catch (error) {
            console.error("Firebase Login Error", error);
            throw error;
        }
    };

    logout = async () => {
        try {
            await signOut(_auth);
        } catch (error) {
            console.error("Firebase Logout Error", error);
            throw error;
        }
    };
}

export { auth, loginWithGoogle, logout };
