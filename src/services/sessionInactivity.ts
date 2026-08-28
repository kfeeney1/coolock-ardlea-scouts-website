import type { SessionSettings } from "./siteSettings";

export const SESSION_LAST_ACTIVITY_KEY = "scout-session-last-activity";

export function isPhoneDevice(userAgent: string, mobileHint?: boolean): boolean {
    if (mobileHint === true) return true;
    return /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile/i.test(userAgent);
}

export function sessionInactivityTimeoutMs(
    accountType: "parent" | "leader",
    settings: SessionSettings,
    userAgent: string,
    mobileHint?: boolean
): number {
    const minutes = accountType === "parent"
        ? settings.parentInactivityMinutes
        : isPhoneDevice(userAgent, mobileHint)
            ? settings.leaderPhoneInactivityMinutes
            : settings.leaderDesktopInactivityMinutes;
    return minutes * 60 * 1000;
}

export function remainingInactivityMs(lastActivity: number, now: number, timeoutMs: number): number {
    return Math.max(0, timeoutMs - Math.max(0, now - lastActivity));
}
