import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onRequest } from "firebase-functions/v2/https";
import { handleEventAudienceSave } from "./shared/productionRoutes.js";
import { createEventSaveHandler } from "./handler.js";

const credential = applicationDefault();
const app = initializeApp({ credential });

export const eventAudienceSave = onRequest({
  region: "europe-west1",
  invoker: "public",
  cors: false,
  maxInstances: 3,
  memory: "256MiB",
  timeoutSeconds: 60
}, async (request, response) => {
  const handler = createEventSaveHandler({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "",
    verifyIdToken: (token) => getAuth(app).verifyIdToken(token),
    getServiceAccessToken: async () => (await credential.getAccessToken()).access_token,
    saveAudience: handleEventAudienceSave
  });
  const headers = new Headers();
  for (const name of ["Authorization", "Origin", "Content-Type"]) {
    const value = request.get(name);
    if (value) headers.set(name, value);
  }
  const result = await handler(new Request("https://event-save.invalid/event-audience-save", {
    method: request.method,
    headers,
    ...(!["GET", "HEAD"].includes(request.method) ? { body: request.rawBody?.toString() || JSON.stringify(request.body) } : {})
  }));
  result.headers.forEach((value, name) => response.set(name, value));
  response.status(result.status).send(await result.text());
});
