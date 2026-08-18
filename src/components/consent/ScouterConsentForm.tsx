import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    LinearProgress,
    Paper,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography
} from "@mui/material";
import { useMemo, useState } from "react";
import type {
    ChangeEvent,
    FormEvent
} from "react";

import MedicationManagementForm, {
    createMedicationData,
    validateMedication
} from "./MedicationManagementForm";
import YesNoField from "./YesNoField";
import { brandColours } from "../../theme/theme";
import {
    submitScouterConsent
} from "../../services/consentApplications";
import type {
    MedicationManagementData,
    ScouterConsentData,
    YesNo
} from "../../services/consentApplications";

type Errors = Partial<
    Record<keyof ScouterConsentData, string>
>;

const PHONE_RE = /^[\d\s+\-()]{7,20}$/;

const steps = [
    "Applicant",
    "Next of Kin",
    "Medical History",
    "Medication",
    "Declaration"
];

function localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function defaultDates() {
    const today = new Date();
    const july31 = new Date(today.getFullYear(), 6, 31);

    if (today > july31) {
        july31.setFullYear(july31.getFullYear() + 1);
    }

    return {
        today: localDateString(today),
        july31: localDateString(july31)
    };
}

function createInitialData(): ScouterConsentData {
    const dates = defaultDates();

    return {
        scoutSection: "Scouter",

        name: "",
        dob: "",
        address: "",
        mobile: "",
        homePhone: "",
        workPhone: "",

        nextOfKinName: "",
        nextOfKinAddress: "",
        nextOfKinMobile: "",
        nextOfKinHome: "",
        nextOfKinWork: "",

        epilepsy: "",
        diabetes: "",
        asthma: "",
        heartDisease: "",
        highBloodPressure: "",
        skinAllergies: "",
        hearingDifficulties: "",
        otherMedical: "",
        previousInjuries: "",

        onMedication: "",
        medicationDetails: "",
        allergies: "",

        signature: "",
        signatureDate: dates.today,
        declarationConfirmed: false,

        medicationManagement:
            createMedicationData(
                dates.today,
                dates.july31
            )
    };
}

type Props = {
    onChangeSection: () => void;
};

