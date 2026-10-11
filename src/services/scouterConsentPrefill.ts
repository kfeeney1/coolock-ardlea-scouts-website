import type { ScouterConsentData } from "./consentApplications";
import { auth } from "../firebase";
import { loadLeaderMedicalDefaults } from "./leaderProfile";
import { loadOwnLeaderMedicalState } from "./leaderMedicalLifecycle";
import { mergeScouterConsentPrefill } from "./scouterConsentPrefillLogic";

export async function loadScouterConsentPrefill(current: ScouterConsentData): Promise<ScouterConsentData> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No signed-in Scouter was found.");
  const [profile, medical] = await Promise.all([loadLeaderMedicalDefaults(), loadOwnLeaderMedicalState()]);
  if (auth.currentUser?.uid !== uid) throw new Error("Your signed-in account changed while the form was loading. Reopen it to continue.");
  return mergeScouterConsentPrefill(current, medical.data, profile);
}
