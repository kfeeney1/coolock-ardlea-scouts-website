const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_EMAIL_API_URL"
];

const missing = required.filter((name) => !String(process.env[name] || "").trim());

if (missing.length > 0) {
  console.error(`Missing required production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const emailApiUrl = process.env.VITE_EMAIL_API_URL.trim();
try {
  const parsed = new URL(emailApiUrl);
  if (parsed.protocol !== "https:") throw new Error("not https");
} catch {
  console.error("VITE_EMAIL_API_URL must be a valid HTTPS URL.");
  process.exit(1);
}

console.log("Production environment configuration is present and valid.");
