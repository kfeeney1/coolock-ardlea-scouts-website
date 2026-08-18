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
    AUTHORISED_SCOUTERS,
    submitYouthConsent
} from "../../services/consentApplications";
import type {
    MedicationManagementData,
    YesNo,
    YouthConsentData,
    YouthScoutSection
} from "../../services/consentApplications";

type Errors = Partial<
    Record<keyof YouthConsentData, string>
>;

const PHONE_RE = /^[\d\s+\-()]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const steps = [
    "Member",
    "Permissions",
    "Medical",
    "Contacts",
    "Additional",
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

function createInitialData(
    section: YouthScoutSection
): YouthConsentData {
    const dates = defaultDates();

    return {
        scoutSection: section,
        childName: "",
        childDOB: "",
        consentFrom: dates.today,
        consentTo: dates.july31,

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
                dates.july31
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
            [field]: event.target.value
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
        }

        if (activeStep === 3) {
            required(
                nextErrors,
                "parent1Name",
                "Parent/guardian name is required."
            );
            phone(nextErrors, "homePhone", false);
            phone(nextErrors, "mobile1", true);
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
            const id = await submitYouthConsent(
                formData
            );

            setReference(id);
            setSubmitted(true);
        } catch (error) {
            console.error(
                "Unable to submit youth activity consent:",
                error
            );

            setSubmitError(
                "Unable to submit the consent form. Please try again."
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
                            General Consent
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
                                label="Child's full name"
                                name="childName"
                                value={formData.childName}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.childName
                                )}
                                helperText={
                                    errors.childName
                                }
                            />

                            <TextField
                                required
                                type="date"
                                label="Date of birth"
                                name="childDOB"
                                value={formData.childDOB}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.childDOB
                                )}
                                helperText={
                                    errors.childDOB
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
                                label="Consent valid from"
                                name="consentFrom"
                                value={formData.consentFrom}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.consentFrom
                                )}
                                helperText={
                                    errors.consentFrom
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
                                label="Consent valid to"
                                name="consentTo"
                                value={formData.consentTo}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.consentTo
                                )}
                                helperText={
                                    errors.consentTo
                                }
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />
                        </Box>

                        <Alert
                            severity="info"
                            sx={{ mt: 3 }}
                        >
                            I/We the parent(s)/guardian(s)
                            give permission for our child to
                            partake in activities organised
                            and run by the 80th/160th Coolock
                            Ardlea Scout Group and authorise
                            the listed Scouters to have
                            lawful authority over our child
                            during the consent period.
                        </Alert>
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Permissions
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gap: 2
                            }}
                        >
                            <YesNoField
                                label="Do you give permission that photographs may be taken for promotional and record purposes during activities which may include your child?"
                                value={formData.photoConsent}
                                error={
                                    errors.photoConsent
                                }
                                onChange={(value) =>
                                    updateYesNo(
                                        "photoConsent",
                                        value
                                    )
                                }
                            />

                            <YesNoField
                                label="Do you give permission for your child to take part in water activities?"
                                value={
                                    formData.waterActivities
                                }
                                error={
                                    errors.waterActivities
                                }
                                onChange={(value) =>
                                    updateYesNo(
                                        "waterActivities",
                                        value
                                    )
                                }
                            />

                            <YesNoField
                                label="Is your child able to swim?"
                                value={formData.canSwim}
                                error={errors.canSwim}
                                onChange={(value) =>
                                    updateYesNo(
                                        "canSwim",
                                        value
                                    )
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
                            sx={{ mb: 3 }}
                        >
                            Medical Details
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gap: 2
                            }}
                        >
                            {[
                                [
                                    "seriousIllness",
                                    "Has your child any serious illnesses?"
                                ],
                                [
                                    "regularMeds",
                                    "Does your child take any regular medications?"
                                ],
                                [
                                    "medAllergies",
                                    "Are there any medications that your child is allergic to and/or must not be prescribed?"
                                ],
                                [
                                    "allergies",
                                    "Does your child have any allergies?"
                                ],
                                [
                                    "dietaryReqs",
                                    "Has your child any special dietary requirements?"
                                ],
                                [
                                    "vaccinated",
                                    "Has your child been fully vaccinated? (3/5 in 1, Meningitis C, MMR, pre-school booster)"
                                ]
                            ].map(([field, label]) => (
                                <YesNoField
                                    key={field}
                                    label={label}
                                    value={
                                        formData[
                                            field as keyof YouthConsentData
                                        ] as YesNo | ""
                                    }
                                    error={
                                        errors[
                                            field as keyof YouthConsentData
                                        ]
                                    }
                                    onChange={(value) =>
                                        updateYesNo(
                                            field as keyof YouthConsentData,
                                            value
                                        )
                                    }
                                />
                            ))}
                        </Box>

                        <TextField
                            fullWidth
                            multiline
                            minRows={4}
                            label="Further information"
                            name="medicalFurtherInfo"
                            value={
                                formData.medicalFurtherInfo
                            }
                            onChange={handleTextChange}
                            helperText="Provide details for any relevant Yes answers."
                            sx={{ mt: 3 }}
                        />

                        <Typography
                            variant="h5"
                            color="secondary"
                            sx={{
                                mt: 5,
                                mb: 2
                            }}
                        >
                            Medical Consent
                        </Typography>

                        <Alert
                            severity="info"
                            sx={{ mb: 3 }}
                        >
                            In the event of your child being
                            taken ill or injured, you consent
                            to emergency medical, surgical or
                            dental treatment where you cannot
                            be contacted and authorise the
                            Scouters to communicate that
                            consent to a treating practitioner.
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
                                label="Family GP name"
                                name="gpName"
                                value={formData.gpName}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.gpName
                                )}
                                helperText={errors.gpName}
                            />

                            <TextField
                                required
                                label="GP telephone"
                                name="gpTel"
                                value={formData.gpTel}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.gpTel
                                )}
                                helperText={errors.gpTel}
                            />

                            <TextField
                                required
                                label="GP address"
                                name="gpAddress"
                                value={formData.gpAddress}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.gpAddress
                                )}
                                helperText={
                                    errors.gpAddress
                                }
                                sx={{
                                    gridColumn: {
                                        sm: "1 / -1"
                                    }
                                }}
                            />

                            <TextField
                                type="date"
                                label="Date of last check-up"
                                name="lastCheckup"
                                value={formData.lastCheckup}
                                onChange={handleTextChange}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                )}

                {activeStep === 3 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Parent / Guardian Contact
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
                            {[
                                [
                                    "parent1Name",
                                    "Parent/Guardian 1 name",
                                    true
                                ],
                                [
                                    "parent2Name",
                                    "Parent/Guardian 2 name",
                                    false
                                ],
                                [
                                    "homePhone",
                                    "Home phone",
                                    false
                                ],
                                [
                                    "mobile1",
                                    "Mobile",
                                    true
                                ],
                                [
                                    "workPhone",
                                    "Work phone",
                                    false
                                ],
                                [
                                    "email",
                                    "Email",
                                    true
                                ]
                            ].map(
                                ([
                                    field,
                                    label,
                                    isRequired
                                ]) => (
                                    <TextField
                                        key={String(field)}
                                        required={
                                            Boolean(
                                                isRequired
                                            )
                                        }
                                        label={String(
                                            label
                                        )}
                                        name={String(
                                            field
                                        )}
                                        value={
                                            formData[
                                                field as keyof YouthConsentData
                                            ] as string
                                        }
                                        onChange={
                                            handleTextChange
                                        }
                                        error={Boolean(
                                            errors[
                                                field as keyof YouthConsentData
                                            ]
                                        )}
                                        helperText={
                                            errors[
                                                field as keyof YouthConsentData
                                            ]
                                        }
                                    />
                                )
                            )}

                            <TextField
                                required
                                label="Home address"
                                name="homeAddress"
                                value={
                                    formData.homeAddress
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.homeAddress
                                )}
                                helperText={
                                    errors.homeAddress
                                }
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
                                mt: 5,
                                mb: 2
                            }}
                        >
                            Alternative Emergency Contact
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
                                name="altContactName"
                                value={
                                    formData.altContactName
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.altContactName
                                )}
                                helperText={
                                    errors.altContactName
                                }
                            />

                            <TextField
                                required
                                label="Phone number"
                                name="altContactPhone"
                                value={
                                    formData.altContactPhone
                                }
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.altContactPhone
                                )}
                                helperText={
                                    errors.altContactPhone
                                }
                            />
                        </Box>
                    </Box>
                )}

                {activeStep === 4 && (
                    <Box>
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{ mb: 3 }}
                        >
                            Additional Information
                        </Typography>

                        <TextField
                            fullWidth
                            multiline
                            minRows={5}
                            label="Special needs, conditions or other notes"
                            name="additionalInfo"
                            value={
                                formData.additionalInfo
                            }
                            onChange={handleTextChange}
                            helperText="For example: travel sickness or sleepwalking."
                        />

                        <Typography
                            variant="h5"
                            color="secondary"
                            sx={{
                                mt: 5,
                                mb: 2
                            }}
                        >
                            Schedule of Authorised Scouters
                        </Typography>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr",
                                    md: "1fr 1fr 1fr"
                                },
                                gap: 1,
                                p: 3,
                                backgroundColor:
                                    brandColours.navyLight,
                                borderRadius: 3
                            }}
                        >
                            {AUTHORISED_SCOUTERS.map(
                                (name) => (
                                    <Typography
                                        key={name}
                                        variant="body2"
                                        sx={{
                                            fontWeight: 600
                                        }}
                                    >
                                        • {name}
                                    </Typography>
                                )
                            )}
                        </Box>
                    </Box>
                )}

                {activeStep === 5 && (
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
                            By submitting this form I/We
                            confirm that the medical details
                            provided are correct, give consent
                            as described above, and authorise
                            the listed Scouters to act on our
                            behalf regarding our child's
                            welfare during Scout activities.
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
                                label="Full name of Signatory 1"
                                name="sig1Name"
                                value={formData.sig1Name}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.sig1Name
                                )}
                                helperText={
                                    errors.sig1Name ??
                                    "Type full name as the electronic signature."
                                }
                            />

                            <TextField
                                label="Full name of Signatory 2"
                                name="sig2Name"
                                value={formData.sig2Name}
                                onChange={handleTextChange}
                            />

                            <TextField
                                required
                                type="date"
                                label="Signature date"
                                name="sigDate"
                                value={formData.sigDate}
                                onChange={handleTextChange}
                                error={Boolean(
                                    errors.sigDate
                                )}
                                helperText={errors.sigDate}
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
                                label="I/We confirm that the information provided is accurate and confirm the declaration above."
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
                            mode="youth"
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
                                                          current.childName,
                                                      dateOfBirth:
                                                          current.childDOB,
                                                      address:
                                                          current.homeAddress
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
                                : "Submit Consent Form"}
                        </Button>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}
