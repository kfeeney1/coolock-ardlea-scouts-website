import { initializeApp } from "firebase/app";
import { browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
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

// Keep authentication for the lifetime of the browser session only. Closing the
// browser clears the Firebase session, so the next browser launch requires login.
void setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Unable to configure session-only authentication:", error);
});

const firestoreEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST?.trim();
if (firestoreEmulator) {
    const [host, rawPort] = firestoreEmulator.split(":");
    const port = Number(rawPort);
    if (host && Number.isInteger(port) && port > 0) {
        connectFirestoreEmulator(db, host, port);
    }
}

const authEmulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST?.trim();
if (authEmulator) {
    const [host, rawPort] = authEmulator.split(":");
    const port = Number(rawPort);
    if (host && Number.isInteger(port) && port > 0) {
        connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true });
    }
}

export default app;
