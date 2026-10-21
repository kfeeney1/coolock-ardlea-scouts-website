import app, { appEnvironment } from "../firebase";
import { maintenanceFirebaseAllowed } from "./maintenanceCostPolicy";

export const maintenanceAvailable = maintenanceFirebaseAllowed(appEnvironment, app.options.projectId);
export const maintenanceCostHoldMessage = "Maintenance is unavailable in this Firebase environment. Existing records are retained.";
export function requireMaintenanceRuntime() {
  if (!maintenanceAvailable) throw new Error(maintenanceCostHoldMessage);
}
