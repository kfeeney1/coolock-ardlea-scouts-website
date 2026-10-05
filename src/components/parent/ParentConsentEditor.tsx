import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import MedicationManagementForm, { validateMedication } from "../consent/MedicationManagementForm";
import YesNoField from "../consent/YesNoField";
import type { ParentConsentRecord } from "../../services/parentConsent";
import { updateParentConsent, validateParentConsentRecord } from "../../services/parentConsent";
import type { MedicationManagementData } from "../../services/consentApplications";
import { focusFirstInvalidFieldAfterRender } from "../../services/formValidationFocus";
import { sanitizePhoneInput } from "../../services/phoneInput";

type Props = { consent: ParentConsentRecord; onSaved: () => Promise<void> | void };
type ConsentErrors = ReturnType<typeof validateParentConsentRecord>;
const PHONE_FIELDS = new Set<keyof ParentConsentRecord>(["gpTel", "mobile1", "mobile2", "homePhone", "workPhone", "altContactPhone"]);

export default function ParentConsentEditor({ consent, onSaved }: Props) {
    const [form, setForm] = useState(consent);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [validationErrors, setValidationErrors] = useState<ConsentErrors>({});
    const [medicationErrors, setMedicationErrors] = useState<Partial<Record<keyof MedicationManagementData, string>>>({});
    const editorRef = useRef<HTMLDivElement | null>(null);

    const set = (key: keyof ParentConsentRecord, value: string) => {
        const next = PHONE_FIELDS.has(key) ? sanitizePhoneInput(value) : value;
        setForm((current) => ({ ...current, [key]: next }));
        setValidationErrors((current) => ({ ...current, [key]: undefined }));
    };

    const save = async () => {
        setMessage(""); setError("");
        const validation = validateParentConsentRecord(form);
        const medicationValidation = validateMedication(form.medicationManagement, "youth");
        setValidationErrors(validation); setMedicationErrors(medicationValidation);
        if (Object.values(validation).some(Boolean) || Object.values(medicationValidation).some(Boolean)) {
            setError("Please correct the highlighted fields before saving.");
            focusFirstInvalidFieldAfterRender(editorRef.current ?? document);
            return;
        }
        setSaving(true);
        try {
            await updateParentConsent(consent.id, form);
            setMessage("Consent and medical details updated successfully.");
            await onSaved();
        } catch (saveError) {
            setError(applicationErrorMessage(saveError, "Unable to save the consent and medical details.", "ParentConsentEditor"));
        } finally { setSaving(false); }
    };

    const field = (key: keyof ParentConsentRecord, label: string, extra: Record<string, unknown> = {}) => (
        <TextField label={label} value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value)}
            error={Boolean(validationErrors[key as keyof ConsentErrors])} helperText={validationErrors[key as keyof ConsentErrors]} {...extra} />
    );
    const phoneField = (key: keyof ParentConsentRecord, label: string) => field(key, label, {
        type: "tel", inputMode: "tel", slotProps: { htmlInput: { inputMode: "tel", autoComplete: "tel" } }
    });
    const yesNoField = (label: string, key: keyof ParentConsentRecord) => (
        <Box data-testid={`parent-consent-select-${String(key)}`} data-validation-invalid={validationErrors[key as keyof ConsentErrors] ? "true" : undefined}>
            <YesNoField label={label} value={form[key] === "Yes" || form[key] === "No" ? form[key] : ""}
                error={validationErrors[key as keyof ConsentErrors]} onChange={(value) => set(key, value)} />
        </Box>
    );

    return <Paper ref={editorRef} variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{form.childName}</Typography>
        <Typography color="text.secondary">{form.scoutSection} · DOB {form.childDOB || "not recorded"}</Typography>
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Typography variant="h6" sx={{ mt: 3, mb: 1.5 }}>Consent period</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            {field("consentFrom", "Consent from", { type: "date", slotProps: { inputLabel: { shrink: true } } })}
            {field("consentTo", "Consent to", { type: "date", slotProps: { inputLabel: { shrink: true } } })}
            {yesNoField("Photo consent", "photoConsent")}{yesNoField("Water activities", "waterActivities")}{yesNoField("Can swim", "canSwim")}
        </Box>

        <Divider sx={{ my: 3 }} /><Typography variant="h6" sx={{ mb: 1.5 }}>Medical information</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            {yesNoField("Serious illness / condition", "seriousIllness")}{yesNoField("Regular medication", "regularMeds")}
            {yesNoField("Medication allergies", "medAllergies")}{yesNoField("Other allergies", "allergies")}
            {yesNoField("Dietary requirements", "dietaryReqs")}{yesNoField("Vaccinations up to date", "vaccinated")}
        </Box>
        <TextField fullWidth multiline minRows={3} required={["seriousIllness","regularMeds","medAllergies","allergies","dietaryReqs"].some((key) => form[key as keyof ParentConsentRecord] === "Yes")}
            label="Medical details / further information" value={form.medicalFurtherInfo} onChange={(e) => set("medicalFurtherInfo", e.target.value)}
            error={Boolean(validationErrors.medicalFurtherInfo)} helperText={validationErrors.medicalFurtherInfo} sx={{ mt: 2 }} />
        <MedicationManagementForm mode="youth" value={form.medicationManagement} errors={medicationErrors}
            sharedIdentity={{ memberName: form.childName, dateOfBirth: form.childDOB, address: form.homeAddress }}
            onChange={(medicationManagement) => {
                setMedicationErrors({});
                setForm((current) => ({ ...current, gpName: current.gpName || medicationManagement.doctorName,
                    gpTel: current.gpTel || medicationManagement.doctorTel, medicationManagement }));
            }} />

        <Divider sx={{ my: 3 }} /><Typography variant="h6" sx={{ mb: 1.5 }}>GP details</Typography>
        <Stack spacing={2}>{field("gpName","GP name")}{phoneField("gpTel","GP telephone")}{field("gpAddress","GP address")}
            {field("lastCheckup","Last check-up",{type:"date",slotProps:{inputLabel:{shrink:true}}})}</Stack>

        <Divider sx={{ my: 3 }} /><Typography variant="h6" sx={{ mb: 1.5 }}>Parent & emergency contacts</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            {field("parent1Name","Parent / guardian 1")}{phoneField("mobile1","Parent / guardian 1 mobile")}
            {field("parent2Name","Parent / guardian 2")}{phoneField("mobile2","Parent / guardian 2 mobile")}
            {phoneField("homePhone","Home phone")}{phoneField("workPhone","Work phone")}{field("email","Email",{type:"email"})}
            {field("altContactName","Alternative emergency contact")}{phoneField("altContactPhone","Alternative contact phone")}
        </Box>
        <TextField fullWidth multiline minRows={2} label="Home address" value={form.homeAddress} onChange={(e) => set("homeAddress",e.target.value)}
            error={Boolean(validationErrors.homeAddress)} helperText={validationErrors.homeAddress} sx={{ mt: 2 }} />
        <TextField fullWidth multiline minRows={2} label="Additional information" value={form.additionalInfo} onChange={(e) => set("additionalInfo",e.target.value)} sx={{ mt: 2 }} />
        <Alert severity="info" sx={{ mt: 3 }}>Your child’s name, date of birth, section, record status and internal leader fields cannot be changed from the Parent Portal.</Alert>
        <Button variant="contained" color="success" disabled={saving} onClick={() => void save()} sx={{ mt: 2 }}>{saving ? "Saving…" : "Save Consent & Medical Details"}</Button>
    </Paper>;
}
