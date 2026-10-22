import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { MaintenanceTask } from "./maintenanceTaskStore";
export {taskAppointmentId, taskCalendarEntry, maintenanceTaskTitle} from "./maintenanceTaskCalendarLogic";
export function watchMaintenanceTask(id: string, next: (task: MaintenanceTask | null) => void, failed: () => void) {
  return onSnapshot(doc(db, "maintenance/group/tasks", id), {includeMetadataChanges: true}, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    const data = snapshot.data();
    next(data && typeof data.description === "string" && ["open", "complete"].includes(data.status) && typeof data.assigneeName === "string" && Array.isArray(data.documentIds) ? {id, ...data, createdAt: typeof data.createdAt === "number" ? data.createdAt : data.createdAt?.toMillis?.() || 0} as MaintenanceTask : null);
  }, failed);
}
