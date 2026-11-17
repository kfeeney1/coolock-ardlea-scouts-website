import { doc, getDoc, onSnapshot, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { eventAudienceEndpoint } from "./eventAudienceEndpoint";
import { requestBackend } from "./backendRequest";
import { ServiceFailure } from "./applicationErrors";

export type EventDiscoveryCollection = "events" | "publicEvents" | "parentGalleryEvents" | "audienceMembers" | "eventConsentLinks" | "eventConsentResponses" | "auditLog";
export type EventDiscoveryFilter = [string, "==" | ">=" | "<=" | "<" | ">" | "in", string | number | boolean | string[]];

/** Discovery returns authorized paths only. SDK reads recheck Rules after any concurrent hide. */
export async function discoverEventPaths(collection: EventDiscoveryCollection, filters: EventDiscoveryFilter[] = []) {
  const endpoint = eventAudienceEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL
  });
  if (!endpoint) throw new ServiceFailure("Event backend is not configured.", "backend/service-not-configured");
  const user = auth.currentUser;
  const result = await requestBackend<{ok: boolean; paths: string[]}>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(user ? {Authorization: `Bearer ${await user.getIdToken()}`} : {}) },
    body: JSON.stringify({operation: "read", collection, filters})
  });
  if (result?.ok !== true || !Array.isArray(result.paths) || result.paths.some(path => typeof path !== "string"
    || (collection === "audienceMembers" ? !/^events\/[^/]+\/audienceMembers\/[^/]+$/.test(path) : !path.startsWith(`${collection}/`) || path.split("/").length !== 2))) {
    throw new ServiceFailure("Event discovery returned an invalid response.", "backend/invalid-response");
  }
  return result.paths;
}

export async function readEventDocuments(collection: EventDiscoveryCollection, filters: EventDiscoveryFilter[] = []) {
  const paths = await discoverEventPaths(collection, filters);
  const snapshots = await Promise.all(paths.map(async path => {
    try { return await getDoc(doc(db, path)); }
    catch (error) {
      if ((error as {code?: string}).code === "permission-denied") return null;
      throw error;
    }
  }));
  return snapshots.filter((snapshot): snapshot is QueryDocumentSnapshot<DocumentData> => snapshot !== null && snapshot.exists());
}

/** Direct listeners revoke open views immediately when source Rules deny access.
 * Refresh discovery also picks up new/restored records and changed audiences.
 */
export function watchEventDocuments(collection: EventDiscoveryCollection, filters: EventDiscoveryFilter[],
  next: (documents: QueryDocumentSnapshot<DocumentData>[]) => void, failed: () => void) {
  const records = new Map<string, {stop: () => void; document: QueryDocumentSnapshot<DocumentData> | null; loaded: boolean}>();
  let active = true;
  let refreshing = false;
  const emit = () => {
    if (active && [...records.values()].every(record => record.loaded)) next([...records.values()].flatMap(record => record.document ? [record.document] : []));
  };
  const refresh = async () => {
    if (!active || refreshing) return;
    refreshing = true;
    try {
      const paths = await discoverEventPaths(collection, filters);
      if (!active) return;
      const retained = new Set(paths);
      for (const [path, record] of records) if (!retained.has(path)) { record.stop(); records.delete(path); }
      for (const path of paths) if (!records.has(path)) {
        const record = {stop: () => {}, document: null as QueryDocumentSnapshot<DocumentData> | null, loaded: false};
        records.set(path, record);
        record.stop = onSnapshot(doc(db, path), {includeMetadataChanges: true}, snapshot => {
          if (!active || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          record.document = snapshot.exists() ? snapshot : null;
          record.loaded = true;
          emit();
        }, error => {
          record.document = null;
          record.loaded = true;
          if (error.code === "permission-denied") {record.stop(); records.delete(path); emit();}
          else if (active) failed();
        });
      }
      emit();
    } catch { if (active) {records.forEach(record => {record.document = null; record.loaded = true;}); emit(); failed();} }
    finally { refreshing = false; }
  };
  void refresh();
  const interval = setInterval(() => {void refresh();}, 30000);
  const focus = () => {void refresh();};
  window.addEventListener("focus", focus);
  return () => {active = false; clearInterval(interval); window.removeEventListener("focus", focus); records.forEach(record => record.stop());};
}
