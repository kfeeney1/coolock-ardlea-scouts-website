type Environment = {appEnv?: string; firebaseProjectId?: string; emailApiUrl?: string; hallApiUrl?: string};
/** TEST must never fall back to the Production communications Worker. */
export function hallBookingEndpoint(environment: Environment): string {
  if (environment.appEnv === "test") {
    if (environment.firebaseProjectId !== "coolock-ardlea-scouts-test") throw new Error("Hall booking TEST requires the isolated Firebase project.");
    const value = String(environment.hallApiUrl || "").trim();
    if (!value) return "";
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/"
      || !/^coolock-ardlea-scouts-hall-test\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev$/.test(url.hostname)) throw new Error("Choose the isolated Hall booking TEST Worker origin.");
    return `${url.origin}/hall-bookings`;
  }
  if (environment.firebaseProjectId === "coolock-ardlea-scouts-test") throw new Error("Hall booking TEST requires the TEST application environment.");
  const base = String(environment.emailApiUrl || "").trim().replace(/\/$/, "");
  return base ? `${base}/hall-bookings` : "";
}
