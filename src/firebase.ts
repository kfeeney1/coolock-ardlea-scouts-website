import { initializeApp } from "firebase/app";
import { browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const PRODUCTION_FIREBASE_PROJECT_ID = "coolock-ardlea-scouts";
const TESTING_FIREBASE_PROJECT_ID = "coolock-ardlea-scouts-test";
const LOCAL_FIREBASE_PROJECT_ID = "demo-coolock-ardlea-scouts";

type AppEnvironment = "local" | "test" | "production";

const appEnvironment = (import.meta.env.VITE_APP_ENV?.trim() || "local") as AppEnvironment;
if (!(["local", "test", "production"] as const).includes(appEnvironment)) {
    throw new Error(`Unsupported VITE_APP_ENV: ${appEnvironment}`);
}

const expectedProjectId = appEnvironment === "production"
    ? PRODUCTION_FIREBASE_PROJECT_ID
    : appEnvironment === "test"
        ? TESTING_FIREBASE_PROJECT_ID
        : LOCAL_FIREBASE_PROJECT_ID;
const configuredProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || expectedProjectId;

if (configuredProjectId !== expectedProjectId) {
    throw new Error(
        `Firebase project mismatch for ${appEnvironment}: expected ${expectedProjectId}, received ${configuredProjectId}`
    );
}

const required = (name: string, value: string | undefined, localFallback: string): string => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    if (appEnvironment === "local") return localFallback;
    throw new Error(`${name} must be configured for ${appEnvironment}`);
};

const firebaseConfig = {
    apiKey: required("VITE_FIREBASE_API_KEY", import.meta.env.VITE_FIREBASE_API_KEY, "demo-api-key"),
    authDomain: required("VITE_FIREBASE_AUTH_DOMAIN", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, `${LOCAL_FIREBASE_PROJECT_ID}.firebaseapp.com`),
    projectId: configuredProjectId,
    storageBucket: required("VITE_FIREBASE_STORAGE_BUCKET", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`),
    messagingSenderId: required("VITE_FIREBASE_MESSAGING_SENDER_ID", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, "000000000000"),
    appId: required("VITE_FIREBASE_APP_ID", import.meta.env.VITE_FIREBASE_APP_ID, "1:000000000000:web:local"),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined
};

const app = initializeApp(firebaseConfig);
const firestoreEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST?.trim();

if (appEnvironment === "local" && !firestoreEmulator) {
    console.warn("Local Firebase runtime is not connected to the Firestore emulator.");
}
if (appEnvironment !== "local" && (
    firestoreEmulator
    || import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST?.trim()
    || import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST?.trim()
)) {
    throw new Error(`${appEnvironment} builds must not reference Firebase emulator hosts`);
}

export const db = firestoreEmulator
    ? initializeFirestore(app, { experimentalForceLongPolling: true })
    : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

void setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Unable to configure session-only authentication:", error);
});

if (firestoreEmulator) {
    const [host, rawPort] = firestoreEmulator.split(":");
    const port = Number(rawPort);
    if (host && Number.isInteger(port) && port > 0) connectFirestoreEmulator(db, host, port);
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
    if (host && Number.isInteger(port) && port > 0) connectStorageEmulator(storage, host, port);
}

export { appEnvironment };
export default app;
