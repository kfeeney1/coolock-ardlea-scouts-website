export const DESKTOP_INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
export const PHONE_INACTIVITY_TIMEOUT_MS = 90 * 60 * 1000;

export const SESSION_LAST_ACTIVITY_KEY = "scout-session-last-activity";

export function isPhoneDevice(userAgent: string, mobileHint?: boolean): boolean {
    if (mobileHint === true) return true;
    return /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile/i.test(userAgent);
}

export function sessionInactivityTimeoutMs(userAgent: string, mobileHint?: boolean): number {
    return isPhoneDevice(userAgent, mobileHint)
        ? PHONE_INACTIVITY_TIMEOUT_MS
        : DESKTOP_INACTIVITY_TIMEOUT_MS;
}

export function remainingInactivityMs(lastActivity: number, now: number, timeoutMs: number): number {
    return Math.max(0, timeoutMs - Math.max(0, now - lastActivity));
}
