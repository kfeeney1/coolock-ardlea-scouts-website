/** Use the website's existing Firebase services only in matching environments. */
export function maintenanceFirebaseAllowed(environment: string, projectId: string | undefined) {
  const projects: Record<string, string> = {local: "demo-coolock-ardlea-scouts", test: "coolock-ardlea-scouts-test", production: "coolock-ardlea-scouts"};
  return Object.hasOwn(projects, environment) && projects[environment] === projectId;
}
