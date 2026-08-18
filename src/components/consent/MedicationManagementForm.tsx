import {
    Alert,
    Box,
    Checkbox,
    FormControlLabel,
    Paper,
    TextField,
    Typography
} from "@mui/material";

import type {
    ChangeEvent
} from "react";

import YesNoField from "./YesNoField";

import type {
    MedicationManagementData,
    YesNo
} from "../../services/consentApplications";

type Errors = Partial<
    Record<keyof MedicationManagementData, string>
>;

type Props = {
    mode: "youth" | "scouter";
    value: MedicationManagementData;
    errors: Errors;
    onChange: (
        next: MedicationManagementData
    ) => void;
};

export function createMedicationData(
    today: string,
    july31: string
): MedicationManagementData {
    return {
        enabled: false,
        memberName: "",
        dateOfBirth: "",
        address: "",
        medicineName: "",
        dosage: "",
        frequency: "",
        quantitySupplied: "",
        doctorName: "",
        doctorTel: "",
        pharmacyName: "",
        pharmacyTel: "",
        method: "",
        otherInfo: "",
        selfAdmin: "",
        authFrom: today,
        authTo: july31,
        scouter1: "",
        scouter2: "",
        signature: "",
        signatureDate: today
    };
}

export function validateMedication(
    data: MedicationManagementData,
    mode: "youth" | "scouter"
): Errors {
    const errors: Errors = {};

    if (!data.enabled) {
        return errors;
    }

    if (!data.memberName.trim()) {
        errors.memberName = "Name is required.";
    }

    if (!data.dateOfBirth) {
        errors.dateOfBirth =
            "Date of birth is required.";
    }

    if (!data.address.trim()) {
        errors.address = "Address is required.";
    }

    if (!data.medicineName.trim()) {
        errors.medicineName =
            "Medicine name is required.";
    }

    if (!data.dosage.trim()) {
        errors.dosage = "Dosage is required.";
    }

    if (!data.frequency.trim()) {
        errors.frequency = "Frequency is required.";
    }

    if (!data.selfAdmin) {
        errors.selfAdmin = "Select Yes or No.";
    }

    if (mode === "youth") {
        if (!data.authFrom) {
            errors.authFrom =
                "Authorised from date is required.";
        }

        if (!data.authTo) {
            errors.authTo =
                "Authorised until date is required.";
        }
    }

    if (!data.signature.trim()) {
        errors.signature = "Signature is required.";
    }

    if (!data.signatureDate) {
        errors.signatureDate =
            "Signature date is required.";
    }

    return errors;
}

