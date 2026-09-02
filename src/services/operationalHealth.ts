export type OperationalHealthStatus = "healthy" | "warning" | "unavailable";

export type OperationalHealthItem = {
    id: "release" | "firestore" | "email" | "storage";
    label: string;
    status: OperationalHealthStatus;
    detail: string;
};

export type BuildInfoPayload = {
    commit?: unknown;
    buildTime?: unknown;
    source?: unknown;
};

const FIREBASE_PROJECT_ID = "coolock-ardlea-scouts";

export function buildReleaseHealth(payload: BuildInfoPayload | null): OperationalHealthItem {
    const commit = typeof payload?.commit === "string" ? payload.commit.trim() : "";
    const buildTime = typeof payload?.buildTime === "string" ? payload.buildTime.trim() : "";
    const source = typeof payload?.source === "string" ? payload.source.trim() : "";
    const buildTimeMs = Date.parse(buildTime);

    if (!commit || !Number.isFinite(buildTimeMs) || !["github-actions", "local"].includes(source)) {
        return { id: "release", label: "Deployed release", status: "warning", detail: "Build evidence is incomplete or invalid." };
    }

    return {
        id: "release",
        label: "Deployed release",
        status: source === "github-actions" ? "healthy" : "warning",
        detail: `${commit.slice(0, 12)} · ${buildTime} · ${source}`
    };
}

export function configuredCapabilityHealth({
    emailApiUrl,
    storageBucket
}: {
    emailApiUrl: string;
    storageBucket: string;
}): OperationalHealthItem[] {
    return [
        {
            id: "firestore",
            label: "Firestore",
            status: "healthy",
            detail: `Configured for project ${FIREBASE_PROJECT_ID}.`
        },
        {
            id: "email",
            label: "Email service",
            status: emailApiUrl.startsWith("https://") ? "healthy" : "unavailable",
            detail: emailApiUrl.startsWith("https://") ? "HTTPS endpoint configured." : "No valid HTTPS email endpoint is configured."
        },
        {
            id: "storage",
            label: "Attachment storage",
            status: storageBucket ? "warning" : "unavailable",
            detail: storageBucket ? "Firebase Storage bucket is configured; live availability remains deployment-controlled." : "No Firebase Storage bucket is configured."
        }
    ];
}

export async function loadOperationalHealth(): Promise<OperationalHealthItem[]> {
    let release: OperationalHealthItem;
    try {
        const response = await fetch(`/build-info.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`build-info returned ${response.status}`);
        release = buildReleaseHealth(await response.json() as BuildInfoPayload);
    } catch {
        release = { id: "release", label: "Deployed release", status: "unavailable", detail: "Unable to read deployed build evidence." };
    }

    return [
        release,
        ...configuredCapabilityHealth({
            emailApiUrl: String(import.meta.env.VITE_EMAIL_API_URL || "").trim(),
            storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim()
        })
    ];
}
