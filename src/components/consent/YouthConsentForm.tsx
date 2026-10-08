import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import {
    Alert,
    Box,
    Button,
    LinearProgress,
    Paper,
    Step,
    StepLabel,
    Stepper,
    Typography
} from "@mui/material";
import { useMemo, useRef, useState } from "react";
import type {
    ChangeEvent,
    FormEvent
} from "react";

import {
    createMedicationData,
    validateMedication
} from "./MedicationManagementForm";
import { brandColours } from "../../theme/theme";
import { focusFirstInvalidFieldAfterRender } from "../../services/formValidationFocus";
import { validateYouthConsent } from "../../services/youthConsentValidation";
import { medicationAuthorisationDefaults } from "../../services/medicationAuthorisationDates";
import { isValidPhone, sanitizePhoneInput } from "../../services/phoneInput";
import { submitYouthConsent } from "../../services/consentApplications";
import type {
    MedicationManagementData,
    YesNo,
    YouthConsentData,
    YouthScoutSection
} from "../../services/consentApplications";
import YouthConsentMemberSteps from "./YouthConsentMemberSteps";
import YouthConsentMedicalSteps from "./YouthConsentMedicalSteps";
import YouthConsentDeclarationSteps from "./YouthConsentDeclarationSteps";

type Errors = Partial<
    Record<keyof YouthConsentData, string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const steps = [
    "Member",
    "Permissions",
    "Medical",
    "Contacts",
    "Additional",
    "Declaration"
];

function defaultDates() {
    const defaults = medicationAuthorisationDefaults();
    return { today: defaults.authFrom, august31: defaults.authTo };
}

function createInitialData(
    section: YouthScoutSection
): YouthConsentData {
    const dates = defaultDates();

    return {
        scoutSection: section,
        childName: "",
        childDOB: "",
        consentFrom: dates.today,
        consentTo: dates.august31,

        photoConsent: "",
        waterActivities: "",
        canSwim: "",

        seriousIllness: "",
        regularMeds: "",
        medAllergies: "",
        allergies: "",
        dietaryReqs: "",
        vaccinated: "",
        medicalFurtherInfo: "",

        gpName: "",
        gpTel: "",
        gpAddress: "",
        lastCheckup: "",

        parent1Name: "",
        parent2Name: "",
        homePhone: "",
        mobile1: "",
        mobile2: "",
        workPhone: "",
        email: "",
        homeAddress: "",

        altContactName: "",
        altContactPhone: "",

        additionalInfo: "",

        sig1Name: "",
        sig2Name: "",
        sigDate: dates.today,
        declarationConfirmed: false,

        medicationManagement:
            createMedicationData(
                dates.today,
                dates.august31
            )
    };
}

type Props = {
    section: YouthScoutSection;
    onChangeSection: () => void;
};

