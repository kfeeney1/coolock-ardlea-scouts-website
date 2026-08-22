import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase";
import type { CommunicationRecipient } from "./communicationLogic";

type Scope = {
    isAdmin: boolean;
    sections: string[];
};

function stringValue(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

export async function loadCommunicationRecipients(scope: Scope): Promise<CommunicationRecipient[]> {
    const docs = scope.isAdmin
        ? (await getDocs(collection(db, "members"))).docs
        : (
            await Promise.all(
                [...new Set(scope.sections.filter(Boolean))].map((section) =>
                    getDocs(query(collection(db, "members"), where("section", "==", section)))
                )
            )
        ).flatMap((snapshot) => snapshot.docs);

    const byId = new Map<string, CommunicationRecipient>();
    for (const item of docs) {
        const data = item.data() as Record<string, unknown>;
        byId.set(item.id, {
            id: item.id,
            displayName: stringValue(data, "displayName") || "Unnamed member",
            section: stringValue(data, "section"),
            status: stringValue(data, "status") || "active"
        });
    }

    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}
