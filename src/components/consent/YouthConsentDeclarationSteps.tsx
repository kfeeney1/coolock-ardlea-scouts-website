import { Alert, Box, Checkbox, FormControl, FormControlLabel, FormHelperText, TextField, Typography } from "@mui/material";
import MedicationManagementForm from "./MedicationManagementForm";
import { brandColours } from "../../theme/theme";
import { AUTHORISED_SCOUTERS } from "../../services/consentApplications";
import type { YouthConsentStepProps } from "./YouthConsentStepProps";

export default function YouthConsentDeclarationSteps({ step, ...props }: YouthConsentStepProps & { step: number }) {
    const { formData, errors, medicationErrors, onTextChange, onDeclarationConfirmed, onMedicationChange } = props;
    return (
        <>
                {step === 4 && (
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
                            onChange={onTextChange}
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

                {step === 5 && (
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
                            />

                            <TextField
                                required
                                type="date"
                                label="Signature date"
                                name="sigDate"
                                value={formData.sigDate}
                                onChange={onTextChange}
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
                                        onChange={(event) =>
                                            onDeclarationConfirmed(event.target.checked)
                                        }
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
                            sharedIdentity={{ memberName: formData.childName, dateOfBirth: formData.childDOB, address: formData.homeAddress }}
                            memberSection={formData.scoutSection}
                            onChange={onMedicationChange}
                        />
                    </Box>
                )}
        </>
    );
}
