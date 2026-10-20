import app, { appEnvironment } from "../firebase";
import { maintenanceEmulatorAllowed } from "./maintenanceCostPolicy";

export const maintenanceAvailable = maintenanceEmulatorAllowed(appEnvironment, app.options.projectId);
export const maintenanceCostHoldMessage = "Maintenance is paused while a zero-cost hosting option is agreed. Existing records are retained.";
export function requireMaintenanceRuntime() {
  if (!maintenanceAvailable) throw new Error(maintenanceCostHoldMessage);
}
