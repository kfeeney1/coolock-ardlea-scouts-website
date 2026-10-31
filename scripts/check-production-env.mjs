import {hallBookingEndpoint} from "../src/services/hallBookingEndpoint.ts";
import { fileURLToPath } from "node:url";

const REQUIRED_APPLICATION_VARIABLES = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

export function applicationEnvironmentErrors(environment = process.env) {
  const errors = [];
  const isTest = environment.DEPLOY_ENVIRONMENT === "test";
  const required = isTest ? REQUIRED_APPLICATION_VARIABLES : [...REQUIRED_APPLICATION_VARIABLES, "VITE_EMAIL_API_URL"];
  const missing = required.filter((name) => !String(environment[name] || "").trim());
  if (missing.length > 0) errors.push(`Missing required application environment variables: ${missing.join(", ")}`);

  const expectedProjectId = String(environment.FIREBASE_PROJECT_ID || "").trim();
  const configuredProjectId = String(environment.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (expectedProjectId && configuredProjectId !== expectedProjectId) {
    errors.push(`VITE_FIREBASE_PROJECT_ID must equal the deployment target ${expectedProjectId}.`);
  }

  if (isTest && environment.VITE_HALL_BOOKING_API_URL) {
    try {hallBookingEndpoint({appEnv: "test", firebaseProjectId: configuredProjectId, hallApiUrl: environment.VITE_HALL_BOOKING_API_URL});}
    catch {errors.push("VITE_HALL_BOOKING_API_URL must name the isolated TEST booking Worker origin.");}
  }
  const emailApiUrl = String(environment.VITE_EMAIL_API_URL || "").trim();
  if (!isTest && emailApiUrl) {
    try {
      const parsed = new URL(emailApiUrl);
      if (parsed.protocol !== "https:") throw new Error("not https");

    } catch {
      errors.push("VITE_EMAIL_API_URL must be a valid HTTPS URL.");
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = applicationEnvironmentErrors();
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  if (process.env.DEPLOY_ENVIRONMENT !== "test") console.log("Application backend endpoint is configured and valid.");
  console.log("Firebase application configuration matches the deployment target.");
}
