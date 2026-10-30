import { HallBookingError } from "./hallBookingModel.js";

class ConfirmedTransactionAbort extends HallBookingError {
  constructor() {super(409, "hall/concurrent", "Hall availability changed. Reload and review before saving.");}
}

export function encodeHallValue(value) {
  if (value === null) return {nullValue: null};
  if (value instanceof Date) return {timestampValue: value.toISOString()};
  if (typeof value === "string") return {stringValue: value};
  if (typeof value === "boolean") return {booleanValue: value};
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encodeHallValue)}};
  if (value && typeof value === "object") return {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeHallValue(item)]))}};
  throw new HallBookingError(400, "hall/invalid", "Unsupported booking value.");
}
export function decodeHallValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeHallValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decodeHallValue(item)]));
  throw new HallBookingError(503, "hall/storage", "Hall records could not be read.");
}
const fields = object => encodeHallValue(object).mapValue.fields;
export const decodeHallDocument = document => document ? decodeHallValue({mapValue: {fields: document.fields ?? {}}}) : null;

export function hallFirestore(env, token, fetcher = fetch) {
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(env.FIREBASE_PROJECT_ID ?? "")) throw new HallBookingError(503, "hall/configuration", "Hall storage is not configured.");
  const name = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  // Emulator override is local/demo only; never allow production credentials over HTTP.
  const host = env.FIRESTORE_EMULATOR_HOST;
  if (host && (!env.FIREBASE_PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(host))) throw new HallBookingError(503, "hall/configuration", "Unsafe hall emulator configuration.");
  const base = host ? `http://${host}/v1/${name}` : `https://firestore.googleapis.com/v1/${name}`;
  async function call(suffix, body, auth = token) {
    const response = await fetcher(`${base}${suffix}`, {method: body === undefined ? "GET" : "POST", headers: {Authorization: `Bearer ${auth}`, "Content-Type": "application/json"}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(20_000)});
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new HallBookingError(403, "hall/forbidden", "Hall access was denied.");
      if (response.status === 409) {
        // Only the provider's fixed status vocabulary is inspected. Never log/return its body.
        let status;
        try {status = (await response.json())?.error?.status;} catch { /* An unconfirmed failure cannot be replayed. */ }
        if (status === "ABORTED") throw new ConfirmedTransactionAbort();
      }
      if ([409, 412].includes(response.status)) throw new HallBookingError(409, "hall/concurrent", "Hall availability changed. Reload and review before saving.");
      throw new HallBookingError(503, "hall/storage", "Hall storage is temporarily unavailable.");
    }
    return response.json();
  }
  return {
    async verifyUser(uid, userToken) {
      // Firestore verifies signature, expiry and project audience before permitting this read.
      const document = await call(`/adminUsers/${encodeURIComponent(uid)}`, undefined, userToken);
      if (document.name !== `${name}/adminUsers/${uid}`) throw new HallBookingError(403, "hall/forbidden", "Valid leader sign-in is required.");
    },
    async transaction(work, {readOnly = false} = {}) {
      let previous = "";
      // Match Firestore's native bounded transaction recovery, not a request/test retry.
      // The callback re-reads authority, revision and occupancy on every confirmed abort.
      for (let attempt = 0; attempt < 5; attempt++) {
        const {transaction} = await call(":beginTransaction", {options: readOnly ? {readOnly: {}} : {readWrite: previous ? {retryTransaction: previous} : {}}});
        const writes = [];
        let completed = false;
        const tx = {
          async read(paths) {
            if (!paths.length) return [];
            const documents = new Map();
            for (let offset = 0; offset < paths.length; offset += 100) {
              const rows = await call(":batchGet", {documents: paths.slice(offset, offset + 100).map(path => `${name}/${path}`), transaction});
              if (!Array.isArray(rows)) throw new HallBookingError(503, "hall/storage", "Hall records could not be read.");
              for (const row of rows) documents.set(row.found?.name ?? row.missing, decodeHallDocument(row.found));
            }
            if (paths.some(path => !documents.has(`${name}/${path}`))) throw new HallBookingError(503, "hall/storage", "Hall transaction was incomplete.");
            return paths.map(path => documents.get(`${name}/${path}`));
          },
          async list(path, cursor = "") {
            const parent = path.slice(0, path.lastIndexOf("/")), collectionId = path.slice(path.lastIndexOf("/") + 1);
            const query = {from: [{collectionId}], orderBy: [{field: {fieldPath: "__name__"}, direction: "ASCENDING"}], limit: 51,
              ...(cursor ? {startAt: {values: [{referenceValue: `${name}/${path}/${cursor}`}], before: false}} : {})};
            const rows = await call(`/${parent}:runQuery`, {structuredQuery: query, transaction});
            const items = rows.filter(row => row.document).map(row => ({key: row.document.name.split("/").pop(), value: decodeHallDocument(row.document)}));
            return {items: items.slice(0, 50), cursor: items.length > 50 ? items[49].key : ""};
          },
          patch(path, data, removed = []) {
            writes.push({update: {name: `${name}/${path}`, fields: fields(data)}, updateMask: {fieldPaths: [...Object.keys(data), ...removed]}, currentDocument: {exists: true}});
          },
          delete(path) { writes.push({delete: `${name}/${path}`}); },
          set(path, data) { writes.push({update: {name: `${name}/${path}`, fields: fields(data)}}); },
          create(path, data) { writes.push({update: {name: `${name}/${path}`, fields: fields(data)}, currentDocument: {exists: false}}); }
        };
        try {
          const result = await work(tx);
          if (writes.length > 500) throw new HallBookingError(400, "hall/bounds", "This change affects too many records.");
          if (writes.length) { await call(":commit", {transaction, writes}); completed = true; }
          return result;
        } catch (error) {
          if (!(error instanceof ConfirmedTransactionAbort) || readOnly || attempt === 4) throw error;
          previous = transaction;
        } finally {
          if (!completed) { try { await call(":rollback", {transaction}); } catch { /* No writes were committed. */ } }
        }
      }
    }
  };
}
