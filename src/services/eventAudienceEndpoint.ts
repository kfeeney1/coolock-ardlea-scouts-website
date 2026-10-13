type EventBackendEnvironment = { appEnv?: string; firebaseProjectId?: string; emailApiUrl?: string };

export function eventAudienceEndpoint(environment: EventBackendEnvironment): string {
  if (environment.appEnv === "test") {
    if (environment.firebaseProjectId !== "coolock-ardlea-scouts-test") {
      throw new Error("TEST event persistence requires the isolated TEST Firebase project.");
    }
    return "/api/event-audience-save";
  }
  const backendUrl = String(environment.emailApiUrl || "").trim().replace(/\/$/, "");
  return backendUrl ? `${backendUrl}/event-audience-save` : "";
}
