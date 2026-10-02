export type MedicationAuthorisationDates = {
    authFrom: string;
    authTo: string;
};

function localCalendarDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function medicationAuthorisationDefaults(now = new Date()): MedicationAuthorisationDates {
    return {
        authFrom: localCalendarDate(now),
        authTo: `${now.getFullYear() + 1}-08-31`
    };
}
