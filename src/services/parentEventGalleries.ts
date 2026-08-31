import { collection, getDocs, query, where } from "firebase/firestore";
import { getBlob, getMetadata, listAll, ref } from "firebase/storage";

import { auth, db, storage } from "../firebase";

export type ParentGalleryPhoto = {
    id: string;
    path: string;
    fileName: string;
    contentType: string;
    size: number;
    objectUrl: string;
};

export type ParentEventGallery = {
    eventId: string;
    title: string;
    description: string;
    eventType: string;
    section: string;
    location: string;
    startDate: string;
    endDate: string;
    photos: ParentGalleryPhoto[];
};

type CandidateEvent = Omit<ParentEventGallery, "photos">;

function stringValue(data: Record<string, unknown>, key: string): string {
    return typeof data[key] === "string" ? (data[key] as string).trim() : "";
}

function safeStorageSegment(value: string, label: string): string {
    const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!safe) throw new Error(`${label} is required.`);
    return safe;
}

function storageErrorCode(error: unknown): string {
    if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
        return (error as { code: string }).code;
    }
    return "";
}

function storageErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        return (error as { message: string }).message;
    }
    return error instanceof Error ? error.message : "";
}

function storageErrorServerResponse(error: unknown): string {
    if (!error || typeof error !== "object" || !("customData" in error)) return "";
    const customData = (error as { customData?: unknown }).customData;
    if (!customData || typeof customData !== "object" || !("serverResponse" in customData)) return "";
    const serverResponse = (customData as { serverResponse?: unknown }).serverResponse;
    return typeof serverResponse === "string" ? serverResponse : "";
}

function storageErrorDetails(error: unknown): string {
    // FirebaseError.toString() can include emulator rule diagnostics that are not
    // exposed by `message` or `customData.serverResponse` on every SDK version.
    let rendered = "";
    try {
        rendered = String(error || "");
    } catch {
        // Ignore unusual objects whose string conversion throws.
    }
    return `${storageErrorMessage(error)}\n${storageErrorServerResponse(error)}\n${rendered}`;
}

function isGalleryAccessDenied(error: unknown): boolean {
    if (storageErrorCode(error) === "storage/unauthorized") return true;
    // The Storage emulator can surface a denied exact-path list as
    // storage/unknown/rules-evaluation text. Treat only list-denial signatures as
    // an unavailable gallery; unrelated Storage failures must still surface.
    const details = storageErrorDetails(error);
    return details.includes("for 'list'") && (
        details.includes("evaluation error")
        || details.includes("false for 'list'")
        || details.includes("Property eventId is undefined")
    );
}

function isStorageEmulatorUnknownList(error: unknown): boolean {
    return Boolean(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST?.trim())
        && storageErrorCode(error) === "storage/unknown";
}

async function loadCandidateEvents(sections: string[]): Promise<CandidateEvent[]> {
    const uniqueSections = [...new Set(sections.map((section) => section.trim()).filter(Boolean))].slice(0, 10);
    if (uniqueSections.length === 0) return [];

    const snapshot = await getDocs(query(collection(db, "publicEvents"), where("section", "in", uniqueSections)));
    return snapshot.docs
        .map((item) => {
            const data = item.data() as Record<string, unknown>;
            const candidate: CandidateEvent = {
                eventId: item.id,
                title: stringValue(data, "title"),
                description: stringValue(data, "description"),
                eventType: stringValue(data, "eventType"),
                section: stringValue(data, "section"),
                location: stringValue(data, "location"),
                startDate: stringValue(data, "startDate"),
                endDate: stringValue(data, "endDate"),
            };
            return candidate;
        })
        .filter((event) => event.title && event.section && event.startDate)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

async function loadAuthorizedPhotos(event: CandidateEvent): Promise<ParentGalleryPhoto[]> {
    const safeSection = safeStorageSegment(event.section, "Event gallery section");
    const safeEventId = safeStorageSegment(event.eventId, "Event gallery event id");
    const eventRef = ref(storage, `attachments/event-gallery/${safeSection}/${safeEventId}`);
    let result;
    try {
        result = await listAll(eventRef);
    } catch (error) {
        // Firebase Storage Emulator can report a rules-denied exact list as
        // storage/unknown without exposing the rules diagnostic on the error object.
        // Scope this compatibility path to the emulator and this list operation only;
        // production and metadata/blob failures continue to surface.
        if (isGalleryAccessDenied(error) || isStorageEmulatorUnknownList(error)) return [];
        throw error;
    }

    let files = result.items;
    if (result.prefixes.length > 0) {
        const nestedResults = await Promise.all(result.prefixes.map(async (prefix) => {
            try {
                return await listAll(prefix);
            } catch (error) {
                // listAll(eventRef) may return attachment prefixes before the Storage
                // emulator applies the exact parent event rule to the nested list.
                // A denied nested list is the same fail-closed outcome as a denied
                // initial list, but keep this exception scoped to emulator list calls.
                if (isGalleryAccessDenied(error) || isStorageEmulatorUnknownList(error)) return null;
                throw error;
            }
        }));
        if (nestedResults.some((nested) => nested === null)) return [];
        files = nestedResults.flatMap((nested) => nested?.items || []);
    }

    const photos: ParentGalleryPhoto[] = [];

    try {
        for (const item of files) {
            const metadata = await getMetadata(item);
            if (
                metadata.customMetadata?.ownerType !== "event-gallery" ||
                metadata.customMetadata?.ownerId !== event.eventId ||
                metadata.customMetadata?.section !== event.section
            ) continue;

            const blob = await getBlob(item);
            const pathParts = item.fullPath.split("/");
            photos.push({
                id: pathParts.at(-2) || item.fullPath,
                path: item.fullPath,
                fileName: metadata.customMetadata.originalFileName || item.name,
                contentType: metadata.contentType || blob.type,
                size: metadata.size,
                objectUrl: URL.createObjectURL(blob),
            });
        }
        return photos;
    } catch (error) {
        photos.forEach((photo) => URL.revokeObjectURL(photo.objectUrl));
        throw error;
    }
}

export async function loadParentEventGalleries(sections: string[]): Promise<ParentEventGallery[]> {
    if (!auth.currentUser) throw new Error("You must be signed in to view event galleries.");
    const candidates = await loadCandidateEvents(sections);
    const galleries: ParentEventGallery[] = [];

    try {
        for (const event of candidates) {
            try {
                const photos = await loadAuthorizedPhotos(event);
                if (photos.length > 0) galleries.push({ ...event, photos });
            } catch (error) {
                if (isGalleryAccessDenied(error)) continue;
                throw error;
            }
        }
        return galleries;
    } catch (error) {
        revokeParentEventGalleryUrls(galleries);
        throw error;
    }
}

export function revokeParentEventGalleryUrls(galleries: ParentEventGallery[]): void {
    galleries.forEach((gallery) => gallery.photos.forEach((photo) => URL.revokeObjectURL(photo.objectUrl)));
}