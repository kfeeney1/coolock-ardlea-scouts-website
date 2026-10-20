// Local browser transport adapter for environments that prohibit the Functions
// emulator's Unix sockets. CI still runs the real Functions emulator.
import { createServer } from "node:http";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as handlers from "../../maintenance-functions/src/index.js";
if (process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw new Error("Local Maintenance gateway requires the isolated demo emulators.");
const verifier = initializeApp({projectId: "demo-coolock-ardlea-scouts"}, "maintenance-local-verifier");
createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/.test(origin)) {res.writeHead(403).end(); return;}
  res.setHeader("Access-Control-Allow-Origin", origin || "http://127.0.0.1:4173");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-firebase-appcheck");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {res.writeHead(204).end(); return;}
  res.setHeader("Content-Type", "application/json");
  try {
    const name = req.url?.split("/").at(-1);
    if (!Object.hasOwn(handlers, name || "") || req.method !== "POST") throw new Error("Unsupported Maintenance request.");
    const token = await getAuth(verifier).verifyIdToken((req.headers.authorization || "").replace(/^Bearer /, ""));
    let bytes = 0; const chunks = [];
    for await (const chunk of req) {bytes += chunk.length; if (bytes > 15 * 1024 * 1024) throw new Error("Document request too large."); chunks.push(chunk);}
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const result = await handlers[name].run({auth: {uid: token.uid, token}, data: body.data});
    res.end(JSON.stringify({result}));
  } catch (error) {
    res.statusCode = error.httpErrorCode?.status || 400;
    res.end(JSON.stringify({error: typeof error.toJSON === "function" ? error.toJSON() : {status: "INTERNAL", message: error.message}}));
  }
}).listen(5001, "127.0.0.1", () => console.log("Local Maintenance transport listening on 127.0.0.1:5001"));
