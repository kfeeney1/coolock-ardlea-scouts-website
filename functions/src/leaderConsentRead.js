import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { activeLeader } from "./shared/access.js";
import { canonicalMemberSection, memberSectionStorageAliases } from "./shared/memberSectionCore.mjs";

function linkedMemberId(data) {
  return data.formType === "youth-activity-consent" && typeof data.memberId === "string" ? data.memberId : "";
}

function sectionAliases(scope) {
  return canonicalMemberSection(scope) === scope ? memberSectionStorageAliases(scope) : [scope];
}

function mayReadSection(sections, section) {
  return sections.some(scope => sectionAliases(scope).includes(section));
}

function visibleConsent(snapshot, member, profile, uid, detail) {
  const data = snapshot.data();
  if (!data) return null;
  const historicalSection = typeof data.section === "string" ? data.section : "";
  const memberId = linkedMemberId(data);
  const currentSection = canonicalMemberSection(member?.section);
  const admin = profile.role === "admin" || profile.role === "super-admin";
  const currentMembership = currentSection && (mayReadSection(profile.sections, member.section)
    || (Array.isArray(member.sections) && member.sections.includes(member.section)
      && member.sections.some(section => profile.sections.includes(section))));
  const allowed = admin || (memberId ? currentMembership : mayReadSection(profile.sections, historicalSection))
    || (detail && data.formType === "scouter-es3-medical-advice" && data.submittedByUid === uid);
  if (!allowed) return null;
  return { id: snapshot.id, section: currentSection || historicalSection, data: withWireTimestamps(data) };
}

function withWireTimestamps(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key, value instanceof Timestamp ? { seconds: value.seconds, nanoseconds: value.nanoseconds } : value
  ]));
}

function batches(items) {
  const groups = [];
  for (let offset = 0; offset < items.length; offset += 30) groups.push(items.slice(offset, offset + 30));
  return groups;
}

export async function readLeaderConsent(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to read consent.");
  const consentId = request.data?.consentId;
  if (consentId !== undefined && (typeof consentId !== "string" || !consentId || consentId.includes("/"))) {
    throw new HttpsError("invalid-argument", "Invalid consent record.");
  }

  return db.runTransaction(async transaction => {
    const profile = (await transaction.get(db.collection("adminUsers").doc(uid))).data();
    if (!activeLeader(profile)) throw new HttpsError("permission-denied", "Active leader profile is required.");
    const scopes = profile.sections.filter(section => typeof section === "string" && section);
    const consents = db.collection("consentApplications");
    const members = db.collection("members");
    const admin = profile.role === "admin" || profile.role === "super-admin";
    let documents;
    if (consentId) {
      documents = [await transaction.get(consents.doc(consentId))];
    } else if (admin) {
      documents = (await transaction.get(consents.orderBy("submittedAt", "desc"))).docs;
    } else {
      const aliases = [...new Set(scopes.flatMap(sectionAliases))];
      if (!aliases.length) return [];
      const [primary, secondary, historical] = await Promise.all([
        Promise.all(batches(aliases).map(group => transaction.get(members.where("section", "in", group)))),
        Promise.all(batches(scopes).map(group => transaction.get(members.where("sections", "array-contains-any", group)))),
        Promise.all(batches(aliases).map(group => transaction.get(consents.where("section", "in", group))))
      ]);
      const ids = [...new Set([...primary, ...secondary].flatMap(result => result.docs.map(item => item.id)))];
      const linked = await Promise.all(batches(ids).map(group => transaction.get(consents.where("memberId", "in", group))));
      documents = [...new Map([...historical, ...linked].flatMap(result => result.docs).map(item => [item.id, item])).values()];
    }
    const ids = [...new Set(documents.map(item => linkedMemberId(item.data() || {})).filter(id => id && !id.includes("/")))];
    const memberById = new Map();
    for (const group of batches(ids)) {
      const snapshots = await transaction.getAll(...group.map(id => members.doc(id)));
      snapshots.forEach(snapshot => memberById.set(snapshot.id, snapshot.data()));
    }
    return documents.flatMap(snapshot => {
      const record = visibleConsent(snapshot, memberById.get(linkedMemberId(snapshot.data() || {})), profile, uid, Boolean(consentId));
      return record ? [record] : [];
    });
  }, { readOnly: true });
}
