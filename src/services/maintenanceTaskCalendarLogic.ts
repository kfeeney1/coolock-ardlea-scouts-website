import type { MaintenanceTask } from "./maintenanceTaskStore.ts";
import type { MaintenanceAppointment } from "./maintenanceAppointmentLogic.ts";
import type { CalendarEntry } from "./groupCalendar.ts";
export const taskAppointmentId = (taskId: string) => `task-${taskId}`;
export function maintenanceTaskTitle(description: string) {
  const first = description.trim().split(/\r?\n/)[0] || "Maintenance task";
  return first.length > 80 ? `${first.slice(0, 79)}…` : first;
}
export function taskCalendarEntry(record: MaintenanceAppointment, task: MaintenanceTask | null): CalendarEntry {
  return {id: `maintenance:${record.id}`, type: "maintenance", title: task ? maintenanceTaskTitle(task.description) : "Maintenance task unavailable", date: record.date, time: record.allDay ? "" : record.startTime, section: "Group", detail: task ? `Responsible leader: ${task.assigneeName} · ${task.status === "complete" ? "Complete" : "Open"}` : "Source task unavailable", path: `/maintenance/tasks/${encodeURIComponent(record.taskId!)}`};
}
