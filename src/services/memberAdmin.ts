import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import type {
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";

export type MemberStatus = "active" | "inactive" | "left";

export type MemberRecord = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: string;
  section: string;
  parentName: string;
  emailAddress: string;
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: MemberStatus;
  source: string;
  sourceJoinApplicationId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type MemberConsentSummary = {
  consentId: string;
  memberName: string;
  dateOfBirth: string;
  section: string;
  consentTo: string;
  submittedAt: Date | null;
  hasMedicalAlert: boolean;
  hasMedicationManagement: boolean;
};

function timestampToDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate();
  }

  return null;
}

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function mapMember(
  snapshot: QueryDocumentSnapshot<DocumentData>
): MemberRecord {
  const data = snapshot.data();
  const firstName = stringValue(data, "firstName");
  const lastName = stringValue(data, "lastName");

  return {
    id: snapshot.id,
    firstName,
    lastName,
    displayName:
      stringValue(data, "displayName") ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      "Unnamed member",
    dateOfBirth: stringValue(data, "dateOfBirth"),
    section: stringValue(data, "section"),
    parentName: stringValue(data, "parentName"),
    emailAddress: stringValue(data, "emailAddress"),
    mobileNumber: stringValue(data, "mobileNumber"),
    emergencyContactName: stringValue(data, "emergencyContactName"),
    emergencyContactPhone: stringValue(data, "emergencyContactPhone"),
    status:
      data.status === "inactive" || data.status === "left"
        ? data.status
        : "active",
    source: stringValue(data, "source"),
    sourceJoinApplicationId: stringValue(
      data,
      "sourceJoinApplicationId"
    ),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt)
  };
}

function yes(data: DocumentData, key: string): boolean {
  return data[key] === "Yes";
}

function medicationEnabled(data: DocumentData): boolean {
  const medication = data.medicationManagement;

  return Boolean(
    medication &&
      typeof medication === "object" &&
      "enabled" in medication &&
      medication.enabled === true
  );
}

function consentMemberName(data: DocumentData): string {
  return (
    stringValue(data, "childName") ||
    stringValue(data, "name") ||
    [
      stringValue(data, "childFirstName"),
      stringValue(data, "childLastName")
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function consentDob(data: DocumentData): string {
  return (
    stringValue(data, "dateOfBirth") ||
    stringValue(data, "childDob")
  );
}

function hasMedicalAlert(data: DocumentData): boolean {
  return [
    "seriousIllness",
    "regularMeds",
    "medAllergies",
    "allergies",
    "dietaryReqs",
    "epilepsy",
    "diabetes",
    "asthma",
    "heartDisease",
    "highBloodPressure",
    "skinAllergies",
    "hearingDifficulties",
    "onMedication"
  ].some((key) => yes(data, key));
}

export async function loadMembers(): Promise<MemberRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "members"),
      orderBy("displayName", "asc")
    )
  );

  return snapshot.docs.map(mapMember);
}

export async function updateMember(
  memberId: string,
  updates: Pick<
    MemberRecord,
    | "firstName"
    | "lastName"
    | "displayName"
    | "dateOfBirth"
    | "section"
    | "parentName"
    | "emailAddress"
    | "mobileNumber"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "status"
  >
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No signed-in leader.");
  }

  const clean = (value: string, max: number) =>
    value.trim().slice(0, max);

  await updateDoc(doc(db, "members", memberId), {
    firstName: clean(updates.firstName, 100),
    lastName: clean(updates.lastName, 100),
    displayName: clean(updates.displayName, 200),
    dateOfBirth: clean(updates.dateOfBirth, 20),
    section: clean(updates.section, 40),
    parentName: clean(updates.parentName, 200),
    emailAddress: clean(updates.emailAddress, 254),
    mobileNumber: clean(updates.mobileNumber, 40),
    emergencyContactName: clean(
      updates.emergencyContactName,
      200
    ),
    emergencyContactPhone: clean(
      updates.emergencyContactPhone,
      40
    ),
    status: updates.status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}

export async function loadMemberConsentSummaries(
  member: MemberRecord
): Promise<MemberConsentSummary[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "consentApplications"),
      orderBy("submittedAt", "desc")
    )
  );

  const memberName = member.displayName.trim().toLowerCase();
  const memberDob = member.dateOfBirth.trim();

  return snapshot.docs
    .map((consentSnapshot) => {
      const data = consentSnapshot.data();

      return {
        consentId: consentSnapshot.id,
        memberName: consentMemberName(data),
        dateOfBirth: consentDob(data),
        section:
          stringValue(data, "scoutSection") ||
          stringValue(data, "section"),
        consentTo: stringValue(data, "consentTo"),
        submittedAt: timestampToDate(data.submittedAt),
        hasMedicalAlert: hasMedicalAlert(data),
        hasMedicationManagement: medicationEnabled(data)
      };
    })
    .filter((consent) => {
      const sameName =
        consent.memberName.trim().toLowerCase() === memberName;

      const sameDob =
        !memberDob ||
        !consent.dateOfBirth ||
        consent.dateOfBirth === memberDob;

      return sameName && sameDob;
    });
}
