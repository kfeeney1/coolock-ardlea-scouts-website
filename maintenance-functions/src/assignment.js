import { HttpsError } from "firebase-functions/v2/https";
import { activeLeader } from "./access.js";
import { normalizeScoutingAppointmentAssignments, activeScoutingAppointments } from "./appointments.js";
export function eligibleLeader(uid, profile, organisation) {
  if (!activeLeader(profile) || organisation?.active !== true || typeof organisation.displayName !== "string" || !organisation.displayName.trim()) return null;
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(organisation.appointments, organisation.scoutingRole, organisation.organisationSection));
  if (!appointments.length) return null;
  return {uid, displayName: organisation.displayName, groupLeader: appointments.some(a => a.appointment === "Group Leader" && a.scope === "Group")};
}
export function selectAssignee(leaders, selected) {
  if (selected !== undefined && typeof selected !== "string") throw new HttpsError("invalid-argument", "Choose an eligible leader.");
  const choices = selected ? leaders.filter(leader => leader.uid === selected) : leaders.filter(leader => leader.groupLeader);
  if (choices.length !== 1) throw new HttpsError("failed-precondition", selected ? "The selected leader is no longer eligible. Choose another leader." : "There is no single eligible Group Leader. Select a responsible leader explicitly.");
  return {assigneeUid: choices[0].uid, assigneeName: choices[0].displayName};
}
export async function loadEligibleLeaders(db, tx) {
  const organisations = tx ? await tx.get(db.collection("organisationLeadership").where("active", "==", true)) : await db.collection("organisationLeadership").where("active", "==", true).get();
  const leaders = [];
  for (const organisation of organisations.docs) {
    const ref = db.doc(`adminUsers/${organisation.id}`);
    const profile = tx ? await tx.get(ref) : await ref.get();
    const leader = eligibleLeader(organisation.id, profile.data(), organisation.data());
    if (leader) leaders.push(leader);
  }
  return leaders.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
