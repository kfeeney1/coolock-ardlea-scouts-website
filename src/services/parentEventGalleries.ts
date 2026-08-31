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
    return error instanceof Error ? error.message : String(error || "");
}

function isGalleryAccessDenied(error: unknown): boolean {
    if (storageErrorCode(error) === "storage/unauthorized") return true;
    const message = storageErrorMessage(error);
    return message.includes("for 'list'") && (
        message.includes("evaluation error")
        || message.includes("false for 'list'")
        || message.includes("Property eventId is undefined")
    );
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
    const result = await listAll(eventRef);
    const files = result.prefixes.length > 0
        ? (await Promise.all(result.prefixes.map((prefix) => listAll(prefix)))).flatMap((nested) => nested.items)
        : result.items;
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
