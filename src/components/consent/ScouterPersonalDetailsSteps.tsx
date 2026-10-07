import { Box, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";
import type { ScouterConsentData } from "../../services/consentApplications";

export type ScouterConsentErrors = Partial<
    Record<keyof ScouterConsentData, string>
>;

type PersonalDetailsStepProps = {
    formData: ScouterConsentData;
    errors: ScouterConsentErrors;
    onTextChange: (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
};

export function ScouterApplicantDetailsStep({
    formData,
    errors,
    onTextChange
}: PersonalDetailsStepProps) {
    return (
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
                    onChange={onTextChange}
                    error={Boolean(errors.name)}
                    helperText={errors.name}
                />

                <TextField
                    required
                    type="date"
                    label="Date of birth"
                    name="dob"
                    value={formData.dob}
                    onChange={onTextChange}
                    error={Boolean(errors.dob)}
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
                    onChange={onTextChange}
                    error={Boolean(errors.address)}
                    helperText={errors.address}
                    sx={{
                        gridColumn: {
                            sm: "1 / -1"
                        }
                    }}
                />

                <TextField
                    label="Mobile"
                    type="tel"
                    inputMode="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={onTextChange}
                    error={Boolean(errors.mobile)}
                    helperText={errors.mobile}
                />

                <TextField
                    label="Home"
                    type="tel"
                    inputMode="tel"
                    name="homePhone"
                    value={formData.homePhone}
                    onChange={onTextChange}
                    error={Boolean(errors.homePhone)}
                    helperText={errors.homePhone}
                />

                <TextField
                    label="Work"
                    type="tel"
                    inputMode="tel"
                    name="workPhone"
                    value={formData.workPhone}
                    onChange={onTextChange}
                    error={Boolean(errors.workPhone)}
                    helperText={errors.workPhone}
                />
            </Box>
        </Box>
    );
}

export function ScouterNextOfKinStep({
    formData,
    errors,
    onTextChange
}: PersonalDetailsStepProps) {
    return (
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
                    value={formData.nextOfKinName}
                    onChange={onTextChange}
                    error={Boolean(errors.nextOfKinName)}
                    helperText={errors.nextOfKinName}
                />

                <TextField
                    label="Address"
                    name="nextOfKinAddress"
                    value={formData.nextOfKinAddress}
                    onChange={onTextChange}
                />

                <TextField
                    required
                    label="Mobile"
                    type="tel"
                    inputMode="tel"
                    name="nextOfKinMobile"
                    value={formData.nextOfKinMobile}
                    onChange={onTextChange}
                    error={Boolean(errors.nextOfKinMobile)}
                    helperText={errors.nextOfKinMobile}
                />

                <TextField
                    label="Home"
                    type="tel"
                    inputMode="tel"
                    name="nextOfKinHome"
                    value={formData.nextOfKinHome}
                    onChange={onTextChange}
                    error={Boolean(errors.nextOfKinHome)}
                    helperText={errors.nextOfKinHome}
                />

                <TextField
                    label="Work"
                    type="tel"
                    inputMode="tel"
                    name="nextOfKinWork"
                    value={formData.nextOfKinWork}
                    onChange={onTextChange}
                    error={Boolean(errors.nextOfKinWork)}
                    helperText={errors.nextOfKinWork}
                />
            </Box>
        </Box>
    );
}
