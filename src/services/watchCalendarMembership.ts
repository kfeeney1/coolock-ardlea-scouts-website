import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
/** A reference is not a live grant. Watch canonical proof and current scope sources too. */
export function watchCalendarMembership(uid: string, ready: () => void, changing: () => void, invalid: () => void, failed: () => void, capability: "calendar" | "maintenance" = "calendar") {
  let active = true; let pointer = ""; let stopSources = () => {};
  const stopReference = onSnapshot(doc(db, `${capability}/group/access`, uid), {includeMetadataChanges: true}, reference => {
    if (!active || reference.metadata.fromCache || reference.metadata.hasPendingWrites) return;
    const proof = reference.data();
    const roots: Record<string, string> = {leader: "adminUsers", parent: "parentAccounts", member: "members"};
    if (!proof || !Object.hasOwn(roots, proof.kind) || typeof proof.sourceId !== "string" || !proof.sourceId || proof.sourceId.includes("/")) {invalid(); return;}
    const key = `${proof.kind}:${proof.sourceId}`;
    if (key === pointer) return;
    pointer = key; stopSources(); changing();
    let current = true; let published = "";
    const values = new Map<string, string>();
    const children = new Map<string, string | null>();
    let childKey = ""; let stopChildren = () => {};
    const labels = ["proof", ...(proof.kind !== "parent" ? ["parent"] : []), ...(proof.kind === "leader" ? ["organisation"] : [])];
    const publish = () => {
      if (!active || !current || values.size !== labels.length || [...children.values()].some(value => value === null)) return;
      const signature = JSON.stringify([labels.map(label => values.get(label)), [...children]]);
      if (signature !== published) {published = signature; ready();}
    };
    const watchChildren = (data?: Record<string, unknown>) => {
      const ids = data?.status === "approved" && Array.isArray(data.memberIds) ? [...new Set(data.memberIds)] : [];
      if (ids.length > 8 || ids.some(id => typeof id !== "string" || !id || id.includes("/"))) {failed(); return;}
      const nextKey = JSON.stringify(ids);
      if (childKey === nextKey) return;
      childKey = nextKey; stopChildren(); children.clear(); changing();
      ids.forEach(id => children.set(id as string, null));
      const stops = ids.map(id => onSnapshot(doc(db, "members", id as string), {includeMetadataChanges: true}, snapshot => {
        if (!active || !current || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        const child = snapshot.data();
        children.set(id as string, JSON.stringify([child?.status, child?.section, child?.sections]));
        publish();
      }, () => {if (active && current) failed();}));
      stopChildren = () => stops.forEach(stop => stop());
    };
    const targets = [{label: "proof", root: roots[proof.kind], id: proof.sourceId}, ...(proof.kind !== "parent" ? [{label: "parent", root: "parentAccounts", id: uid}] : []), ...(proof.kind === "leader" ? [{label: "organisation", root: "organisationLeadership", id: uid}] : [])];
    const stops = targets.map(target => onSnapshot(doc(db, target.root, target.id), {includeMetadataChanges: true}, snapshot => {
      if (!active || !current || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      const data = snapshot.data();
      if (target.label === "proof") {
        const valid = proof.kind === "parent" ? data?.status === "approved" : proof.kind === "member" ? data?.status === "active" && data.accountUid === uid
          : data?.active === true && ["leader", "admin", "super-admin"].includes(data.role) && Array.isArray(data.sections) && data.sections.length > 0 && !Object.hasOwn(data, "section");
        if (!valid) {invalid(); return;}
      }
      if (target.root === "parentAccounts") watchChildren(data);
      values.set(target.label, JSON.stringify([data?.active, data?.status, data?.role, data?.sections, data?.section, data?.accountUid, data?.scoutingRole, data?.organisationSection, data?.appointments, data?.memberIds]));
      publish();
    }, () => {if (active && current) target.label === "proof" ? invalid() : failed();}));
    stopSources = () => {current = false; stopChildren(); stops.forEach(stop => stop());};
  }, () => {if (active) invalid();});
  return () => {active = false; stopReference(); stopSources();};
}
