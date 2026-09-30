import {
    Alert,
    Box,
    Button,
    Divider,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";

import MedicationManagementForm, { validateMedication } from "../consent/MedicationManagementForm";
import YesNoField from "../consent/YesNoField";

import type { ParentConsentRecord } from "../../services/parentConsent";
import { updateParentConsent, validateParentConsentRecord } from "../../services/parentConsent";
import type { MedicationManagementData } from "../../services/consentApplications";

type Props = {
    consent: ParentConsentRecord;
    onSaved: () => Promise<void> | void;
};


export default function ParentConsentEditor({ consent, onSaved }: Props) {
    const [form, setForm] = useState(consent);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [medicationErrors, setMedicationErrors] = useState<Partial<Record<keyof MedicationManagementData, string>>>({});

    const set = (key: keyof ParentConsentRecord, value: string) =>
        setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        setMessage("");
        setError("");
        const validation = validateParentConsentRecord(form);
        const medicationValidation = validateMedication(form.medicationManagement, "youth");
        setMedicationErrors(medicationValidation);
        const firstError = Object.values(validation).find(Boolean) || Object.values(medicationValidation).find(Boolean);
        if (firstError) {
            setError(String(firstError));
            return;
        }
        setSaving(true);
        try {
            await updateParentConsent(consent.id, form);
            setMessage("Consent and medical details updated successfully.");
            await onSaved();
        } catch (saveError) {
            console.error("Unable to update parent consent:", saveError);
            setError("Unable to save the consent and medical details.");
        } finally {
            setSaving(false);
        }
    };

    const yesNoField = (label: string, key: keyof ParentConsentRecord) => (
        <Box data-testid={`parent-consent-select-${String(key)}`}>
            <YesNoField
                label={label}
                value={form[key] === "Yes" || form[key] === "No" ? form[key] : ""}
                onChange={(value) => set(key, value)}
            />
        </Box>
    );

    return (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
                {form.childName}
            </Typography>
            <Typography color="text.secondary">
                {form.scoutSection} · DOB {form.childDOB || "not recorded"}
            </Typography>

            {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Typography variant="h6" sx={{ mt: 3, mb: 1.5 }}>Consent period</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <TextField label="Consent from" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.consentFrom} onChange={(e) => set("consentFrom", e.target.value)} />
                <TextField label="Consent to" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.consentTo} onChange={(e) => set("consentTo", e.target.value)} />
                {yesNoField("Photo consent", "photoConsent")}
                {yesNoField("Water activities", "waterActivities")}
                {yesNoField("Can swim", "canSwim")}
            </Box>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 1.5 }}>Medical information</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {yesNoField("Serious illness / condition", "seriousIllness")}
                {yesNoField("Regular medication", "regularMeds")}
                {yesNoField("Medication allergies", "medAllergies")}
                {yesNoField("Other allergies", "allergies")}
                {yesNoField("Dietary requirements", "dietaryReqs")}
                {yesNoField("Vaccinations up to date", "vaccinated")}
            </Box>
            <TextField
                fullWidth
                multiline
                minRows={3}
                required={["seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"].some((key) => form[key as keyof ParentConsentRecord] === "Yes")}
                label="Medical details / further information"
                value={form.medicalFurtherInfo}
                onChange={(e) => set("medicalFurtherInfo", e.target.value)}
                error={Boolean(validateParentConsentRecord(form).medicalFurtherInfo)}
                helperText={validateParentConsentRecord(form).medicalFurtherInfo}
                sx={{ mt: 2 }}
            />
            <MedicationManagementForm
                mode="youth"
                value={form.medicationManagement}
                errors={medicationErrors}
                sharedIdentity={{ memberName: form.childName, dateOfBirth: form.childDOB, address: form.homeAddress }}
                onChange={(medicationManagement) => setForm((current) => ({ ...current, medicationManagement }))}
            />

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 1.5 }}>GP details</Typography>
            <Stack spacing={2}>
                <TextField label="GP name" value={form.gpName} onChange={(e) => set("gpName", e.target.value)} />
                <TextField label="GP telephone" value={form.gpTel} onChange={(e) => set("gpTel", e.target.value)} />
                <TextField label="GP address" value={form.gpAddress} onChange={(e) => set("gpAddress", e.target.value)} />
                <TextField label="Last check-up" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.lastCheckup} onChange={(e) => set("lastCheckup", e.target.value)} />
            </Stack>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 1.5 }}>Parent & emergency contacts</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <TextField label="Parent / guardian 1" value={form.parent1Name} onChange={(e) => set("parent1Name", e.target.value)} />
                <TextField label="Parent / guardian 2" value={form.parent2Name} onChange={(e) => set("parent2Name", e.target.value)} />
                <TextField label="Mobile" value={form.mobile1} onChange={(e) => set("mobile1", e.target.value)} />
                <TextField label="Home phone" value={form.homePhone} onChange={(e) => set("homePhone", e.target.value)} />
                <TextField label="Work phone" value={form.workPhone} onChange={(e) => set("workPhone", e.target.value)} />
                <TextField label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                <TextField label="Alternative emergency contact" value={form.altContactName} onChange={(e) => set("altContactName", e.target.value)} />
                <TextField label="Alternative contact phone" value={form.altContactPhone} onChange={(e) => set("altContactPhone", e.target.value)} />
            </Box>
            <TextField fullWidth multiline minRows={2} label="Home address" value={form.homeAddress} onChange={(e) => set("homeAddress", e.target.value)} sx={{ mt: 2 }} />
            <TextField fullWidth multiline minRows={2} label="Additional information" value={form.additionalInfo} onChange={(e) => set("additionalInfo", e.target.value)} sx={{ mt: 2 }} />

            <Alert severity="info" sx={{ mt: 3 }}>
                Your child’s name, date of birth, section, record status and internal leader fields cannot be changed from the Parent Portal.
            </Alert>

            <Button variant="contained" color="success" disabled={saving} onClick={() => void save()} sx={{ mt: 2 }}>
                {saving ? "Saving…" : "Save Consent & Medical Details"}
            </Button>
        </Paper>
    );
}
