import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { handleDocuments } from "./documents.js";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { groupMember } from "./access.js";
initializeApp();
export const maintenanceAccess = onCall({ region: "europe-west1", maxInstances: 3, memory: "256MiB" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to access Maintenance.");
  return { member: await groupMember(getFirestore(), request.auth.uid) };
});

export const maintenanceDocuments = onCall({ region: "europe-west1", maxInstances: 3, memory: "256MiB", concurrency: 1, timeoutSeconds: 120 }, request => handleDocuments(getFirestore(), getStorage().bucket(), request));
