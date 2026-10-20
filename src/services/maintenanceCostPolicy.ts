/** Live Maintenance is suspended until its shared hosting meets the zero-spend requirement. */
export function maintenanceEmulatorAllowed(environment: string, projectId: string | undefined) {
  return environment === "local" && projectId === "demo-coolock-ardlea-scouts";
}
