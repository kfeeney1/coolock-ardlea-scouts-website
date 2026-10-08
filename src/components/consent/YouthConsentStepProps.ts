import type { ChangeEvent } from "react";
import type {
    MedicationManagementData,
    YesNo,
    YouthConsentData
} from "../../services/consentApplications";

type YouthConsentErrors = Partial<Record<keyof YouthConsentData, string>>;
type MedicationErrors = Partial<Record<keyof MedicationManagementData, string>>;

export type YouthConsentStepProps = {
    formData: YouthConsentData;
    errors: YouthConsentErrors;
    medicationErrors: MedicationErrors;
    onTextChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onYesNoChange: (field: keyof YouthConsentData, value: YesNo) => void;
    onDeclarationConfirmed: (confirmed: boolean) => void;
    onMedicationChange: (medication: MedicationManagementData) => void;
};