export default function MedicationManagementForm({
    mode,
    value,
    errors,
    onChange
}: Props) {
    const update = <
        K extends keyof MedicationManagementData
    >(
        field: K,
        nextValue: MedicationManagementData[K]
    ) => {
        onChange({
            ...value,
            [field]: nextValue
        });
    };

    const textChange = (
        event: ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement
        >
    ) => {
        const field =
            event.target
                .name as keyof MedicationManagementData;

        update(
            field,
            event.target.value as never
        );
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Paper
                variant="outlined"
                sx={{
                    p: {
                        xs: 2.5,
                        md: 3
                    }
                }}
            >
                <FormControlLabel
                    control={
                        <Checkbox
                            color="success"
                            checked={value.enabled}
                            onChange={(event) =>
                                update(
                                    "enabled",
                                    event.target.checked
                                )
                            }
                        />
                    }
                    label={
                        <Box>
                            <Typography
                                sx={{
                                    fontWeight: 700
                                }}
                            >
                                This member requires medication
                                management
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                SIF 20/10
                            </Typography>
                        </Box>
                    }
                />
            </Paper>

            {value.enabled && (
                <Box sx={{ mt: 3 }}>
                    <Alert
                        severity="warning"
                        sx={{ mb: 3 }}
                    >
                        {mode === "youth"
                            ? "It is the responsibility of parents or guardians to provide full and accurate information about the child's medication requirements."
                            : "Provide the medication information below for emergency reference and medication management."}
                    </Alert>

                    <Typography
                        variant="h5"
                        color="secondary"
                        sx={{ mb: 2 }}
                    >
                        {mode === "youth"
                            ? "Child's Information"
                            : "Scouter's Information"}
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "1fr 1fr"
                            },
                            gap: 2.5
                        }}
                    >
                        <TextField
                            required
                            label={
                                mode === "youth"
                                    ? "Child's name"
                                    : "Scouter's name"
                            }
                            name="memberName"
                            value={value.memberName}
                            onChange={textChange}
                            error={Boolean(
                                errors.memberName
                            )}
                            helperText={
                                errors.memberName
                            }
                        />

                        <TextField
                            required
                            type="date"
                            label="Date of birth"
                            name="dateOfBirth"
                            value={value.dateOfBirth}
                            onChange={textChange}
                            error={Boolean(
                                errors.dateOfBirth
                            )}
                            helperText={
                                errors.dateOfBirth
                            }
                            slotProps={{
                                inputLabel: {
                                    shrink: true
                                }
                            }}
                        />

                        <TextField
                            required
                            label={
                                mode === "youth"
                                    ? "Child's address"
                                    : "Scouter's address"
                            }
                            name="address"
                            value={value.address}
                            onChange={textChange}
                            error={Boolean(
                                errors.address
                            )}
                            helperText={errors.address}
                            sx={{
                                gridColumn: {
                                    sm: "1 / -1"
                                }
                            }}
                        />
                    </Box>

                    <Typography
                        variant="h5"
                        color="secondary"
                        sx={{
                            mt: 4,
                            mb: 2
                        }}
                    >
                        Medication Information
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "1fr 1fr"
                            },
                            gap: 2.5
                        }}
                    >
                        <TextField
                            required
                            label="Name of medicine"
                            name="medicineName"
                            value={value.medicineName}
                            onChange={textChange}
                            error={Boolean(
                                errors.medicineName
                            )}
                            helperText={
                                errors.medicineName
                            }
                            sx={{
                                gridColumn: {
                                    sm: "1 / -1"
                                }
                            }}
                        />

                        <TextField
                            required
                            label="Dosage to be taken"
                            name="dosage"
                            value={value.dosage}
                            onChange={textChange}
                            error={Boolean(
                                errors.dosage
                            )}
                            helperText={errors.dosage}
                        />

                        <TextField
                            required
                            label="Frequency of dosage"
                            name="frequency"
                            value={value.frequency}
                            onChange={textChange}
                            error={Boolean(
                                errors.frequency
                            )}
                            helperText={
                                errors.frequency
                            }
                        />

                        <TextField
                            label="Quantity supplied"
                            name="quantitySupplied"
                            value={value.quantitySupplied}
                            onChange={textChange}
                        />

                        <TextField
                            label="Prescribing doctor"
                            name="doctorName"
                            value={value.doctorName}
                            onChange={textChange}
                        />

                        <TextField
                            label="Doctor's telephone"
                            name="doctorTel"
                            value={value.doctorTel}
                            onChange={textChange}
                        />

                        <TextField
                            label="Dispensing pharmacy"
                            name="pharmacyName"
                            value={value.pharmacyName}
                            onChange={textChange}
                        />

                        <TextField
                            label="Pharmacy telephone"
                            name="pharmacyTel"
                            value={value.pharmacyTel}
                            onChange={textChange}
                        />

                        <TextField
                            label="Method of administration"
                            name="method"
                            value={value.method}
                            onChange={textChange}
                            sx={{
                                gridColumn: {
                                    sm: "1 / -1"
                                }
                            }}
                        />

                        <TextField
                            multiline
                            minRows={3}
                            label="Other relevant information"
                            name="otherInfo"
                            value={value.otherInfo}
                            onChange={textChange}
                            helperText="For example: drowsiness, headaches or contra-indications."
                            sx={{
                                gridColumn: {
                                    sm: "1 / -1"
                                }
                            }}
                        />
                    </Box>

                    <Box sx={{ mt: 3 }}>
                        <YesNoField
                            label={
                                mode === "youth"
                                    ? "Can your child self-administer their medication?"
                                    : "Can the Scouter self-administer their medication?"
                            }
                            value={value.selfAdmin}
                            error={errors.selfAdmin}
                            onChange={(answer: YesNo) =>
                                update(
                                    "selfAdmin",
                                    answer
                                )
                            }
                        />
                    </Box>

                    <Typography
                        variant="h5"
                        color="secondary"
                        sx={{
                            mt: 4,
                            mb: 2
                        }}
                    >
                        {mode === "youth"
                            ? "Parent / Guardian Declaration"
                            : "Self Declaration"}
                    </Typography>

                    <Alert severity="info">
                        {mode === "youth"
                            ? "I confirm that I have provided full and accurate medication information. I request and authorise the named Scouters to administer the medication described above. I understand that I will be contacted if my child refuses to take the medication."
                            : "I confirm that the medical information above is correct. I take responsibility for managing my own medication and provide this information for emergency reference purposes."}
                    </Alert>

                    {mode === "youth" && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr"
                                },
                                gap: 2.5,
                                mt: 3
                            }}
                        >
                            <TextField
                                required
                                type="date"
                                label="Authorised from"
                                name="authFrom"
                                value={value.authFrom}
                                onChange={textChange}
                                error={Boolean(
                                    errors.authFrom
                                )}
                                helperText={
                                    errors.authFrom
                                }
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />

                            <TextField
                                required
                                type="date"
                                label="Authorised until"
                                name="authTo"
                                value={value.authTo}
                                onChange={textChange}
                                error={Boolean(
                                    errors.authTo
                                )}
                                helperText={
                                    errors.authTo
                                }
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />

                            <TextField
                                label="Scouter 1"
                                name="scouter1"
                                value={value.scouter1}
                                onChange={textChange}
                            />

                            <TextField
                                label="Scouter 2"
                                name="scouter2"
                                value={value.scouter2}
                                onChange={textChange}
                            />
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "1fr 1fr"
                            },
                            gap: 2.5,
                            mt: 3
                        }}
                    >
                        <TextField
                            required
                            label={
                                mode === "youth"
                                    ? "Signature of parent / guardian"
                                    : "Signature (full name)"
                            }
                            name="signature"
                            value={value.signature}
                            onChange={textChange}
                            error={Boolean(
                                errors.signature
                            )}
                            helperText={
                                errors.signature ??
                                "Type the full name as the electronic signature."
                            }
                        />

                        <TextField
                            required
                            type="date"
                            label="Date"
                            name="signatureDate"
                            value={value.signatureDate}
                            onChange={textChange}
                            error={Boolean(
                                errors.signatureDate
                            )}
                            helperText={
                                errors.signatureDate
                            }
                            slotProps={{
                                inputLabel: {
                                    shrink: true
                                }
                            }}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
}