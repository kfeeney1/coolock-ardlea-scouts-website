export const DEFAULT_PARENT_LOGIN_ENABLED = true;
export const DEFAULT_PARENT_CONSENT_ENABLED = false;

/** Leader pages provide the Parent Portal through their own context navigation. */
export function shouldShowHeaderParentPortal(
    authenticated: boolean,
    authenticationLoading: boolean,
    pathname: string
): boolean {
    return authenticated && !authenticationLoading
        && pathname !== "/leader" && !pathname.startsWith("/leader/");
}

export function normaliseParentLoginEnabled(
    data: Record<string, unknown> | null | undefined,
    documentExists = data !== null && data !== undefined
): boolean {
    if (!documentExists) return DEFAULT_PARENT_LOGIN_ENABLED;
    return typeof data?.parentLoginEnabled === "boolean" ? data.parentLoginEnabled : false;
}

export function normaliseParentConsentEnabled(data: Record<string, unknown> | null | undefined): boolean {
    return typeof data?.parentConsentEnabled === "boolean"
        ? data.parentConsentEnabled
        : DEFAULT_PARENT_CONSENT_ENABLED;
}

export function shouldShowPublicParentLogin(
    enabled: boolean | null,
    authenticated: boolean,
    authenticationLoading: boolean
): boolean {
    return enabled === true && !authenticated && !authenticationLoading;
}
