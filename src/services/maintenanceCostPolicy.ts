/** Live Maintenance is suspended until the direct Firebase SDK migration is complete. */
export function maintenanceEmulatorAllowed(environment: string, projectId: string | undefined) {
  return environment === "local" && projectId === "demo-coolock-ardlea-scouts";
}
