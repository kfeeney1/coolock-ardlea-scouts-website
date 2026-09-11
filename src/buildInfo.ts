declare const __BUILD_NUMBER__: string;

export const BUILD_NUMBER = __BUILD_NUMBER__;
export const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT?.trim() || "local";
export const SHORT_BUILD_COMMIT = BUILD_COMMIT === "local" ? "local" : BUILD_COMMIT.slice(0, 7);
