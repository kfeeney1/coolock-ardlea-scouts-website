import { collection, getDocs, query, where } from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
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

function firebaseErrorCode(error: unknown): string {
    if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
        return (error as { code: string }).code;
    }
    return "";
}

function isFirestorePermissionDenied(error: unknown): boolean {
    const code = firebaseErrorCode(error);
    return code === "permission-denied" || code === "firestore/permission-denied";
}

function storageErrorCode(error: unknown): string {
    return firebaseErrorCode(error);
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
    const details = storageErrorDetails(error);
    return details.includes("for 'list'") && (
        details.includes("evaluation error")
        || details.includes("false for 'list'")
        || details.includes("Property eventId is undefined")
        || details.includes("Null value error")
    );
}

function isStorageEmulatorListFailure(): boolean {
    if (import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST?.trim()) return true;
    if (typeof window === "undefined") return false;
    return ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
}

function mapCandidate(item: QueryDocumentSnapshot<DocumentData>): CandidateEvent | null {
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
    return candidate.title && candidate.section && candidate.startDate ? candidate : null;
}

async function loadProjectionCandidates(collectionName: "parentGalleryEvents" | "publicEvents", sections: string[]): Promise<CandidateEvent[]> {
    try {
        const snapshot = await getDocs(query(collection(db, collectionName), where("section", "in", sections)));
        return snapshot.docs.map(mapCandidate).filter((event): event is CandidateEvent => event !== null);
    } catch (error) {
        // A staged rules rollout can briefly leave the retained parent projection
        // unreadable while the already-public candidate projection remains valid.
        if (isFirestorePermissionDenied(error) && collectionName === "parentGalleryEvents") return [];
        throw error;
    }
}

async function loadCandidateEvents(sections: string[]): Promise<CandidateEvent[]> {
    const uniqueSections = [...new Set(sections.map((section) => section.trim()).filter(Boolean))].slice(0, 10);
    if (uniqueSections.length === 0) return [];

    const [retained, currentPublic] = await Promise.all([
        loadProjectionCandidates("parentGalleryEvents", uniqueSections),
        loadProjectionCandidates("publicEvents", uniqueSections),
    ]);

    const candidates = new Map<string, CandidateEvent>();
    currentPublic.forEach((event) => candidates.set(event.eventId, event));
    retained.forEach((event) => candidates.set(event.eventId, event));
    return [...candidates.values()].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

async function loadAuthorizedPhotos(event: CandidateEvent): Promise<ParentGalleryPhoto[]> {
    const safeSection = safeStorageSegment(event.section, "Event gallery section");
    const safeEventId = safeStorageSegment(event.eventId, "Event gallery event id");
    const eventRef = ref(storage, `attachments/event-gallery/${safeSection}/${safeEventId}`);
    let result;
    try {
        result = await listAll(eventRef);
    } catch (error) {
        if (isGalleryAccessDenied(error) || isStorageEmulatorListFailure()) return [];
        throw error;
    }

    let files = result.items;
    if (result.prefixes.length > 0) {
        const nestedResults = await Promise.all(result.prefixes.map(async (prefix) => {
            try {
                return await listAll(prefix);
            } catch (error) {
                if (isGalleryAccessDenied(error) || isStorageEmulatorListFailure()) return null;
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
