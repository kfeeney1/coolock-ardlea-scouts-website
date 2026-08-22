import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { db } from "../firebase";

export type RecordKind =
    | "join"
    | "consent";

export type AdminRecord = {
    id: string;
    kind: RecordKind;
    submittedAt: Date | null;
    status: string;
    title: string;
    subtitle: string;
    data: Record<string, unknown>;
};

function timestampToDate(
    value: unknown
): Date | null {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (
            value as Timestamp
        ).toDate === "function"
    ) {
        return (
            value as Timestamp
        ).toDate();
    }

    return null;
}

function stringValue(
    data: DocumentData,
    key: string
): string {
    const value = data[key];

    return typeof value === "string"
        ? value
        : "";
}

function mapJoin(
    snapshot: QueryDocumentSnapshot<DocumentData>
): AdminRecord {
    const data = snapshot.data();

    const childName = [
        stringValue(
            data,
            "childFirstName"
        ),
        stringValue(
            data,
            "childLastName"
        )
    ]
        .filter(Boolean)
        .join(" ");

    return {
        id: snapshot.id,
        kind: "join",
        submittedAt: timestampToDate(
            data.submittedAt
        ),
        status:
            stringValue(data, "status") ||
            "new",
        title:
            childName ||
            "Join application",
        subtitle:
            stringValue(data, "section") ||
            stringValue(
                data,
                "emailAddress"
            ),
        data
    };
}

function mapConsent(
    snapshot: QueryDocumentSnapshot<DocumentData>
): AdminRecord {
    const data = snapshot.data();

    const formType =
        stringValue(data, "formType");

    const title =
        formType ===
        "scouter-es3-medical-advice"
            ? stringValue(data, "name") ||
              "Scouter ES3"
            : stringValue(
                  data,
                  "childName"
              ) || "Youth consent";

    return {
        id: snapshot.id,
        kind: "consent",
        submittedAt: timestampToDate(
            data.submittedAt
        ),
        status:
            stringValue(data, "status") ||
            "active",
        title,
        subtitle:
            stringValue(
                data,
                "scoutSection"
            ) || formType,
        data
    };
}

export async function loadAdminRecords(): Promise<
    AdminRecord[]
> {
    const joinQuery = query(
        collection(
            db,
            "joinApplications"
        ),
        orderBy("submittedAt", "desc"),
        limit(200)
    );

    const consentQuery = query(
        collection(
            db,
            "consentApplications"
        ),
        orderBy("submittedAt", "desc"),
        limit(200)
    );

    const [
        joinSnapshot,
        consentSnapshot
    ] = await Promise.all([
        getDocs(joinQuery),
        getDocs(consentQuery)
    ]);

    return [
        ...joinSnapshot.docs.map(mapJoin),
        ...consentSnapshot.docs.map(
            mapConsent
        )
    ].sort((left, right) => {
        const leftTime =
            left.submittedAt?.getTime() ?? 0;
        const rightTime =
            right.submittedAt?.getTime() ?? 0;

        return rightTime - leftTime;
    });
}

export async function updateRecordStatus(
    record: AdminRecord,
    status: string
): Promise<void> {
    const collectionName =
        record.kind === "join"
            ? "joinApplications"
            : "consentApplications";

    await updateDoc(
        doc(
            db,
            collectionName,
            record.id
        ),
        {
            status
        }
    );
}
