export function isConsentExpired(consentTo: string): boolean {
    if (!consentTo) return false;
    const today = new Date().toISOString().slice(0, 10);
    return consentTo < today;
}

export function daysUntilExpiry(consentTo: string): number | null {
    if (!consentTo) return null;
    const end = new Date(`${consentTo}T00:00:00`);
    if (Number.isNaN(end.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}
