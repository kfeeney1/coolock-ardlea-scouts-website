import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import {
    auth,
    db
} from "../firebase";

export type JoinStatus =
    | "new"
    | "contacted"
    | "waiting-list"
    | "accepted"
    | "closed";

export type ContactMethod =
    | "phone"
    | "email"
    | "text"
    | "in-person"
    | "other";

export type ContactHistoryEntry = {
    id: string;
    date: string;
    method: ContactMethod;
    note: string;
    leaderUid: string;
};

export type JoinApplicationRecord = {
    id: string;
    childFirstName: string;
    childLastName: string;
    childName: string;
    childDob: string;
    parentName: string;
    emailAddress: string;
    mobileNumber: string;
    section: string;
    status: JoinStatus;
    notes: string;
    contactHistory: ContactHistoryEntry[];
    submittedAt: Date | null;
    updatedAt: Date | null;
    memberId: string;
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

function mapContactHistory(
    value: unknown
): ContactHistoryEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (item) =>
                item &&
                typeof item === "object"
        )
        .map(
            (item) => {
                const record =
                    item as Record<
                        string,
                        unknown
                    >;

                return {
                    id:
                        typeof record.id ===
                        "string"
                            ? record.id
                            : crypto.randomUUID(),
                    date:
                        typeof record.date ===
                        "string"
                            ? record.date
                            : "",
                    method:
                        (
                            [
                                "phone",
                                "email",
                                "text",
                                "in-person",
                                "other"
                            ] as ContactMethod[]
                        ).includes(
                            record.method as ContactMethod
                        )
                            ? (record.method as ContactMethod)
                            : "other",
                    note:
                        typeof record.note ===
                        "string"
                            ? record.note
                            : "",
                    leaderUid:
                        typeof record.leaderUid ===
                        "string"
                            ? record.leaderUid
                            : ""
                };
            }
        );
}

function mapJoin(
    snapshot: QueryDocumentSnapshot<DocumentData>
): JoinApplicationRecord {
    const data = snapshot.data();

    const firstName =
        stringValue(
            data,
            "childFirstName"
        );

    const lastName =
        stringValue(
            data,
            "childLastName"
        );

    return {
        id: snapshot.id,
        childFirstName:
            firstName,
        childLastName:
            lastName,
        childName:
            [firstName, lastName]
                .filter(Boolean)
                .join(" ") ||
            "Unnamed applicant",
        childDob:
            stringValue(
                data,
                "childDob"
            ) ||
            stringValue(
                data,
                "dateOfBirth"
            ),
        parentName:
            stringValue(
                data,
                "parentName"
            ),
        emailAddress:
            stringValue(
                data,
                "emailAddress"
            ),
        mobileNumber:
            stringValue(
                data,
                "mobileNumber"
            ),
        section:
            stringValue(
                data,
                "section"
            ),
        status:
            (
                [
                    "new",
                    "contacted",
                    "waiting-list",
                    "accepted",
                    "closed"
                ] as JoinStatus[]
            ).includes(
                data.status as JoinStatus
            )
                ? (data.status as JoinStatus)
                : "new",
        notes:
            stringValue(
                data,
                "notes"
            ),
        contactHistory:
            mapContactHistory(
                data.contactHistory
            ),
        submittedAt:
            timestampToDate(
                data.submittedAt
            ),
        updatedAt:
            timestampToDate(
                data.updatedAt
            ),
        memberId:
            stringValue(
                data,
                "memberId"
            ),
        data
    };
}

export async function loadJoinApplications(): Promise<
    JoinApplicationRecord[]
> {
    const snapshot = await getDocs(
        query(
            collection(
                db,
                "joinApplications"
            ),
            orderBy(
                "submittedAt",
                "desc"
            )
        )
    );

    return snapshot.docs.map(
        mapJoin
    );
}

export async function updateJoinStatus(
    applicationId: string,
    status: JoinStatus
): Promise<void> {
    await updateDoc(
        doc(
            db,
            "joinApplications",
            applicationId
        ),
        {
            status,
            updatedAt:
                serverTimestamp()
        }
    );
}

export async function updateJoinNotes(
    applicationId: string,
    notes: string
): Promise<void> {
    await updateDoc(
        doc(
            db,
            "joinApplications",
            applicationId
        ),
        {
            notes:
                notes
                    .trim()
                    .slice(
                        0,
                        5000
                    ),
            updatedAt:
                serverTimestamp()
        }
    );
}

export async function addContactHistoryEntry(
    application: JoinApplicationRecord,
    method: ContactMethod,
    note: string
): Promise<void> {
    const user =
        auth.currentUser;

    if (!user) {
        throw new Error(
            "No signed-in leader."
        );
    }

    const entry: ContactHistoryEntry = {
        id:
            crypto.randomUUID(),
        date:
            new Date()
                .toISOString(),
        method,
        note:
            note
                .trim()
                .slice(
                    0,
                    1500
                ),
        leaderUid:
            user.uid
    };

    await updateDoc(
        doc(
            db,
            "joinApplications",
            application.id
        ),
        {
            contactHistory: [
                ...application.contactHistory,
                entry
            ],
            status:
                application.status ===
                "new"
                    ? "contacted"
                    : application.status,
            updatedAt:
                serverTimestamp()
        }
    );
}

export async function convertJoinApplicationToMember(
    application: JoinApplicationRecord
): Promise<string> {
    const user =
        auth.currentUser;

    if (!user) {
        throw new Error(
            "No signed-in leader."
        );
    }

    const applicationRef =
        doc(
            db,
            "joinApplications",
            application.id
        );

    const memberRef =
        doc(
            collection(
                db,
                "members"
            )
        );

    await runTransaction(
        db,
        async (transaction) => {
            const snapshot =
                await transaction.get(
                    applicationRef
                );

            if (!snapshot.exists()) {
                throw new Error(
                    "The joining application no longer exists."
                );
            }

            const current =
                snapshot.data();

            if (
                current.memberId &&
                typeof current.memberId ===
                    "string"
            ) {
                throw new Error(
                    "This enquiry has already been converted to a member."
                );
            }

            if (
                current.status !==
                "accepted"
            ) {
                throw new Error(
                    "Only accepted joining enquiries can be converted to members."
                );
            }

            transaction.set(
                memberRef,
                {
                    firstName:
                        application.childFirstName,
                    lastName:
                        application.childLastName,
                    displayName:
                        application.childName,
                    dateOfBirth:
                        application.childDob,
                    section:
                        application.section,
                    parentName:
                        application.parentName,
                    emailAddress:
                        application.emailAddress,
                    mobileNumber:
                        application.mobileNumber,
                    status:
                        "active",
                    source:
                        "join-application",
                    sourceJoinApplicationId:
                        application.id,
                    createdAt:
                        serverTimestamp(),
                    createdBy:
                        user.uid
                }
            );

            transaction.update(
                applicationRef,
                {
                    memberId:
                        memberRef.id,
                    convertedAt:
                        serverTimestamp(),
                    convertedBy:
                        user.uid,
                    updatedAt:
                        serverTimestamp()
                }
            );
        }
    );

    return memberRef.id;
}
