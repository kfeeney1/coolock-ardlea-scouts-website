import {
    Alert,
    Box,
    Button,
    Divider,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";

import type { ParentConsentRecord } from "../../services/parentConsent";
import { updateParentConsent } from "../../services/parentConsent";

type Props = {
    consent: ParentConsentRecord;
    onSaved: () => Promise<void> | void;
};

const yesNo = ["", "Yes", "No"];

export default function ParentConsentEditor({ consent, onSaved }: Props) {
    const [form, setForm] = useState(consent);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const set = (key: keyof ParentConsentRecord, value: string) =>
        setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        setSaving(true);
        setMessage("");
        setError("");
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
        <TextField
            select
            label={label}
            value={String(form[key] ?? "")}
            onChange={(event) => set(key, event.target.value)}
            fullWidth
        >
            {yesNo.map((value) => (
                <MenuItem key={value || "blank"} value={value}>
                    {value || "Not answered"}
                </MenuItem>
            ))}
        </TextField>
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
                <TextField label="Consent from" type="date" InputLabelProps={{ shrink: true }} value={form.consentFrom} onChange={(e) => set("consentFrom", e.target.value)} />
                <TextField label="Consent to" type="date" InputLabelProps={{ shrink: true }} value={form.consentTo} onChange={(e) => set("consentTo", e.target.value)} />
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
                label="Medical details / further information"
                value={form.medicalFurtherInfo}
                onChange={(e) => set("medicalFurtherInfo", e.target.value)}
                sx={{ mt: 2 }}
            />

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 1.5 }}>GP details</Typography>
            <Stack spacing={2}>
                <TextField label="GP name" value={form.gpName} onChange={(e) => set("gpName", e.target.value)} />
                <TextField label="GP telephone" value={form.gpTel} onChange={(e) => set("gpTel", e.target.value)} />
                <TextField label="GP address" value={form.gpAddress} onChange={(e) => set("gpAddress", e.target.value)} />
                <TextField label="Last check-up" type="date" InputLabelProps={{ shrink: true }} value={form.lastCheckup} onChange={(e) => set("lastCheckup", e.target.value)} />
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