export default function ScouterConsentForm({
    onChangeSection
}: Props) {
    const [activeStep, setActiveStep] = useState(0);
    const [formData, setFormData] =
        useState<ScouterConsentData>(
            createInitialData
        );
    const [errors, setErrors] = useState<Errors>({});
    const [medicationErrors, setMedicationErrors] =
        useState<
            Partial<
                Record<
                    keyof MedicationManagementData,
                    string
                >
            >
        >({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [reference, setReference] = useState("");

    const progress = useMemo(
        () =>
            Math.round(
                ((activeStep + 1) / steps.length) * 100
            ),
        [activeStep]
    );

    const clearError = (
        field: keyof ScouterConsentData
    ) => {
        setErrors((current) => ({
            ...current,
            [field]: undefined
        }));
    };

    const handleTextChange = (
        event: ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement
        >
    ) => {
        const field =
            event.target
                .name as keyof ScouterConsentData;

        setFormData((current) => ({
            ...current,
            [field]: event.target.value
        }));

        clearError(field);
    };

    const updateYesNo = (
        field: keyof ScouterConsentData,
        value: YesNo
    ) => {
        setFormData((current) => ({
            ...current,
            [field]: value
        }));

        clearError(field);
    };

    const required = (
        nextErrors: Errors,
        field: keyof ScouterConsentData,
        message: string
    ) => {
        const value = formData[field];

        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
            nextErrors[field] = message;
        }
    };

    const phone = (
        nextErrors: Errors,
        field: keyof ScouterConsentData,
        isRequired: boolean
    ) => {
        const value = String(formData[field]).trim();

        if (!value) {
            if (isRequired) {
                nextErrors[field] =
                    "Phone number is required.";
            }
            return;
        }

        if (!PHONE_RE.test(value)) {
            nextErrors[field] =
                "Enter a valid phone number.";
        }
    };

    const validateStep = () => {
        const nextErrors: Errors = {};
        let nextMedicationErrors = {};

        if (activeStep === 0) {
            required(
                nextErrors,
                "name",
                "Applicant name is required."
            );
            required(
                nextErrors,
                "dob",
                "Date of birth is required."
            );
            required(
                nextErrors,
                "address",
                "Address is required."
            );

            phone(nextErrors, "mobile", false);
            phone(nextErrors, "homePhone", false);
            phone(nextErrors, "workPhone", false);
        }

        if (activeStep === 1) {
            required(
                nextErrors,
                "nextOfKinName",
                "Next of kin name is required."
            );
            phone(
                nextErrors,
                "nextOfKinMobile",
                true
            );
            phone(
                nextErrors,
                "nextOfKinHome",
                false
            );
            phone(
                nextErrors,
                "nextOfKinWork",
                false
            );
        }

        if (activeStep === 2) {
            (
                [
                    "epilepsy",
                    "diabetes",
                    "asthma",
                    "heartDisease",
                    "highBloodPressure",
                    "skinAllergies",
                    "hearingDifficulties"
                ] as Array<
                    keyof ScouterConsentData
                >
            ).forEach((field) => {
                if (!formData[field]) {
                    nextErrors[field] =
                        "Select Yes or No.";
                }
            });
        }

        if (activeStep === 3) {
            if (!formData.onMedication) {
                nextErrors.onMedication =
                    "Select Yes or No.";
            }
        }

        if (activeStep === 4) {
            required(
                nextErrors,
                "signature",
                "Signature is required."
            );
            required(
                nextErrors,
                "signatureDate",
                "Signature date is required."
            );

            if (!formData.declarationConfirmed) {
                nextErrors.declarationConfirmed =
                    "Confirm the declaration before submitting.";
            }

            nextMedicationErrors =
                validateMedication(
                    formData.medicationManagement,
                    "scouter"
                );

            setMedicationErrors(nextMedicationErrors);
        }

        setErrors(nextErrors);

        return (
            Object.keys(nextErrors).length === 0 &&
            Object.keys(nextMedicationErrors).length ===
                0
        );
    };

    const next = () => {
        if (!validateStep()) return;

        setActiveStep((current) =>
            Math.min(current + 1, steps.length - 1)
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const back = () => {
        setErrors({});
        setSubmitError("");
        setActiveStep((current) =>
            Math.max(current - 1, 0)
        );
    };

    const submit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!validateStep() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");

        try {
            const id = await submitScouterConsent(
                formData
            );

            setReference(id);
            setSubmitted(true);
        } catch (error) {
            console.error(
                "Unable to submit Scouter ES3 form:",
                error
            );

            setSubmitError(
                "Unable to submit the Scouter form. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Paper
                elevation={4}
                sx={{
                    p: {
                        xs: 3,
                        sm: 5
                    },
                    textAlign: "center",
                    borderTop: `7px solid ${brandColours.green}`
                }}
            >
                <Typography
                    variant="h3"
                    color="secondary"
                >
                    Thank You
                </Typography>

                <Typography sx={{ mt: 3 }}>
                    The Scouter ES3 medical advice form has
                    been submitted successfully.
                </Typography>

                <Alert
                    severity="success"
                    sx={{ mt: 3 }}
                >
                    Reference: {reference}
                </Alert>

                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        justifyContent: "center",
                        flexWrap: "wrap",
                        mt: 4
                    }}
                >
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                            setFormData(
                                createInitialData()
                            );
                            setSubmitted(false);
                            setReference("");
                            setActiveStep(0);
                        }}
                    >
                        New Scouter Form
                    </Button>

                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={onChangeSection}
                    >
                        Change Section
                    </Button>
                </Box>
            </Paper>
        );
    }

    return (
        <Paper
            elevation={4}
            sx={{ overflow: "hidden" }}
        >
            <Box
                sx={{
                    background: `linear-gradient(
                        135deg,
                        ${brandColours.coral},
                        ${brandColours.navy}
                    )`,
                    color: "white",
                    p: {
                        xs: 3,
                        md: 5
                    },
                    textAlign: "center"
                }}
            >
                <Typography
                    variant="h3"
                    component="h1"
                >
                    Scouter Medical Advice Form
                </Typography>

                <Typography
                    variant="h6"
                    sx={{ mt: 1 }}
                >
                    ES3 — 18+ Medical Advice Form
                </Typography>

                <Typography
                    variant="body2"
                    sx={{
                        mt: 1,
                        opacity: 0.9
                    }}
                >
                    Strictly Confidential & Optional
                </Typography>

                <Button
                    size="small"
                    onClick={onChangeSection}
                    sx={{
                        mt: 1.5,
                        color: "white",
                        borderColor: "white"
                    }}
                    variant="outlined"
                >
                    Change Section
                </Button>
            </Box>

            <LinearProgress
                variant="determinate"
                value={progress}
                color="success"
                sx={{ height: 7 }}
            />

            <Box
                component="form"
                onSubmit={submit}
                noValidate
                sx={{
                    p: {
                        xs: 3,
                        md: 5
                    }
                }}
            >
                <Stepper
                    activeStep={activeStep}
                    alternativeLabel
                    sx={{
                        mb: 5,
                        display: {
                            xs: "none",
                            md: "flex"
                        }
                    }}
                >
                    {steps.map((step) => (
                        <Step key={step}>
                            <StepLabel>{step}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Typography
                    sx={{
                        display: {
                            xs: "block",
                            md: "none"
                        },
                        color: "secondary.main",
                        fontWeight: 700,
                        mb: 3
                    }}
                >
                    Step {activeStep + 1} of{" "}
                    {steps.length}: {steps[activeStep]}
                </Typography>

                {activeStep === 0 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Applicant Details
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr"
                                },
                                gap: 3
                            }}
                        >
                            <TextField
                                required
                                label="Applicant name"
                                name="name"
                                value={formData.name}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.name
                                )}
                                helperText={errors.name}
                            />

                            <TextField
                                required
                                type="date"
                                label="Date of birth"
                                name="dob"
                                value={formData.dob}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.dob
                                )}
                                helperText={errors.dob}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />

                            <TextField
                                required
                                label="Address"
                                name="address"
                                value={formData.address}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.address
                                )}
                                helperText={
                                    errors.address
                                }
                                sx={{
                                    gridColumn: {
                                        sm: "1 / -1"
                                    }
                                }}
                            />

                            <TextField
                                label="Mobile"
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.mobile
                                )}
                                helperText={
                                    errors.mobile
                                }
                            />

                            <TextField
                                label="Home"
                                name="homePhone"
                                value={formData.homePhone}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.homePhone
                                )}
                                helperText={
                                    errors.homePhone
                                }
                            />

                            <TextField
                                label="Work"
                                name="workPhone"
                                value={formData.workPhone}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.workPhone
                                )}
                                helperText={
                                    errors.workPhone
                                }
                            />
                        </Box>
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 1 }}
                        >
                            Next of Kin
                        </Typography>

                        <Typography
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            To be contacted in an emergency.
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr"
                                },
                                gap: 3
                            }}
                        >
                            <TextField
                                required
                                label="Name"
                                name="nextOfKinName"
                                value={
                                    formData.nextOfKinName
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.nextOfKinName
                                )}
                                helperText={
                                    errors.nextOfKinName
                                }
                            />

                            <TextField
                                label="Address"
                                name="nextOfKinAddress"
                                value={
                                    formData.nextOfKinAddress
                                }
                                onChange={handleTextChange}
                            />

                            <TextField
                                required
                                label="Mobile"
                                name="nextOfKinMobile"
                                value={
                                    formData.nextOfKinMobile
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.nextOfKinMobile
                                )}
                                helperText={
                                    errors.nextOfKinMobile
                                }
                            />

                            <TextField
                                label="Home"
                                name="nextOfKinHome"
                                value={
                                    formData.nextOfKinHome
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.nextOfKinHome
                                )}
                                helperText={
                                    errors.nextOfKinHome
                                }
                            />

                            <TextField
                                label="Work"
                                name="nextOfKinWork"
                                value={
                                    formData.nextOfKinWork
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.nextOfKinWork
                                )}
                                helperText={
                                    errors.nextOfKinWork
                                }
                            />
                        </Box>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 1 }}
                        >
                            Medical History
                        </Typography>

                        <Typography
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            Do you suffer from any of the
                            following conditions?
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gap: 2
                            }}
                        >
                            {[
                                [
                                    "epilepsy",
                                    "Epilepsy"
                                ],
                                [
                                    "diabetes",
                                    "Diabetes"
                                ],
                                [
                                    "asthma",
                                    "Asthma"
                                ],
                                [
                                    "heartDisease",
                                    "Heart Disease"
                                ],
                                [
                                    "highBloodPressure",
                                    "High Blood Pressure"
                                ],
                                [
                                    "skinAllergies",
                                    "Skin Allergies"
                                ],
                                [
                                    "hearingDifficulties",
                                    "Hearing Difficulties"
                                ]
                            ].map(([field, label]) => (
                                <YesNoField
                                    key={field}
                                    label={label}
                                    value={
                                        formData[
                                            field as keyof ScouterConsentData
                                        ] as YesNo | ""
                                    }
                                    error={
                                        errors[
                                            field as keyof ScouterConsentData
                                        ]
                                    }
                                    onChange={(value) =>
                                        updateYesNo(
                                            field as keyof ScouterConsentData,
                                            value
                                        )
                                    }
                                />
                            ))}
                        </Box>

                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="Any other medical history or illness"
                            name="otherMedical"
                            value={formData.otherMedical}
                            onChange={handleTextChange}
                            sx={{ mt: 3 }}
                        />

                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="Previous injuries"
                            name="previousInjuries"
                            value={
                                formData.previousInjuries
                            }
                            onChange={handleTextChange}
                            sx={{ mt: 3 }}
                        />
                    </Box>
                )}

                {activeStep === 3 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Medication & Allergies
                        </Typography>

                        <YesNoField
                            label="Are you currently taking any medication?"
                            value={
                                formData.onMedication
                            }
                            error={
                                errors.onMedication
                            }
                            onChange={(value) =>
                                updateYesNo(
                                    "onMedication",
                                    value
                                )
                            }
                        />

                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="If yes, state which medication and how often taken"
                            name="medicationDetails"
                            value={
                                formData.medicationDetails
                            }
                            onChange={handleTextChange}
                            sx={{ mt: 3 }}
                        />

                        <TextField
                            fullWidth
                            label="Known allergies or sensitivities"
                            name="allergies"
                            value={formData.allergies}
                            onChange={handleTextChange}
                            helperText="For example: penicillin, latex, peanuts — or None."
                            sx={{ mt: 3 }}
                        />
                    </Box>
                )}

                {activeStep === 4 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Declaration & Submission
                        </Typography>

                        <Alert
                            severity="info"
                            sx={{ mb: 3 }}
                        >
                            I certify the information above is
                            correct and understand that the
                            information is completely
                            confidential and can only be
                            issued to Medical Personnel in the
                            case of an emergency.
                        </Alert>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr"
                                },
                                gap: 3
                            }}
                        >
                            <TextField
                                required
                                label="Signature (full name)"
                                name="signature"
                                value={formData.signature}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.signature
                                )}
                                helperText={
                                    errors.signature ??
                                    "Type full name as the electronic signature."
                                }
                            />

                            <TextField
                                required
                                type="date"
                                label="Date"
                                name="signatureDate"
                                value={
                                    formData.signatureDate
                                }
                                onChange={handleTextChange}
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

                        <FormControl
                            error={Boolean(
                                errors.declarationConfirmed
                            )}
                            sx={{ mt: 3 }}
                        >
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        color="success"
                                        checked={
                                            formData.declarationConfirmed
                                        }
                                        onChange={(event) => {
                                            setFormData(
                                                (current) => ({
                                                    ...current,
                                                    declarationConfirmed:
                                                        event
                                                            .target
                                                            .checked
                                                })
                                            );
                                            clearError(
                                                "declarationConfirmed"
                                            );
                                        }}
                                    />
                                }
                                label="I confirm that the information provided is accurate and confirm the declaration above."
                            />

                            {errors.declarationConfirmed && (
                                <FormHelperText>
                                    {
                                        errors.declarationConfirmed
                                    }
                                </FormHelperText>
                            )}
                        </FormControl>

                        <MedicationManagementForm
                            mode="scouter"
                            value={
                                formData.medicationManagement
                            }
                            errors={medicationErrors}
                            onChange={(medication) => {
                                setFormData(
                                    (current) => ({
                                        ...current,
                                        medicationManagement:
                                            medication.enabled &&
                                            !current
                                                .medicationManagement
                                                .enabled
                                                ? {
                                                      ...medication,
                                                      memberName:
                                                          current.name,
                                                      dateOfBirth:
                                                          current.dob,
                                                      address:
                                                          current.address
                                                  }
                                                : medication
                                    })
                                );

                                setMedicationErrors({});
                            }}
                        />
                    </Box>
                )}

                {submitError && (
                    <Alert
                        severity="error"
                        sx={{ mt: 4 }}
                    >
                        {submitError}
                    </Alert>
                )}

                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: 5
                    }}
                >
                    <Button
                        type="button"
                        color="secondary"
                        onClick={back}
                        disabled={activeStep === 0}
                    >
                        Back
                    </Button>

                    {activeStep <
                    steps.length - 1 ? (
                        <Button
                            type="button"
                            variant="contained"
                            color="success"
                            onClick={next}
                        >
                            Continue
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            variant="contained"
                            color="success"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Submitting..."
                                : "Submit Scouter Form"}
                        </Button>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}
