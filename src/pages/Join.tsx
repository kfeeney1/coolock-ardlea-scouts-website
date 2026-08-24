import {
    Alert,
    Box,
    Button,
    Checkbox,
    Container,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import { submitJoinApplication } from "../services/joinApplications";
import type { JoinApplication } from "../services/joinApplications";
import { brandColours } from "../theme/theme";

const EMPTY_FORM: JoinApplication = {
    childFirstName: "",
    childLastName: "",
    dateOfBirth: "",
    school: "",
    parentName: "",
    relationship: "",
    mobileNumber: "",
    emailAddress: "",
    section: "",
    previousScoutExperience: "No",
    previousScoutGroup: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    volunteeringInterest: "No",
    additionalInformation: "",
    informationConfirmed: false,
    contactConsent: false
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[\d\s+\-()]{7,20}$/;

export default function Join() {
    const content = usePublicSiteContent();
    const youthSections = content.sections.filter((section) => section.youth);
    const [form, setForm] = useState<JoinApplication>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [reference, setReference] = useState("");
    const [error, setError] = useState("");

    const updateText = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const key = event.target.name as keyof JoinApplication;
        setForm((current) => ({ ...current, [key]: event.target.value }));
        setError("");
    };

    const validate = (): string => {
        if (!form.childFirstName.trim() || !form.childLastName.trim()) return "Enter the young person's first and last name.";
        if (!form.dateOfBirth) return "Enter the young person's date of birth.";
        if (!form.parentName.trim()) return "Enter the parent or guardian name.";
        if (!form.relationship.trim()) return "Enter the relationship to the young person.";
        if (!phonePattern.test(form.mobileNumber.trim())) return "Enter a valid mobile number.";
        if (!emailPattern.test(form.emailAddress.trim())) return "Enter a valid email address.";
        if (!youthSections.some((section) => section.value === form.section)) return "Choose a valid Scout section.";
        if (!form.emergencyContactName.trim() || !phonePattern.test(form.emergencyContactPhone.trim())) return "Enter a valid emergency contact name and phone number.";
        if (!form.informationConfirmed) return "Confirm that the information is accurate.";
        if (!form.contactConsent) return "Consent to being contacted about this joining enquiry.";
        return "";
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting) return;
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        setError("");
        try {
            const id = await submitJoinApplication(form);
            setReference(id);
            setSubmitted(true);
        } catch (submitError) {
            console.error("Unable to submit Join Us application:", submitError);
            setError("Unable to submit the joining enquiry. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Box sx={{ backgroundColor: "background.default", minHeight: "70vh", py: { xs: 4, md: 7 } }}>
                <Container maxWidth="md">
                    <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderTop: `6px solid ${brandColours.green}` }}>
                        <Typography variant="h3" color="secondary">{content.join.successTitle}</Typography>
                        <Typography sx={{ mt: 2 }}>{content.join.successMessage}</Typography>
                        <Typography color="text.secondary" sx={{ mt: 1 }}>{content.join.reviewMessage}</Typography>
                        <Alert severity="success" sx={{ mt: 3 }}>Application reference: {reference}</Alert>
                        <Button
                            sx={{ mt: 3 }}
                            variant="contained"
                            color="success"
                            onClick={() => {
                                setForm(EMPTY_FORM);
                                setSubmitted(false);
                                setReference("");
                            }}
                        >
                            Submit another enquiry
                        </Button>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box sx={{ backgroundColor: "background.default", minHeight: "70vh", py: { xs: 4, md: 7 } }}>
            <Container maxWidth="md">
                <Paper elevation={3} sx={{ overflow: "hidden" }}>
                    <Box sx={{ background: `linear-gradient(135deg, ${brandColours.coral}, ${brandColours.navy})`, color: "white", p: { xs: 3, md: 5 }, textAlign: "center" }}>
                        <Typography variant="h3" component="h1">{content.join.title}</Typography>
                        <Typography variant="h6" sx={{ mt: 1 }}>{content.group.name}</Typography>
                        <Typography sx={{ mt: 2 }}>{content.join.intro}</Typography>
                    </Box>

                    <Box component="form" onSubmit={submit} noValidate sx={{ p: { xs: 3, md: 5 }, display: "grid", gap: 3 }}>
                        <Typography variant="h5" color="secondary">Young person</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <TextField required label="First name" name="childFirstName" value={form.childFirstName} onChange={updateText} />
                            <TextField required label="Last name" name="childLastName" value={form.childLastName} onChange={updateText} />
                            <TextField required type="date" label="Date of birth" name="dateOfBirth" value={form.dateOfBirth} onChange={updateText} slotProps={{ inputLabel: { shrink: true } }} />
                            <TextField label="School" name="school" value={form.school} onChange={updateText} />
                        </Box>

                        <FormControl required fullWidth>
                            <InputLabel id="join-section-label">Preferred section</InputLabel>
                            <Select
                                labelId="join-section-label"
                                label="Preferred section"
                                value={form.section}
                                onChange={(event) => {
                                    setForm((current) => ({ ...current, section: String(event.target.value) }));
                                    setError("");
                                }}
                            >
                                {youthSections.map((section) => (
                                    <MenuItem key={section.value} value={section.value}>{section.label} — {section.ages}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Typography variant="h5" color="secondary">Parent / guardian</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <TextField required label="Parent / guardian name" name="parentName" value={form.parentName} onChange={updateText} />
                            <TextField required label="Relationship" name="relationship" value={form.relationship} onChange={updateText} />
                            <TextField required label="Mobile number" name="mobileNumber" value={form.mobileNumber} onChange={updateText} />
                            <TextField required type="email" label="Email address" name="emailAddress" value={form.emailAddress} onChange={updateText} />
                        </Box>

                        <Typography variant="h5" color="secondary">Emergency contact</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <TextField required label="Emergency contact name" name="emergencyContactName" value={form.emergencyContactName} onChange={updateText} />
                            <TextField required label="Emergency contact phone" name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={updateText} />
                        </Box>

                        <Typography variant="h5" color="secondary">Additional information</Typography>
                        <FormControl fullWidth>
                            <InputLabel id="previous-scout-label">Previous Scout experience</InputLabel>
                            <Select
                                labelId="previous-scout-label"
                                label="Previous Scout experience"
                                value={form.previousScoutExperience}
                                onChange={(event) => setForm((current) => ({ ...current, previousScoutExperience: String(event.target.value) }))}
                            >
                                <MenuItem value="No">No</MenuItem>
                                <MenuItem value="Yes">Yes</MenuItem>
                            </Select>
                        </FormControl>
                        {form.previousScoutExperience === "Yes" && (
                            <TextField label="Previous Scout group" name="previousScoutGroup" value={form.previousScoutGroup} onChange={updateText} />
                        )}
                        <FormControl fullWidth>
                            <InputLabel id="volunteer-label">Interested in volunteering?</InputLabel>
                            <Select
                                labelId="volunteer-label"
                                label="Interested in volunteering?"
                                value={form.volunteeringInterest}
                                onChange={(event) => setForm((current) => ({ ...current, volunteeringInterest: String(event.target.value) }))}
                            >
                                <MenuItem value="No">No</MenuItem>
                                <MenuItem value="Yes">Yes</MenuItem>
                                <MenuItem value="Maybe">Maybe</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField fullWidth multiline minRows={4} label="Anything else we should know?" name="additionalInformation" value={form.additionalInformation} onChange={updateText} />

                        <FormControlLabel
                            control={<Checkbox checked={form.informationConfirmed} onChange={(event) => setForm((current) => ({ ...current, informationConfirmed: event.target.checked }))} />}
                            label="I confirm that the information provided is accurate."
                        />
                        <FormControlLabel
                            control={<Checkbox checked={form.contactConsent} onChange={(event) => setForm((current) => ({ ...current, contactConsent: event.target.checked }))} />}
                            label="I consent to being contacted about this joining enquiry."
                        />

                        {error && <Alert severity="error">{error}</Alert>}
                        <Button type="submit" variant="contained" color="success" size="large" disabled={submitting}>
                            {submitting ? "Submitting..." : "Submit joining enquiry"}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
