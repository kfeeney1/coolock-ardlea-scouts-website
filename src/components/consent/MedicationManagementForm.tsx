import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

import YesNoField from "./YesNoField";
import type { MedicationEntry, MedicationManagementData, YesNo } from "../../services/consentApplications";

type Errors = Partial<Record<keyof MedicationManagementData, string>>;
type SharedIdentity = { memberName?: string; dateOfBirth?: string; address?: string };

type Props = {
    mode: "youth" | "scouter";
    value: MedicationManagementData;
    errors: Errors;
    onChange: (next: MedicationManagementData) => void;
    sharedIdentity?: SharedIdentity;
};

export function createMedicationEntry(today = "", july31 = ""): MedicationEntry {
    return { medicineName: "", dosage: "", frequency: "", quantitySupplied: "", method: "", otherInfo: "", selfAdmin: "", authFrom: today, authTo: july31 };
}

export function createMedicationData(today: string, july31: string): MedicationManagementData {
    const entry = createMedicationEntry(today, july31);
    return {
        enabled: false, medications: [entry], memberName: "", dateOfBirth: "", address: "",
        medicineName: "", dosage: "", frequency: "", quantitySupplied: "", doctorName: "", doctorTel: "",
        pharmacyName: "", pharmacyTel: "", method: "", otherInfo: "", selfAdmin: "", authFrom: today,
        authTo: july31, scouter1: "", scouter2: "", signature: "", signatureDate: today
    };
}

export function medicationEntries(data: MedicationManagementData): MedicationEntry[] {
    if (Array.isArray(data.medications) && data.medications.length > 0) {
        return data.medications.map((entry) => ({ ...createMedicationEntry(), ...entry }));
    }
    return [{
        medicineName: data.medicineName || "", dosage: data.dosage || "", frequency: data.frequency || "",
        quantitySupplied: data.quantitySupplied || "", method: data.method || "", otherInfo: data.otherInfo || "",
        selfAdmin: data.selfAdmin || "", authFrom: data.authFrom || "", authTo: data.authTo || ""
    }];
}

function withEntries(data: MedicationManagementData, entries: MedicationEntry[]): MedicationManagementData {
    const first = entries[0] ?? createMedicationEntry();
    return {
        ...data, medications: entries,
        medicineName: first.medicineName, dosage: first.dosage, frequency: first.frequency,
        quantitySupplied: first.quantitySupplied, method: first.method, otherInfo: first.otherInfo,
        selfAdmin: first.selfAdmin, authFrom: first.authFrom, authTo: first.authTo
    };
}

export function hydrateMedicationIdentity(data: MedicationManagementData, identity?: SharedIdentity): MedicationManagementData {
    if (!identity) return data;
    return {
        ...data,
        memberName: identity.memberName?.trim() || data.memberName,
        dateOfBirth: identity.dateOfBirth?.trim() || data.dateOfBirth,
        address: identity.address?.trim() || data.address
    };
}

