export const DEFAULT_PARENT_LOGIN_ENABLED = true;

export function normaliseParentLoginEnabled(
    data: Record<string, unknown> | null | undefined,
    documentExists = data !== null && data !== undefined
): boolean {
    if (!documentExists) return DEFAULT_PARENT_LOGIN_ENABLED;
    return typeof data?.parentLoginEnabled === "boolean" ? data.parentLoginEnabled : false;
}

export function shouldShowPublicParentLogin(
    enabled: boolean | null,
    authenticated: boolean,
    authenticationLoading: boolean
): boolean {
    return enabled === true && !authenticated && !authenticationLoading;
}
