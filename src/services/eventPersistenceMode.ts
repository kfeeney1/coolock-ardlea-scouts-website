export function usesDirectEventPersistence(appEnv?: string, projectId?: string): boolean {
  if (appEnv !== "test") return false;
  if (projectId !== "coolock-ardlea-scouts-test") throw new Error("Direct TEST persistence requires the isolated TEST Firebase project.");
  return true;
}
