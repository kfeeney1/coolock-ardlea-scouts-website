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
        const displayName = stringValue(data, "displayName");
        const section = stringValue(data, "section");
        const status = stringValue(data, "status");
        if (!displayName || !section || !["active", "inactive", "left"].includes(status)) continue;
        byId.set(item.id, { id: item.id, displayName, section, status });
    }

    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}
