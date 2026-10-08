import { Alert, Box, TextField, Typography } from "@mui/material";
import YesNoField from "./YesNoField";
import type { YouthConsentStepProps } from "./YouthConsentStepProps";
import type { YouthConsentData, YesNo } from "../../services/consentApplications";

export default function YouthConsentMedicalSteps({ step, ...props }: YouthConsentStepProps & { step: number }) {
    const { formData, errors, onTextChange, onYesNoChange } = props;
    return (
        <>
                {step === 2 && (
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
                                        onYesNoChange(
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
                            onChange={onTextChange}
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
                                onChange={onTextChange}
                                error={Boolean(
                                    errors.gpName
                                )}
                                helperText={errors.gpName}
                            />

                            <TextField
                                required
                                type="tel"
                                inputMode="tel"
                                label="GP telephone"
                                name="gpTel"
                                value={formData.gpTel}
                                onChange={onTextChange}
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                )}

                {step === 3 && (
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
                                    "Parent/Guardian 1 mobile",
                                    true
                                ],
                                [
                                    "mobile2",
                                    "Parent/Guardian 2 mobile",
                                    false
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
                                        type={["homePhone", "mobile1", "mobile2", "workPhone"].includes(String(field)) ? "tel" : undefined}
                                        inputMode={["homePhone", "mobile1", "mobile2", "workPhone"].includes(String(field)) ? "tel" : undefined}
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
                                            onTextChange
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
                                onChange={onTextChange}
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
                                onChange={onTextChange}
                                error={Boolean(
                                    errors.altContactName
                                )}
                                helperText={
                                    errors.altContactName
                                }
                            />

                            <TextField
                                required
                                type="tel"
                                inputMode="tel"
                                label="Phone number"
                                name="altContactPhone"
                                value={
                                    formData.altContactPhone
                                }
                                onChange={onTextChange}
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
        </>
    );
}