export function validateMedication(data: MedicationManagementData, mode: "youth" | "scouter"): Errors {
    const errors: Errors = {};
    if (!data.enabled) return errors;
    if (!data.memberName.trim()) errors.memberName = "Name is required.";
    if (!data.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
    if (!data.address.trim()) errors.address = "Address is required.";

    medicationEntries(data).forEach((entry, index) => {
        const prefix = medicationEntries(data).length > 1 ? `Medication ${index + 1}: ` : "";
        if (!entry.medicineName.trim() && !errors.medicineName) errors.medicineName = `${prefix}Medicine name is required.`;
        if (!entry.dosage.trim() && !errors.dosage) errors.dosage = `${prefix}Dosage is required.`;
        if (!entry.frequency.trim() && !errors.frequency) errors.frequency = `${prefix}Frequency is required.`;
        if (!entry.selfAdmin && !errors.selfAdmin) errors.selfAdmin = `${prefix}Select Yes or No for self-administration.`;
        if (mode === "youth" && !entry.authFrom && !errors.authFrom) errors.authFrom = `${prefix}Authorised from date is required.`;
        if (mode === "youth" && !entry.authTo && !errors.authTo) errors.authTo = `${prefix}Authorised until date is required.`;
    });
    if (!data.signature.trim()) errors.signature = "Signature is required.";
    if (!data.signatureDate) errors.signatureDate = "Signature date is required.";
    return errors;
}

export default function MedicationManagementForm({ mode, value, errors, onChange, sharedIdentity }: Props) {
    const entries = medicationEntries(value);
    const update = <K extends keyof MedicationManagementData>(field: K, nextValue: MedicationManagementData[K]) => onChange({ ...value, [field]: nextValue });
    const textChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(event.target.name as keyof MedicationManagementData, event.target.value as never);
    const updateEntry = <K extends keyof MedicationEntry>(index: number, field: K, nextValue: MedicationEntry[K]) => {
        const next = entries.map((entry, i) => i === index ? { ...entry, [field]: nextValue } : entry);
        onChange(withEntries(value, next));
    };
    const addMedication = () => {
        const previous = entries.at(-1) ?? createMedicationEntry();
        onChange(withEntries(value, [...entries, createMedicationEntry(previous.authFrom, previous.authTo)]));
    };
    const removeMedication = (index: number) => onChange(withEntries(value, entries.filter((_, i) => i !== index)));

    return <Box sx={{ mt: 4 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <FormControlLabel control={<Checkbox color="success" checked={value.enabled} onChange={(event) => onChange(event.target.checked ? hydrateMedicationIdentity({ ...value, enabled: true }, sharedIdentity) : { ...value, enabled: false })} />}
                label={<Box><Typography sx={{ fontWeight: 700 }}>This member requires medication management</Typography><Typography variant="body2" color="text.secondary">SIF 20/10</Typography></Box>} />
        </Paper>
        {value.enabled && <Box sx={{ mt: 3 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>{mode === "youth" ? "It is the responsibility of parents or guardians to provide full and accurate information about the child's medication requirements." : "Provide the medication information below for emergency reference and medication management."}</Alert>
            <Typography variant="h5" color="secondary" sx={{ mb: 2 }}>{mode === "youth" ? "Child's Information" : "Scouter's Information"}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                <TextField required label={mode === "youth" ? "Child's name" : "Scouter's name"} name="memberName" value={value.memberName} onChange={textChange} error={Boolean(errors.memberName)} helperText={errors.memberName} />
                <TextField required type="date" label="Date of birth" name="dateOfBirth" value={value.dateOfBirth} onChange={textChange} error={Boolean(errors.dateOfBirth)} helperText={errors.dateOfBirth} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField required label={mode === "youth" ? "Child's address" : "Scouter's address"} name="address" value={value.address} onChange={textChange} error={Boolean(errors.address)} helperText={errors.address} sx={{ gridColumn: { sm: "1 / -1" } }} />
            </Box>

            <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2 }}>Medication Information</Typography>
            <Stack spacing={2.5}>
                {entries.map((entry, index) => <Paper key={index} variant="outlined" data-testid={`medication-entry-${index}`} sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                        <Typography variant="h6">Medication {index + 1}</Typography>
                        {entries.length > 1 && <Button color="error" onClick={() => removeMedication(index)} aria-label={`Remove medication ${index + 1}`}>Remove</Button>}
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                        <TextField required label="Name of medicine" value={entry.medicineName} onChange={(e) => updateEntry(index, "medicineName", e.target.value)} error={Boolean(errors.medicineName && !entry.medicineName)} sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <TextField required label="Dosage to be taken" value={entry.dosage} onChange={(e) => updateEntry(index, "dosage", e.target.value)} error={Boolean(errors.dosage && !entry.dosage)} />
                        <TextField required label="Frequency of dosage" value={entry.frequency} onChange={(e) => updateEntry(index, "frequency", e.target.value)} error={Boolean(errors.frequency && !entry.frequency)} />
                        <TextField label="Quantity supplied" value={entry.quantitySupplied} onChange={(e) => updateEntry(index, "quantitySupplied", e.target.value)} />
                        <TextField label="Method of administration" value={entry.method} onChange={(e) => updateEntry(index, "method", e.target.value)} />
                        <TextField multiline minRows={2} label="Other relevant information" value={entry.otherInfo} onChange={(e) => updateEntry(index, "otherInfo", e.target.value)} sx={{ gridColumn: { sm: "1 / -1" } }} />
                    </Box>
                    <Box sx={{ mt: 2 }}><YesNoField label={mode === "youth" ? "Can your child self-administer this medication?" : "Can the Scouter self-administer this medication?"} value={entry.selfAdmin} error={!entry.selfAdmin ? errors.selfAdmin : undefined} onChange={(answer: YesNo) => updateEntry(index, "selfAdmin", answer)} /></Box>
                    {mode === "youth" && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mt: 2 }}>
                        <TextField required type="date" label="Authorised from" value={entry.authFrom} onChange={(e) => updateEntry(index, "authFrom", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField required type="date" label="Authorised until" value={entry.authTo} onChange={(e) => updateEntry(index, "authTo", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                    </Box>}
                </Paper>)}
            </Stack>
            <Button variant="outlined" onClick={addMedication} sx={{ mt: 2 }} data-testid="add-medication">Add Medication</Button>

            <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2 }}>Doctor & Pharmacy</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>These details are shared across all medications for this member.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                <TextField label="Prescribing doctor" name="doctorName" value={value.doctorName} onChange={textChange} />
                <TextField label="Doctor's telephone" name="doctorTel" value={value.doctorTel} onChange={textChange} />
                <TextField label="Dispensing pharmacy" name="pharmacyName" value={value.pharmacyName} onChange={textChange} />
                <TextField label="Pharmacy telephone" name="pharmacyTel" value={value.pharmacyTel} onChange={textChange} />
            </Box>

            <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2 }}>{mode === "youth" ? "Parent / Guardian Declaration" : "Self Declaration"}</Typography>
            <Alert severity="info">{mode === "youth" ? "I confirm that I have provided full and accurate medication information. I request and authorise the named Scouters to administer the medication described above." : "I confirm that the medical information above is correct and provide it for emergency reference purposes."}</Alert>
            {mode === "youth" && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mt: 3 }}>
                <TextField label="Scouter 1" name="scouter1" value={value.scouter1} onChange={textChange} />
                <TextField label="Scouter 2" name="scouter2" value={value.scouter2} onChange={textChange} />
            </Box>}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mt: 3 }}>
                <TextField required label={mode === "youth" ? "Signature of parent / guardian" : "Signature (full name)"} name="signature" value={value.signature} onChange={textChange} error={Boolean(errors.signature)} helperText={errors.signature ?? "Type the full name as the electronic signature."} />
                <TextField required type="date" label="Date" name="signatureDate" value={value.signatureDate} onChange={textChange} error={Boolean(errors.signatureDate)} helperText={errors.signatureDate} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
        </Box>}
    </Box>;
}
