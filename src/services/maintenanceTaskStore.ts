import { maintenanceDirectoryPath, maintenanceLeadersPath, requireFreshMaintenanceDirectory, type MaintenanceDirectory } from "./maintenanceDirectoryStore.ts";
import { selectMaintenanceAssignee, validateMaintenanceProgress } from "./maintenanceAssignmentPolicy.ts";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, type Firestore } from "firebase/firestore";
import { UserFacingError } from "./applicationErrors.ts";
export type MaintenanceTask = {id: string; description: string; documentIds: string[]; status: "open" | "complete"; assigneeUid: string; assigneeName: string; assignmentMode?: "explicit" | "default"; revision: number; createdAt: number};
const root = "maintenance/group/tasks";
function taskId(id: unknown): string {
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(id)) throw new UserFacingError("Invalid task reference.");
  return id;
}
export function validateMaintenanceTask(input: Record<string, unknown>) {
  const id = taskId(input.id);
  if (typeof input.description !== "string" || !input.description.trim() || input.description.trim().length > 8000) throw new UserFacingError("Enter a task description of up to 8000 characters.");
  if (!Array.isArray(input.documentIds) || input.documentIds.length > 5 || new Set(input.documentIds).size !== input.documentIds.length) throw new UserFacingError("Choose up to five different maintenance documents.");
  return {id, description: input.description.trim(), documentIds: input.documentIds.map(taskId)};
}
function taskData(id: string, data: Record<string, unknown>): MaintenanceTask {
  const created = data.createdAt;
  return {id, ...data, createdAt: typeof created === "number" ? created : (created as {toMillis(): number}).toMillis()} as MaintenanceTask;
}
export function maintenanceTaskStore(db: Firestore, uid: () => string | undefined) {
  return async (input: Record<string, unknown>) => {
    if (!uid()) throw new UserFacingError("Sign in to use Maintenance tasks.");
    if (input.action === "list") {
      const cursor = input.after ? await getDoc(doc(db, root, taskId(input.after))) : null;
      if (cursor && !cursor.exists()) throw new UserFacingError("Refresh the task list.");
      const page = await getDocs(query(collection(db, root), orderBy("createdAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(50)));
      return {tasks: page.docs.map(item => taskData(item.id, item.data())), next: page.size === 50 ? page.docs.at(-1)!.id : ""};
    }
    if (input.action === "get") {
      const item = await getDoc(doc(db, root, taskId(input.id)));
      if (!item.exists()) throw new UserFacingError("Task no longer exists.");
      return {task: taskData(item.id, item.data())};
    }
    if (input.action === "create") {
      const data = validateMaintenanceTask(input); const owner = uid()!;
      await runTransaction(db, async tx => {
        const record = doc(db, root, data.id); const previous = (await tx.get(record)).data();
        if (previous) {
          if (previous.assignmentMode !== (input.assigneeUid ? "explicit" : "default") || (input.assigneeUid && previous.assigneeUid !== input.assigneeUid) || previous.createdBy !== owner || previous.description !== data.description || JSON.stringify(previous.documentIds) !== JSON.stringify(data.documentIds)) throw new UserFacingError("This task reference is already in use.");
          return;
        }
        const directory = (await tx.get(doc(db, maintenanceDirectoryPath))).data() as MaintenanceDirectory | undefined;
        const currentDirectory = requireFreshMaintenanceDirectory(directory);
        const target = input.assigneeUid || (currentDirectory.groupLeaderUids.length === 1 ? currentDirectory.groupLeaderUids[0] : "");
        if (!target || typeof target !== "string") throw new UserFacingError("There is no single eligible Group Leader. Select a responsible leader explicitly.");
        const candidate = (await tx.get(doc(db, maintenanceLeadersPath, target))).data();
        const assignee = selectMaintenanceAssignee(candidate?.generation === currentDirectory.generation ? [candidate as import("./maintenanceAssignmentPolicy.ts").MaintenanceLeader] : [], input.assigneeUid);
        for (const id of data.documentIds) {
          if ((await tx.get(doc(db, "maintenance/group/documents", id))).data()?.state !== "ready") throw new UserFacingError("A linked document is not ready. Refresh the document list.");
        }
        tx.set(record, {description: data.description, documentIds: data.documentIds, status: "open", assigneeUid: assignee.uid, assigneeName: assignee.displayName, assignmentMode: input.assigneeUid ? "explicit" : "default", revision: 1, createdBy: owner, createdAt: serverTimestamp(), updatedBy: owner, updatedAt: serverTimestamp()});
      });
      return {id: data.id};
    }
    if (input.action === "update") {
      const record = doc(db, root, taskId(input.id));
      await runTransaction(db, async tx => {
        const existing = (await tx.get(record)).data();
        if (!existing) throw new UserFacingError("Task no longer exists.");
        const directory = (await tx.get(doc(db, maintenanceDirectoryPath))).data() as MaintenanceDirectory | undefined;
        const currentDirectory = requireFreshMaintenanceDirectory(directory);
        const target = input.assigneeUid || (currentDirectory.groupLeaderUids.length === 1 ? currentDirectory.groupLeaderUids[0] : "");
        if (!target || typeof target !== "string") throw new UserFacingError("There is no single eligible Group Leader. Select a responsible leader explicitly.");
        const candidate = (await tx.get(doc(db, maintenanceLeadersPath, target))).data();
        const assignee = selectMaintenanceAssignee(candidate?.generation === currentDirectory.generation ? [candidate as import("./maintenanceAssignmentPolicy.ts").MaintenanceLeader] : [], input.assigneeUid);
        const progress = validateMaintenanceProgress({...input, assigneeUid: assignee.uid}, existing.revision);
        tx.update(record, {...progress, assigneeName: assignee.displayName, assignmentMode: input.assigneeUid ? "explicit" : "default", updatedBy: uid(), updatedAt: serverTimestamp()});
      });
      return {id: record.id};
    }
    throw new UserFacingError("Unknown task action.");
  };
}
