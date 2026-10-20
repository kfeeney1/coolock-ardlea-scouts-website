export function activeLeader(data) {
  return data?.active === true && ["leader", "admin", "super-admin"].includes(data.role)
    && Array.isArray(data.sections) && data.sections.length > 0 && !("section" in data);
}
/** A Firebase identity alone is never membership. This Firebase project is the group boundary. */
export async function groupMember(db, uid) {
  const [leader, parent, linked] = await Promise.all([
    db.doc(`adminUsers/${uid}`).get(), db.doc(`parentAccounts/${uid}`).get(),
    db.collection("members").where("accountUid", "==", uid).where("status", "==", "active").limit(1).get()
  ]);
  return activeLeader(leader.data()) || parent.data()?.status === "approved" || !linked.empty;
}