export default function YouthConsentForm({
    section,
    onChangeSection
}: Props) {
    const [activeStep, setActiveStep] = useState(0);
    const [formData, setFormData] =
        useState<YouthConsentData>(
            createInitialData(section)
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
    const formRef = useRef<HTMLFormElement | null>(null);

    const progress = useMemo(
        () =>
            Math.round(
                ((activeStep + 1) / steps.length) * 100
            ),
        [activeStep]
    );

    const clearError = (field: keyof YouthConsentData) => {
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
            event.target.name as keyof YouthConsentData;

        setFormData((current) => ({
            ...current,
            [field]: ["gpTel", "homePhone", "mobile1", "mobile2", "workPhone", "altContactPhone"].includes(String(field)) ? sanitizePhoneInput(event.target.value) : event.target.value
        }));

        clearError(field);
    };

    const updateYesNo = (
        field: keyof YouthConsentData,
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
        field: keyof YouthConsentData,
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
        field: keyof YouthConsentData,
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

        if (!isValidPhone(value)) {
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
                "childName",
                "Child's full name is required."
            );
            required(
                nextErrors,
                "childDOB",
                "Date of birth is required."
            );
            required(
                nextErrors,
                "consentFrom",
                "Start date is required."
            );
            required(
                nextErrors,
                "consentTo",
                "End date is required."
            );

            if (
                formData.consentFrom &&
                formData.consentTo &&
                formData.consentTo <
                    formData.consentFrom
            ) {
                nextErrors.consentTo =
                    "End date must be after start date.";
            }
        }

        if (activeStep === 1) {
            (
                [
                    "photoConsent",
                    "waterActivities",
                    "canSwim"
                ] as Array<keyof YouthConsentData>
            ).forEach((field) => {
                if (!formData[field]) {
                    nextErrors[field] =
                        "Select Yes or No.";
                }
            });
        }

        if (activeStep === 2) {
            (
                [
                    "seriousIllness",
                    "regularMeds",
                    "medAllergies",
                    "allergies",
                    "dietaryReqs",
                    "vaccinated"
                ] as Array<keyof YouthConsentData>
            ).forEach((field) => {
                if (!formData[field]) {
                    nextErrors[field] =
                        "Select Yes or No.";
                }
            });

            required(
                nextErrors,
                "gpName",
                "GP name is required."
            );
            phone(nextErrors, "gpTel", true);
            required(
                nextErrors,
                "gpAddress",
                "GP address is required."
            );
            const canonicalMedicalErrors = validateYouthConsent(formData);
            if (canonicalMedicalErrors.medicalFurtherInfo) {
                nextErrors.medicalFurtherInfo = canonicalMedicalErrors.medicalFurtherInfo;
            }
        }

        if (activeStep === 3) {
            required(
                nextErrors,
                "parent1Name",
                "Parent/guardian name is required."
            );
            phone(nextErrors, "homePhone", false);
            phone(nextErrors, "mobile1", true);
            phone(nextErrors, "mobile2", Boolean(formData.parent2Name.trim()));
            phone(nextErrors, "workPhone", false);

            if (!formData.email.trim()) {
                nextErrors.email =
                    "Email address is required.";
            } else if (
                !EMAIL_RE.test(formData.email.trim())
            ) {
                nextErrors.email =
                    "Enter a valid email address.";
            }

            required(
                nextErrors,
                "homeAddress",
                "Home address is required."
            );
            required(
                nextErrors,
                "altContactName",
                "Emergency contact name is required."
            );
            phone(
                nextErrors,
                "altContactPhone",
                true
            );
        }

        if (activeStep === 5) {
            required(
                nextErrors,
                "sig1Name",
                "Signatory name is required."
            );
            required(
                nextErrors,
                "sigDate",
                "Signature date is required."
            );

            if (!formData.declarationConfirmed) {
                nextErrors.declarationConfirmed =
                    "Confirm the declaration before submitting.";
            }

            nextMedicationErrors =
                validateMedication(
                    formData.medicationManagement,
                    "youth"
                );

            setMedicationErrors(nextMedicationErrors);
        }

        setErrors(nextErrors);

        const valid =
            Object.keys(nextErrors).length === 0 &&
            Object.keys(nextMedicationErrors).length === 0;

        if (!valid) {
            focusFirstInvalidFieldAfterRender(
                formRef.current ?? document
            );
        }

        return valid;
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
            const id = await submitYouthConsent(
                formData
            );

            setReference(id);
            setSubmitted(true);
        } catch (error) {

            setSubmitError(
                applicationErrorMessage(error, "Unable to submit the consent form. Please try again.", "YouthConsentForm")
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const stepProps = {
        formData,
        errors,
        medicationErrors,
        onTextChange: handleTextChange,
        onYesNoChange: updateYesNo,
        onDeclarationConfirmed: (confirmed: boolean) => {
            setFormData((current) => ({
                ...current,
                declarationConfirmed: confirmed
            }));
            clearError("declarationConfirmed");
        },
        onMedicationChange: (medication: MedicationManagementData) => {
            setFormData((current) => ({
                ...current,
                medicationManagement:
                    medication.enabled &&
                    !current.medicationManagement.enabled
                        ? {
                              ...medication,
                              memberName: current.childName,
                              dateOfBirth: current.childDOB,
                              address: current.homeAddress
                          }
                        : medication
            }));
            setMedicationErrors({});
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
                    The youth activity consent form has
                    been submitted successfully.
                </Typography>

                <Alert
                    severity="success"
                    sx={{ mt: 3 }}
                >
                    Consent reference: {reference}
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
                                createInitialData(section)
                            );
                            setSubmitted(false);
                            setReference("");
                            setActiveStep(0);
                        }}
                    >
                        New Consent Form
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
                    Activities Consent Form
                </Typography>

                <Typography
                    variant="h6"
                    sx={{ mt: 1 }}
                >
                    {section}
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
                ref={formRef}
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

                <YouthConsentMemberSteps step={activeStep} {...stepProps} />
                <YouthConsentMedicalSteps step={activeStep} {...stepProps} />
                <YouthConsentDeclarationSteps step={activeStep} {...stepProps} />

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
                                : "Submit Consent Form"}
                        </Button>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}
