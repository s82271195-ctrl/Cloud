import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAullrDhTsep52qusoBsXeINQF68WkViX0",
  authDomain: "social-media-connecting-app.firebaseapp.com",
  databaseURL: "https://social-media-connecting-app-default-rtdb.firebaseio.com",
  projectId: "social-media-connecting-app",
  storageBucket: "social-media-connecting-app.firebasestorage.app",
  messagingSenderId: "388899952404",
  appId: "1:388899952404:web:0d6a0e8efc2de9d2349401"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly set persistence to browserLocalPersistence (Local Storage)
// This ensures the user stays logged in across session restarts.
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Error setting persistence:", error);
});

export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();