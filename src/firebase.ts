import { initializeApp } from "firebase/app";
import { browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

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
const firestoreEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST?.trim();

// WebKit can reject the Firestore emulator's streaming WebChannel transport as a
// cross-origin request even though the emulator itself is reachable. Long polling
// avoids that browser-specific transport path while keeping production Firestore on
// its normal transport.
export const db = firestoreEmulator
    ? initializeFirestore(app, { experimentalForceLongPolling: true })
    : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Keep authentication for the lifetime of the browser session only. Closing the
// browser clears the Firebase session, so the next browser launch requires login.
void setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Unable to configure session-only authentication:", error);
});

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

const storageEmulator = import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST?.trim();
if (storageEmulator) {
    const [host, rawPort] = storageEmulator.split(":");
    const port = Number(rawPort);
    if (host && Number.isInteger(port) && port > 0) {
        connectStorageEmulator(storage, host, port);
    }
}

export default app;
