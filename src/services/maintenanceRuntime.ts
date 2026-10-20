import app, { appEnvironment } from "../firebase";
import { maintenanceEmulatorAllowed } from "./maintenanceCostPolicy";

export const maintenanceAvailable = maintenanceEmulatorAllowed(appEnvironment, app.options.projectId);
export const maintenanceCostHoldMessage = "Maintenance is being updated to use the existing site services. Existing records are retained.";
export function requireMaintenanceRuntime() {
  if (!maintenanceAvailable) throw new Error(maintenanceCostHoldMessage);
}
