export const PHONE_PATTERN = /^[\d\s+\-()]{7,20}$/;
export function sanitizePhoneInput(value: string): string {
    const cleaned = value.replace(/[^\d\s+\-()]/g, "");
    const firstPlus = cleaned.indexOf("+");
    return cleaned.split("").filter((char, index) => char !== "+" || index === firstPlus).join("").slice(0, 40);
}
export function isValidPhone(value: string): boolean { return PHONE_PATTERN.test(value.trim()); }
