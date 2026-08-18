import type { ReactNode } from "react";

import {
    Box,
    Paper,
    Typography
} from "@mui/material";

type Props = {
    title: string;
    description: string;
    actions?: ReactNode;
};

export default function LeaderPageHeader({
    title,
    description,
    actions
}: Props) {
    return (
        <Paper
            elevation={2}
            sx={{
                p: {
                    xs: 2.5,
                    md: 3
                },
                mb: 3,
                borderRadius: 2,
                borderLeft: "5px solid",
                borderLeftColor: "secondary.main"
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: {
                        xs: "column",
                        md: "row"
                    },
                    justifyContent: "space-between",
                    alignItems: {
                        xs: "stretch",
                        md: "center"
                    },
                    gap: 2
                }}
            >
                <Box>
                    <Typography
                        variant="h4"
                        color="secondary"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        color="text.secondary"
                        sx={{
                            mt: 0.75
                        }}
                    >
                        {description}
                    </Typography>
                </Box>

                {actions && (
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1.5,
                            flexWrap: "wrap",
                            justifyContent: {
                                xs: "stretch",
                                md: "flex-end"
                            },
                            "& > *": {
                                flex: {
                                    xs: "1 1 100%",
                                    sm: "0 1 auto"
                                }
                            }
                        }}
                    >
                        {actions}
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
