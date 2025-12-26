import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBg7aiNpNHQq09FAVzX9ZG3HIXwFt_0tsE",
    authDomain: "ccse-2026.firebaseapp.com",
    projectId: "ccse-2026",
    storageBucket: "ccse-2026.firebasestorage.app",
    messagingSenderId: "527003357944",
    appId: "1:527003357944:web:241861c3f4f39cbb88210d",
    measurementId: "G-0122B04KGK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut };
