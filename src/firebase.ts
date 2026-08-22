import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const PRODUCTION_FIREBASE_PROJECT_ID = "coolock-ardlea-scouts";

const configuredProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
if (configuredProjectId && configuredProjectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
    console.warn(
        `Ignoring mismatched VITE_FIREBASE_PROJECT_ID (${configuredProjectId}); using ${PRODUCTION_FIREBASE_PROJECT_ID}.`
    );
}

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: PRODUCTION_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:
        import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

const firestoreEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST?.trim();
if (firestoreEmulator) {
    const [host, rawPort] = firestoreEmulator.split(":");
    const port = Number(rawPort);
    if (host && Number.isInteger(port) && port > 0) {
        connectFirestoreEmulator(db, host, port);
    }
}

export default app;
