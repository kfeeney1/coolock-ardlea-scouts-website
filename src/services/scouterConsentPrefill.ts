import type { MedicationManagementData, ScouterConsentData, YesNo } from "./consentApplications";
import { loadLeaderMedicalDefaults } from "./leaderProfile";
import { loadOwnLeaderMedicalState } from "./leaderMedicalLifecycle";

export async function loadScouterConsentPrefill(current: ScouterConsentData): Promise<ScouterConsentData> {
  const [profile, medical] = await Promise.all([loadLeaderMedicalDefaults(), loadOwnLeaderMedicalState()]);
  const previous = medical.data ?? {};
  const text = (key: string) => typeof previous[key] === "string" ? String(previous[key]) : "";
  return {
    ...current,
    name: text("name") || profile.name || current.name,
    dob: text("dob") || profile.dob || current.dob,
    address: text("address") || profile.address || current.address,
    mobile: text("mobile") || profile.mobile || current.mobile,
    homePhone: text("homePhone") || profile.homePhone || current.homePhone,
    workPhone: text("workPhone") || profile.workPhone || current.workPhone,
    nextOfKinName: text("nextOfKinName") || current.nextOfKinName,
    nextOfKinAddress: text("nextOfKinAddress") || current.nextOfKinAddress,
    nextOfKinMobile: text("nextOfKinMobile") || current.nextOfKinMobile,
    nextOfKinHome: text("nextOfKinHome") || current.nextOfKinHome,
    nextOfKinWork: text("nextOfKinWork") || current.nextOfKinWork,
    epilepsy: (text("epilepsy") as YesNo | "") || current.epilepsy,
    diabetes: (text("diabetes") as YesNo | "") || current.diabetes,
    asthma: (text("asthma") as YesNo | "") || current.asthma,
    heartDisease: (text("heartDisease") as YesNo | "") || current.heartDisease,
    highBloodPressure: (text("highBloodPressure") as YesNo | "") || current.highBloodPressure,
    skinAllergies: (text("skinAllergies") as YesNo | "") || current.skinAllergies,
    hearingDifficulties: (text("hearingDifficulties") as YesNo | "") || current.hearingDifficulties,
    otherMedical: text("otherMedical") || current.otherMedical,
    previousInjuries: text("previousInjuries") || current.previousInjuries,
    onMedication: (text("onMedication") as YesNo | "") || current.onMedication,
    medicationDetails: text("medicationDetails") || current.medicationDetails,
    allergies: text("allergies") || current.allergies,
    medicationManagement: previous.medicationManagement && typeof previous.medicationManagement === "object"
      ? { ...current.medicationManagement, ...(previous.medicationManagement as MedicationManagementData), signature: "", signatureDate: current.signatureDate }
      : current.medicationManagement,
    signature: "",
    declarationConfirmed: false
  };
}
