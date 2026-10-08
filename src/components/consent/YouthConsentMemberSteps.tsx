import { Alert, Box, TextField, Typography } from "@mui/material";
import YesNoField from "./YesNoField";
import type { YouthConsentStepProps } from "./YouthConsentStepProps";

export default function YouthConsentMemberSteps({ step, ...props }: YouthConsentStepProps & { step: number }) {
    const { formData, errors, onTextChange, onYesNoChange } = props;
    return (
        <>
                {step === 0 && (
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
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

                {step === 1 && (
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
                                    onYesNoChange(
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
                                    onYesNoChange(
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
                                    onYesNoChange(
                                        "canSwim",
                                        value
                                    )
                                }
                            />
                        </Box>
                    </Box>
                )}
        </>
    );
}
