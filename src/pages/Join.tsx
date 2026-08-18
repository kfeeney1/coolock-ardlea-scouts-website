import {
    Alert,
    Box,
    Button,
    Checkbox,
    Container,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";
import type {
    ChangeEvent,
    FormEvent
} from "react";

import { submitJoinApplication } from "../services/joinApplications";
import { brandColours } from "../theme/theme";

type JoinFormData = {
    childFirstName: string;
    childLastName: string;
    dateOfBirth: string;
    school: string;
    parentName: string;
    relationship: string;
    mobileNumber: string;
    emailAddress: string;
    section: string;
    previousScoutExperience: string;
    previousScoutGroup: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    volunteeringInterest: string;
    additionalInformation: string;
    informationConfirmed: boolean;
    contactConsent: boolean;
};

type FormErrors = Partial<
    Record<keyof JoinFormData, string>
>;

const initialFormData: JoinFormData = {
    childFirstName: "",
    childLastName: "",
    dateOfBirth: "",
    school: "",
    parentName: "",
    relationship: "",
    mobileNumber: "",
    emailAddress: "",
    section: "",
    previousScoutExperience: "",
    previousScoutGroup: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    volunteeringInterest: "",
    additionalInformation: "",
    informationConfirmed: false,
    contactConsent: false
};

const steps = [
    "Child",
    "Parent",
    "Scouting",
    "Contact",
    "Review"
];

export default function Join() {
    const [activeStep, setActiveStep] = useState(0);
    const [formData, setFormData] =
        useState<JoinFormData>(initialFormData);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [applicationReference, setApplicationReference] = useState("");

    const handleTextChange = (
        event: ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = event.target;

        setFormData((current) => ({
            ...current,
            [name]: value
        }));

        setErrors((current) => ({
            ...current,
            [name]: undefined
        }));
    };

    const handleCheckboxChange = (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const { name, checked } = event.target;

        setFormData((current) => ({
            ...current,
            [name]: checked
        }));

        setErrors((current) => ({
            ...current,
            [name]: undefined
        }));
    };

    const updateSelect = (
        field: keyof JoinFormData,
        value: string
    ) => {
        setFormData((current) => ({
            ...current,
            [field]: value
        }));

        setErrors((current) => ({
            ...current,
            [field]: undefined
        }));
    };

    const validateStep = () => {
        const nextErrors: FormErrors = {};

        if (activeStep === 0) {
            if (!formData.childFirstName.trim()) {
                nextErrors.childFirstName =
                    "First name is required.";
            }

            if (!formData.childLastName.trim()) {
                nextErrors.childLastName =
                    "Last name is required.";
            }

            if (!formData.dateOfBirth) {
                nextErrors.dateOfBirth =
                    "Date of birth is required.";
            }
        }

        if (activeStep === 1) {
            if (!formData.parentName.trim()) {
                nextErrors.parentName =
                    "Parent or guardian name is required.";
            }

            if (!formData.relationship.trim()) {
                nextErrors.relationship =
                    "Relationship is required.";
            }

            if (!formData.mobileNumber.trim()) {
                nextErrors.mobileNumber =
                    "Mobile number is required.";
            }

            if (!formData.emailAddress.trim()) {
                nextErrors.emailAddress =
                    "Email address is required.";
            } else if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    formData.emailAddress
                )
            ) {
                nextErrors.emailAddress =
                    "Enter a valid email address.";
            }
        }

        if (activeStep === 2) {
            if (!formData.section) {
                nextErrors.section =
                    "Select a preferred section.";
            }

            if (!formData.previousScoutExperience) {
                nextErrors.previousScoutExperience =
                    "Select an answer.";
            }
        }

        if (activeStep === 3) {
            if (!formData.emergencyContactName.trim()) {
                nextErrors.emergencyContactName =
                    "Emergency contact name is required.";
            }

            if (!formData.emergencyContactPhone.trim()) {
                nextErrors.emergencyContactPhone =
                    "Emergency contact number is required.";
            }
        }

        if (activeStep === 4) {
            if (!formData.informationConfirmed) {
                nextErrors.informationConfirmed =
                    "Confirm that the information is correct.";
            }

            if (!formData.contactConsent) {
                nextErrors.contactConsent =
                    "You must agree to be contacted.";
            }
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };

    const handleNext = () => {
        if (!validateStep()) {
            return;
        }

        setActiveStep((current) => current + 1);
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const handleBack = () => {
        setErrors({});
        setActiveStep((current) =>
            Math.max(current - 1, 0)
        );
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!validateStep() || isSubmitting) {
            return;
        }

        setSubmitError("");
        setIsSubmitting(true);

        try {
            const id = await submitJoinApplication(formData);
            setApplicationReference(id);
            setSubmitted(true);

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        } catch (error) {
            console.error("Unable to submit joining enquiry:", error);
            setSubmitError(
                "Unable to submit your application. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Box
                sx={{
                    minHeight: "calc(100vh - 80px)",
                    backgroundColor: "background.default",
                    py: 8
                }}
            >
                <Container maxWidth="sm">
                    <Paper
                        elevation={5}
                        sx={{
                            p: {
                                xs: 3,
                                sm: 6
                            },
                            textAlign: "center",
                            borderRadius: 4,
                            borderTop: `8px solid ${brandColours.green}`
                        }}
                    >
                        <Typography
                            variant="h3"
                            component="h1"
                            sx={{
                                color: "secondary.main",
                                fontWeight: 800
                            }}
                        >
                            Thank You
                        </Typography>

                        <Typography sx={{ mt: 3 }}>
                            Your joining enquiry has been received successfully.
                        </Typography>

                        <Alert severity="success" sx={{ mt: 4 }}>
                            A Scout leader will review the enquiry and contact you about the next steps.
                        </Alert>

                        {applicationReference && (
                            <Typography sx={{ mt: 3, color: "text.secondary", wordBreak: "break-all" }}>
                                Application reference: <strong>{applicationReference}</strong>
                            </Typography>
                        )}

                        <Button
                            type="button"
                            variant="contained"
                            onClick={() => {
                                setFormData(initialFormData);
                                setErrors({});
                                setActiveStep(0);
                                setSubmitted(false);
                                setSubmitError("");
                                setApplicationReference("");
                            }}
                            sx={{
                                mt: 4,
                                backgroundColor: "success.main",
                                borderRadius: "30px",
                                px: 4,
                                fontWeight: 700,
                                textTransform: "none",
                                "&:hover": {
                                    backgroundColor: "success.dark"
                                }
                            }}
                        >
                            Start Another Enquiry
                        </Button>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor: "background.default",
                py: {
                    xs: 4,
                    md: 7
                }
            }}
        >
            <Container maxWidth="md">
                <Paper
                    elevation={5}
                    sx={{
                        overflow: "hidden",
                        borderRadius: 4
                    }}
                >
                    <Box
                        sx={{
                            background:
                                `linear-gradient(135deg, ${brandColours.coral}, ${brandColours.navy})`,
                            color: "white",
                            textAlign: "center",
                            p: {
                                xs: 3,
                                md: 5
                            }
                        }}
                    >
                        <Typography
                            variant="h3"
                            component="h1"
                            sx={{
                                fontWeight: 800
                            }}
                        >
                            Join Us
                        </Typography>

                        <Typography
                            variant="h6"
                            component="p"
                            sx={{
                                mt: 2,
                                fontWeight: 500
                            }}
                        >
                            80th 160th Coolock Ardlea Scout Group
                        </Typography>

                        <Typography sx={{ mt: 2 }}>
                            Register your interest in joining our
                            Scout group.
                        </Typography>
                    </Box>

                    <Box
                        component="form"
                        onSubmit={handleSubmit}
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
                                    sm: "flex"
                                }
                            }}
                        >
                            {steps.map((step) => (
                                <Step key={step}>
                                    <StepLabel>
                                        {step}
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        <Typography
                            sx={{
                                display: {
                                    xs: "block",
                                    sm: "none"
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
                                    component="h2"
                                    sx={{
                                        color: "secondary.main",
                                        fontWeight: 700,
                                        mb: 3
                                    }}
                                >
                                    Child Details
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
                                        label="First name"
                                        name="childFirstName"
                                        value={
                                            formData.childFirstName
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.childFirstName
                                        )}
                                        helperText={
                                            errors.childFirstName
                                        }
                                    />

                                    <TextField
                                        required
                                        label="Last name"
                                        name="childLastName"
                                        value={
                                            formData.childLastName
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.childLastName
                                        )}
                                        helperText={
                                            errors.childLastName
                                        }
                                    />

                                    <TextField
                                        required
                                        type="date"
                                        label="Date of birth"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleTextChange}
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
                                        label="School"
                                        name="school"
                                        value={formData.school}
                                        onChange={handleTextChange}
                                    />
                                </Box>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box>
                                <Typography
                                    variant="h4"
                                    component="h2"
                                    sx={{
                                        color: "secondary.main",
                                        fontWeight: 700,
                                        mb: 3
                                    }}
                                >
                                    Parent or Guardian
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
                                        label="Full name"
                                        name="parentName"
                                        value={formData.parentName}
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.parentName
                                        )}
                                        helperText={
                                            errors.parentName
                                        }
                                    />

                                    <TextField
                                        required
                                        label="Relationship"
                                        name="relationship"
                                        value={
                                            formData.relationship
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.relationship
                                        )}
                                        helperText={
                                            errors.relationship
                                        }
                                    />

                                    <TextField
                                        required
                                        label="Mobile number"
                                        name="mobileNumber"
                                        value={
                                            formData.mobileNumber
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.mobileNumber
                                        )}
                                        helperText={
                                            errors.mobileNumber
                                        }
                                    />

                                    <TextField
                                        required
                                        type="email"
                                        label="Email address"
                                        name="emailAddress"
                                        value={
                                            formData.emailAddress
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.emailAddress
                                        )}
                                        helperText={
                                            errors.emailAddress
                                        }
                                    />
                                </Box>
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box>
                                <Typography
                                    variant="h4"
                                    component="h2"
                                    sx={{
                                        color: "secondary.main",
                                        fontWeight: 700,
                                        mb: 3
                                    }}
                                >
                                    Scout Information
                                </Typography>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 3
                                    }}
                                >
                                    <FormControl
                                        required
                                        fullWidth
                                        error={Boolean(
                                            errors.section
                                        )}
                                    >
                                        <InputLabel>
                                            Preferred section
                                        </InputLabel>

                                        <Select
                                            label="Preferred section"
                                            value={formData.section}
                                            onChange={(event) =>
                                                updateSelect(
                                                    "section",
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="Beavers">
                                                Beavers
                                            </MenuItem>
                                            <MenuItem value="Cubs">
                                                Cubs
                                            </MenuItem>
                                            <MenuItem value="Scouts">
                                                Scouts
                                            </MenuItem>
                                            <MenuItem value="Ventures">
                                                Ventures
                                            </MenuItem>
                                            <MenuItem value="Rovers">
                                                Rover Scouts
                                            </MenuItem>
                                        </Select>

                                        <FormHelperText>
                                            {errors.section}
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl
                                        required
                                        fullWidth
                                        error={Boolean(
                                            errors.previousScoutExperience
                                        )}
                                    >
                                        <InputLabel>
                                            Previous Scout experience?
                                        </InputLabel>

                                        <Select
                                            label="Previous Scout experience?"
                                            value={
                                                formData.previousScoutExperience
                                            }
                                            onChange={(event) =>
                                                updateSelect(
                                                    "previousScoutExperience",
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="No">
                                                No
                                            </MenuItem>
                                            <MenuItem value="Yes">
                                                Yes
                                            </MenuItem>
                                        </Select>

                                        <FormHelperText>
                                            {
                                                errors.previousScoutExperience
                                            }
                                        </FormHelperText>
                                    </FormControl>

                                    {formData.previousScoutExperience ===
                                        "Yes" && (
                                        <TextField
                                            label="Previous Scout group"
                                            name="previousScoutGroup"
                                            value={
                                                formData.previousScoutGroup
                                            }
                                            onChange={
                                                handleTextChange
                                            }
                                        />
                                    )}

                                    <FormControl fullWidth>
                                        <InputLabel>
                                            Interest in volunteering
                                        </InputLabel>

                                        <Select
                                            label="Interest in volunteering"
                                            value={
                                                formData.volunteeringInterest
                                            }
                                            onChange={(event) =>
                                                updateSelect(
                                                    "volunteeringInterest",
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <MenuItem value="Yes">
                                                Yes
                                            </MenuItem>
                                            <MenuItem value="Maybe">
                                                Maybe
                                            </MenuItem>
                                            <MenuItem value="No">
                                                No
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Box>
                        )}

                        {activeStep === 3 && (
                            <Box>
                                <Typography
                                    variant="h4"
                                    component="h2"
                                    sx={{
                                        color: "secondary.main",
                                        fontWeight: 700,
                                        mb: 3
                                    }}
                                >
                                    Emergency Contact
                                </Typography>

                                <Alert
                                    severity="info"
                                    sx={{ mb: 3 }}
                                >
                                    Please provide an emergency contact
                                    who can be reached if needed.
                                </Alert>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 3
                                    }}
                                >
                                    <TextField
                                        required
                                        label="Emergency contact name"
                                        name="emergencyContactName"
                                        value={
                                            formData.emergencyContactName
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.emergencyContactName
                                        )}
                                        helperText={
                                            errors.emergencyContactName
                                        }
                                    />

                                    <TextField
                                        required
                                        label="Emergency contact number"
                                        name="emergencyContactPhone"
                                        value={
                                            formData.emergencyContactPhone
                                        }
                                        onChange={handleTextChange}
                                        error={Boolean(
                                            errors.emergencyContactPhone
                                        )}
                                        helperText={
                                            errors.emergencyContactPhone
                                        }
                                    />

                                    <TextField
                                        multiline
                                        minRows={4}
                                        label="Additional information"
                                        name="additionalInformation"
                                        value={
                                            formData.additionalInformation
                                        }
                                        onChange={handleTextChange}
                                    />
                                </Box>
                            </Box>
                        )}

                        {activeStep === 4 && (
                            <Box>
                                <Typography
                                    variant="h4"
                                    component="h2"
                                    sx={{
                                        color: "secondary.main",
                                        fontWeight: 700,
                                        mb: 3
                                    }}
                                >
                                    Review and Submit
                                </Typography>

                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 3,
                                        borderRadius: 3,
                                        backgroundColor: brandColours.navyLight
                                    }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color: "secondary.main",
                                            fontWeight: 700
                                        }}
                                    >
                                        Applicant
                                    </Typography>

                                    <Typography sx={{ mt: 1 }}>
                                        {formData.childFirstName}{" "}
                                        {formData.childLastName}
                                    </Typography>

                                    <Typography>
                                        Date of birth:{" "}
                                        {formData.dateOfBirth}
                                    </Typography>

                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color: "secondary.main",
                                            fontWeight: 700,
                                            mt: 3
                                        }}
                                    >
                                        Parent or Guardian
                                    </Typography>

                                    <Typography sx={{ mt: 1 }}>
                                        {formData.parentName}
                                    </Typography>

                                    <Typography>
                                        {formData.emailAddress}
                                    </Typography>

                                    <Typography>
                                        {formData.mobileNumber}
                                    </Typography>

                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color: "secondary.main",
                                            fontWeight: 700,
                                            mt: 3
                                        }}
                                    >
                                        Preferred Section
                                    </Typography>

                                    <Typography sx={{ mt: 1 }}>
                                        {formData.section}
                                    </Typography>
                                </Paper>

                                <Box sx={{ mt: 4 }}>
                                    <FormControl
                                        error={Boolean(
                                            errors.informationConfirmed
                                        )}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    name="informationConfirmed"
                                                    checked={
                                                        formData.informationConfirmed
                                                    }
                                                    onChange={
                                                        handleCheckboxChange
                                                    }
                                                />
                                            }
                                            label="I confirm that the information provided is correct."
                                        />

                                        <FormHelperText>
                                            {
                                                errors.informationConfirmed
                                            }
                                        </FormHelperText>
                                    </FormControl>
                                </Box>

                                <Box sx={{ mt: 2 }}>
                                    <FormControl
                                        error={Boolean(
                                            errors.contactConsent
                                        )}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    name="contactConsent"
                                                    checked={
                                                        formData.contactConsent
                                                    }
                                                    onChange={
                                                        handleCheckboxChange
                                                    }
                                                />
                                            }
                                            label="I agree to be contacted about this joining enquiry."
                                        />

                                        <FormHelperText>
                                            {errors.contactConsent}
                                        </FormHelperText>
                                    </FormControl>
                                </Box>
                            </Box>
                        )}

                        {submitError && (
                            <Alert severity="error" sx={{ mt: 3 }}>
                                {submitError}
                            </Alert>
                        )}

                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                                mt: 5
                            }}
                        >
                            <Button
                                type="button"
                                onClick={handleBack}
                                disabled={activeStep === 0}
                                sx={{
                                    color: "secondary.main",
                                    fontWeight: 700,
                                    textTransform: "none"
                                }}
                            >
                                Back
                            </Button>

                            {activeStep < steps.length - 1 ? (
                                <Button
                                    type="button"
                                    variant="contained"
                                    onClick={handleNext}
                                    sx={{
                                        backgroundColor: "success.main",
                                        borderRadius: "30px",
                                        px: 4,
                                        fontWeight: 700,
                                        textTransform: "none",
                                        "&:hover": {
                                            backgroundColor:
                                                "success.dark"
                                        }
                                    }}
                                >
                                    Continue
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={isSubmitting}
                                    sx={{
                                        backgroundColor: "success.main",
                                        borderRadius: "30px",
                                        px: 4,
                                        fontWeight: 700,
                                        textTransform: "none",
                                        "&:hover": {
                                            backgroundColor:
                                                "success.dark"
                                        }
                                    }}
                                >
                                    {isSubmitting ? "Submitting..." : "Submit Application"}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}