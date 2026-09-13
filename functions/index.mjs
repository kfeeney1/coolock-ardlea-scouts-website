import { readFileSync } from "node:fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  buildCatalogueIndex,
  canManageAdventureAwards,
  canonicalAward,
  isStageAuthoritativelyComplete,
  normaliseAwardRequest,
} from "./lib/adventure-award-policy.mjs";

if (getApps().length === 0) initializeApp();

const catalogue = JSON.parse(readFileSync(new URL("./generated/adventure-skills.json", import.meta.url), "utf8"));
const catalogueIndex = buildCatalogueIndex(catalogue);
const db = getFirestore();

function invalidArgument() {
  return new HttpsError("invalid-argument", "The Adventure Skills award request is invalid.");
}

export const setAdventureSkillAwards = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in is required.");

  let input;
  try {
    input = normaliseAwardRequest(request.data);
  } catch {
    throw invalidArgument();
  }

  const canonical = canonicalAward(catalogueIndex, input.skillId, input.stage);
  if (!canonical) throw invalidArgument();

  const profileRef = db.doc(`adminUsers/${uid}`);
  const leadershipRef = db.doc(`organisationLeadership/${uid}`);

  return db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const leadershipSnapshot = await transaction.get(leadershipRef);
    const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
    const leadership = leadershipSnapshot.exists ? leadershipSnapshot.data() : null;

    const pendingWrites = [];
    let unchanged = 0;

    for (const memberId of input.memberIds) {
      const memberRef = db.doc(`members/${memberId}`);
      const awardRef = db.doc(`memberAdventureSkillProgress/${memberId}/awards/${canonical.awardId}`);
      const requirementsQuery = db.collection(`memberAdventureSkillProgress/${memberId}/requirements`);

      const memberSnapshot = await transaction.get(memberRef);
      if (!memberSnapshot.exists) {
        throw new HttpsError("not-found", "One or more selected children could not be found.");
      }
      const member = memberSnapshot.data();
      if (!canManageAdventureAwards(profile, leadership, member)) {
        throw new HttpsError("permission-denied", "You do not have permission to manage one or more selected awards.");
      }

      const awardSnapshot = await transaction.get(awardRef);
      if (!input.awarded) {
        if (awardSnapshot.exists) pendingWrites.push({ kind: "delete", ref: awardRef });
        else unchanged += 1;
        continue;
      }

      if (member.status !== "active") {
        throw new HttpsError("failed-precondition", "Awards can only be created for active members.");
      }
      if (awardSnapshot.exists) {
        unchanged += 1;
        continue;
      }

      const progressSnapshot = await transaction.get(requirementsQuery);
      const progressDocuments = progressSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
      if (!isStageAuthoritativelyComplete(catalogueIndex, memberId, progressDocuments, canonical.skillId, canonical.stage)) {
        throw new HttpsError("failed-precondition", "One or more selected Adventure Skills stages are not complete.");
      }

      pendingWrites.push({ kind: "set", ref: awardRef, memberId });
    }

    for (const operation of pendingWrites) {
      if (operation.kind === "delete") {
        transaction.delete(operation.ref);
      } else {
        transaction.create(operation.ref, {
          awardId: canonical.awardId,
          memberId: operation.memberId,
          skillId: canonical.skillId,
          stage: canonical.stage,
          awardedAt: FieldValue.serverTimestamp(),
          awardedBy: uid,
        });
      }
    }

    return {
      awarded: input.awarded,
      skillId: canonical.skillId,
      stage: canonical.stage,
      changed: pendingWrites.length,
      unchanged,
    };
  });
});
