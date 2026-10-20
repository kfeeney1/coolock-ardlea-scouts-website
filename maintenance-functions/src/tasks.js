import { HttpsError } from "firebase-functions/v2/https";
import { requireMaintenance } from "./request.js";
const root = "maintenance/group/tasks";
export function validateTask(input) {
  if (typeof input?.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid task reference.");
  if (typeof input.description !== "string" || !input.description.trim() || input.description.trim().length > 8000) throw new HttpsError("invalid-argument", "Enter a task description of up to 8000 characters.");
  if (!Array.isArray(input.documentIds) || input.documentIds.length > 20 || new Set(input.documentIds).size !== input.documentIds.length || input.documentIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(id))) throw new HttpsError("invalid-argument", "Choose up to 20 maintenance documents.");
  return { description: input.description.trim(), documentIds: input.documentIds };
}
export async function handleTasks(db, request) {
  const uid = await requireMaintenance(db, request);
  const input = request.data || {};
  if (input.action === "list") {
    const tasks = await db.collection(root).orderBy("createdAt", "desc").limit(200).get();
    return {tasks: tasks.docs.map(doc => ({id: doc.id, ...doc.data()})), limited: tasks.size === 200};
  }
  if (input.action === "get") {
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid task reference.");
    const task = await db.doc(`${root}/${input.id}`).get();
    if (!task.exists) throw new HttpsError("not-found", "Task no longer exists.");
    return {task: {id: task.id, ...task.data()}};
  }
  if (input.action === "create") {
    const data = validateTask(input);
    const ref = db.doc(`${root}/${input.id}`);
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      if (previous) {
        if (previous.createdBy !== uid || previous.description !== data.description || JSON.stringify(previous.documentIds) !== JSON.stringify(data.documentIds)) throw new HttpsError("already-exists", "This task reference is already in use.");
        return;
      }
      for (const id of data.documentIds) {
        if ((await tx.get(db.doc(`maintenance/group/documents/${id}`))).data()?.state !== "ready") throw new HttpsError("failed-precondition", "A linked document is not ready. Refresh the document list.");
      }
      tx.create(ref, {...data, status: "open", assigneeUid: "", assigneeName: "Assignment pending", revision: 1, createdBy: uid, createdAt: Date.now(), updatedBy: uid, updatedAt: Date.now()});
    });
    return {id: input.id};
  }
  throw new HttpsError("invalid-argument", "Unknown task action.");
}
