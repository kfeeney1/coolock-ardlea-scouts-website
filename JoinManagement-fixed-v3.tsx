import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
// PHONE_DISPLAY_FIX_2026_08_18
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import {
    useEffect,
    useMemo,
    useState
} from "react";
import {
    addContactHistoryEntry,
    convertJoinApplicationToMember,
    loadJoinApplications,
    updateJoinNotes,
    updateJoinStatus
} from "../services/joinAdmin";

import type {
    ContactMethod,
    JoinApplicationRecord,
    JoinStatus
} from "../services/joinAdmin";
type ViewMode =
    | "all"
    | "waiting-list";

type WaitingSort =
    | "oldest"
    | "newest"
    | "name";

const statuses: JoinStatus[] = [
    "new",
    "contacted",
    "waiting-list",
    "accepted",
    "closed"
];

const sections = [
    "all",
    "Beavers",
    "Cubs",
    "Scouts",
    "Ventures",
    "Rovers"
];

const contactMethods: Array<{
    value: ContactMethod;
    label: string;
}> = [
    {
        value: "phone",
        label: "Phone"
    },
    {
        value: "email",
        label: "Email"
    },
    {
        value: "text",
        label: "Text"
    },
    {
        value: "in-person",
        label: "In Person"
    },
    {
        value: "other",
        label: "Other"
    }
];

function formatDate(
    date: Date | null
): string {
    if (!date) {
        return "Unknown";
    }

    return new Intl.DateTimeFormat(
        "en-IE",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
}

function statusLabel(
    status: JoinStatus
): string {
    switch (status) {
        case "waiting-list":
            return "Waiting List";

        case "new":
            return "New";

        case "contacted":
            return "Contacted";

        case "accepted":
            return "Accepted";

        case "closed":
            return "Closed";
    }
}

function statusColor(
    status: JoinStatus
):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" {
    switch (status) {
        case "new":
            return "info";

        case "contacted":
            return "primary";

        case "waiting-list":
            return "warning";

        case "accepted":
            return "success";

        case "closed":
            return "default";
    }
}

export default function JoinManagement() {
    const [
        records,
        setRecords
    ] =
        useState<
            JoinApplicationRecord[]
        >(
            []
        );

    const [
        loading,
        setLoading
    ] =
        useState(true);

    const [
        error,
        setError
    ] =
        useState("");

    const [
        message,
        setMessage
    ] =
        useState("");

    const [
        search,
        setSearch
    ] =
        useState("");

    const [
        sectionFilter,
        setSectionFilter
    ] =
        useState("all");

    const [
        statusFilter,
        setStatusFilter
    ] =
        useState<
            JoinStatus | "all"
        >(
            "all"
        );

    const [
        viewMode,
        setViewMode
    ] =
        useState<ViewMode>(
            "all"
        );

    const [
        waitingSectionFilter,
        setWaitingSectionFilter
    ] =
        useState("all");

    const [
        waitingSearch,
        setWaitingSearch
    ] =
        useState("");

    const [
        waitingSort,
        setWaitingSort
    ] =
        useState<WaitingSort>(
            "oldest"
        );

    const [
        selected,
        setSelected
    ] =
        useState<
            JoinApplicationRecord | null
        >(
            null
        );

    const [
        notesDraft,
        setNotesDraft
    ] =
        useState("");

    const [
        contactMethod,
        setContactMethod
    ] =
        useState<ContactMethod>(
            "phone"
        );

    const [
        contactNote,
        setContactNote
    ] =
        useState("");

    const [
        saving,
        setSaving
    ] =
        useState(false);

    const load =
        async () => {
            setLoading(
                true
            );

            setError("");

            try {
                const applications =
                    await loadJoinApplications();

                setRecords(
                    applications
                );

                if (selected) {
                    const refreshed =
                        applications.find(
                            (
                                item
                            ) =>
                                item.id ===
                                selected.id
                        );

                    if (refreshed) {
                        setSelected(
                            refreshed
                        );

                        setNotesDraft(
                            refreshed.notes
                        );
                    }
                }
            } catch (
                loadError
            ) {
                console.error(
                    "Unable to load Join Us enquiries:",
                    loadError
                );

                setError(
                    "Unable to load Join Us enquiries."
                );
            } finally {
                setLoading(
                    false
                );
            }
        };

    useEffect(
        () => {
            void load();
        },
        []
    );

    const visibleRecords =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) => {
                        if (
                            sectionFilter !==
                                "all" &&
                            record.section !==
                                sectionFilter
                        ) {
                            return false;
                        }

                        if (
                            statusFilter !==
                                "all" &&
                            record.status !==
                                statusFilter
                        ) {
                            return false;
                        }

                        const query =
                            search
                                .trim()
                                .toLowerCase();

                        if (!query) {
                            return true;
                        }

                        return [
                            record.childName,
                            record.parentName,
                            record.emailAddress,
                            record.mobileNumber,
                            record.section,
                            record.status,
                            record.notes,
                            JSON.stringify(
                                record.contactHistory
                            )
                        ]
                            .join(
                                " "
                            )
                            .toLowerCase()
                            .includes(
                                query
                            );
                    }
                ),
            [
                records,
                sectionFilter,
                statusFilter,
                search
            ]
        );

    const waitingListRecords =
        useMemo(
            () => {
                const query =
                    waitingSearch
                        .trim()
                        .toLowerCase();

                const filtered =
                    records.filter(
                        (
                            record
                        ) => {
                            if (
                                record.status !==
                                "waiting-list"
                            ) {
                                return false;
                            }

                            if (
                                waitingSectionFilter !==
                                    "all" &&
                                record.section !==
                                    waitingSectionFilter
                            ) {
                                return false;
                            }

                            if (!query) {
                                return true;
                            }

                            return [
                                record.childName,
                                record.parentName,
                                record.emailAddress,
                                record.mobileNumber,
                                record.section,
                                record.notes
                            ]
                                .join(
                                    " "
                                )
                                .toLowerCase()
                                .includes(
                                    query
                                );
                        }
                    );

                return [
                    ...filtered
                ].sort(
                    (
                        left,
                        right
                    ) => {
                        if (
                            waitingSort ===
                            "name"
                        ) {
                            return left.childName.localeCompare(
                                right.childName
                            );
                        }

                        const leftTime =
                            left.submittedAt?.getTime() ??
                            0;

                        const rightTime =
                            right.submittedAt?.getTime() ??
                            0;

                        if (
                            waitingSort ===
                            "newest"
                        ) {
                            return (
                                rightTime -
                                leftTime
                            );
                        }

                        return (
                            leftTime -
                            rightTime
                        );
                    }
                );
            },
            [
                records,
                waitingSectionFilter,
                waitingSearch,
                waitingSort
            ]
        );

    const totals =
        useMemo(
            () =>
                statuses.reduce(
                    (
                        current,
                        status
                    ) => ({
                        ...current,
                        [status]:
                            records.filter(
                                (
                                    record
                                ) =>
                                    record.status ===
                                    status
                            ).length
                    }),
                    {} as Record<
                        JoinStatus,
                        number
                    >
                ),
            [
                records
            ]
        );

    const waitingCountsBySection =
        useMemo(
            () =>
                sections
                    .filter(
                        (
                            section
                        ) =>
                            section !==
                            "all"
                    )
                    .map(
                        (
                            section
                        ) => ({
                            section,
                            count:
                                records.filter(
                                    (
                                        record
                                    ) =>
                                        record.status ===
                                            "waiting-list" &&
                                        record.section ===
                                            section
                                ).length
                        })
                    ),
            [
                records
            ]
        );

    const openRecord = (
        record: JoinApplicationRecord
    ) => {
        setSelected(
            record
        );

        setNotesDraft(
            record.notes
        );

        setContactNote("");
        setContactMethod(
            "phone"
        );

        setError("");
        setMessage("");
    };

    const changeStatus =
        async (
            status: JoinStatus
        ) => {
            if (!selected) {
                return;
            }

            setSaving(
                true
            );

            setError("");
            setMessage("");

            try {
                await updateJoinStatus(
                    selected.id,
                    status
                );

                setSelected({
                    ...selected,
                    status
                });

                setRecords(
                    (
                        current
                    ) =>
                        current.map(
                            (
                                item
                            ) =>
                                item.id ===
                                    selected.id
                                    ? {
                                          ...item,
                                          status
                                      }
                                    : item
                        )
                );

                setMessage(
                    "Status updated."
                );
            } catch (
                statusError
            ) {
                console.error(
                    "Unable to update Join Us status:",
                    statusError
                );

                setError(
                    "Unable to update the enquiry status."
                );
            } finally {
                setSaving(
                    false
                );
            }
        };

    const saveNotes =
        async () => {
            if (!selected) {
                return;
            }

            setSaving(
                true
            );

            setError("");
            setMessage("");

            try {
                await updateJoinNotes(
                    selected.id,
                    notesDraft
                );

                const updated = {
                    ...selected,
                    notes:
                        notesDraft
                };

                setSelected(
                    updated
                );

                setRecords(
                    (
                        current
                    ) =>
                        current.map(
                            (
                                item
                            ) =>
                                item.id ===
                                selected.id
                                    ? updated
                                    : item
                        )
                );

                setMessage(
                    "Leader notes saved."
                );
            } catch (
                notesError
            ) {
                console.error(
                    "Unable to save leader notes:",
                    notesError
                );

                setError(
                    "Unable to save leader notes."
                );
            } finally {
                setSaving(
                    false
                );
            }
        };

    const addContact =
        async () => {
            if (
                !selected ||
                !contactNote.trim()
            ) {
                setError(
                    "Enter a note describing the contact."
                );

                return;
            }

            setSaving(
                true
            );

            setError("");
            setMessage("");

            try {
                await addContactHistoryEntry(
                    selected,
                    contactMethod,
                    contactNote
                );

                setContactNote("");

                await load();

                setMessage(
                    "Contact history updated."
                );
            } catch (
                contactError
            ) {
                console.error(
                    "Unable to add contact history:",
                    contactError
                );

                setError(
                    "Unable to add the contact-history entry."
                );
            } finally {
                setSaving(
                    false
                );
            }
        };

    const convertToMember =
        async () => {
            if (!selected) {
                return;
            }

            if (
                !window.confirm(
                    `Create a member record for ${selected.childName}?`
                )
            ) {
                return;
            }

            setSaving(
                true
            );

            setError("");
            setMessage("");

            try {
                const memberId =
                    await convertJoinApplicationToMember(
                        selected
                    );

                const updated = {
                    ...selected,
                    memberId
                };

                setSelected(
                    updated
                );

                setRecords(
                    (
                        current
                    ) =>
                        current.map(
                            (
                                item
                            ) =>
                                item.id ===
                                selected.id
                                    ? updated
                                    : item
                        )
                );

                setMessage(
                    "Member record created successfully."
                );
            } catch (
                conversionError
            ) {
                console.error(
                    "Unable to convert enquiry to member:",
                    conversionError
                );

                setError(
                    "Unable to create the member record. Ensure the enquiry is Accepted and has not already been converted."
                );
            } finally {
                setSaving(
                    false
                );
            }
        };

    return (
        <Box
            sx={{
                minHeight:
                    "100vh",
                backgroundColor:
                    "background.default",
                py: {
                    xs: 4,
                    md: 6
                }
            }}
        >
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
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
                            display:
                                "flex",
                            flexDirection: {
                                xs: "column",
                                md: "row"
                            },
                            justifyContent:
                                "space-between",
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
                        Join Us Management
                    </Typography>

                            <Typography
                                color="text.secondary"
                                sx={{
                                    mt: 0.5
                                }}
                            >
                                Process joining
                                enquiries, track
                                contacts and manage
                                the waiting list.
                            </Typography>
                        </Box>

                        <Stack
                            direction={{
                                xs: "column",
                                sm: "row"
                            }}
                            spacing={1.5}
                        >
<Button
                                variant="contained"
                                color="success"
                                onClick={() =>
                                    void load()
                                }
                            >
                                Refresh
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                <Box
                    sx={{
                        display:
                            "grid",
                        gridTemplateColumns: {
                            xs: "1fr 1fr",
                            md: "repeat(5, 1fr)"
                        },
                        gap: 2,
                        mb: 3
                    }}
                >
                    {statuses.map(
                        (
                            status
                        ) => (
                            <Paper
                                key={
                                    status
                                }
                                variant="outlined"
                                role="button"
                                tabIndex={0}
                                sx={{
                                    p: 2.5,
                                    textAlign:
                                        "center",
                                    cursor: "pointer",
                                    userSelect: "none",
                                    transition:
                                        "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                                    borderWidth:
                                        (
                                            status === "waiting-list" &&
                                            viewMode === "waiting-list"
                                        ) ||
                                        (
                                            status !== "waiting-list" &&
                                            viewMode === "all" &&
                                            statusFilter === status
                                        )
                                            ? 2
                                            : 1,
                                    borderColor:
                                        (
                                            status === "waiting-list" &&
                                            viewMode === "waiting-list"
                                        ) ||
                                        (
                                            status !== "waiting-list" &&
                                            viewMode === "all" &&
                                            statusFilter === status
                                        )
                                            ? status === "waiting-list"
                                                ? "warning.main"
                                                : "secondary.main"
                                            : "divider",
                                    "&:hover": {
                                        transform:
                                            "translateY(-2px)",
                                        boxShadow: 3
                                    },
                                    "&:focus-visible": {
                                        outline:
                                            "3px solid",
                                        outlineColor:
                                            "primary.main",
                                        outlineOffset:
                                            "2px"
                                    }
                                }}
                                onClick={() => {
                                    if (
                                        status ===
                                        "waiting-list"
                                    ) {
                                        setViewMode(
                                            "waiting-list"
                                        );
                                        setStatusFilter(
                                            "waiting-list"
                                        );
                                        setWaitingSectionFilter(
                                            "all"
                                        );
                                        setWaitingSearch(
                                            ""
                                        );
                                    } else {
                                        setViewMode(
                                            "all"
                                        );
                                        setStatusFilter(
                                            status
                                        );
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key ===
                                            "Enter" ||
                                        event.key ===
                                            " "
                                    ) {
                                        event.preventDefault();

                                        if (
                                            status ===
                                            "waiting-list"
                                        ) {
                                            setViewMode(
                                                "waiting-list"
                                            );
                                            setWaitingSectionFilter(
                                                "all"
                                            );
                                            setWaitingSearch(
                                                ""
                                            );
                                        } else {
                                            setViewMode(
                                                "all"
                                            );
                                            setStatusFilter(
                                                status
                                            );
                                        }
                                    }
                                }}
                            >
                                <Typography
                                    variant="h4"
                                    color="secondary"
                                >
                                    {
                                        totals[
                                            status
                                        ] ??
                                        0
                                    }
                                </Typography>

                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {statusLabel(
                                        status
                                    )}
                                </Typography>
                            </Paper>
                        )
                    )}
                </Box>
{viewMode ===
                "waiting-list" ? (
                    <>
                        <Paper
                            elevation={2}
                            sx={{
                                p: 3,
                                mb: 3,
                                borderLeft:
                                    "6px solid",
                                borderColor:
                                    "warning.main"
                            }}
                        >
                            <Box
                                sx={{
                                    display:
                                        "grid",
                                    gridTemplateColumns:
                                        {
                                            xs: "1fr",
                                            md: "2fr 1fr 1fr"
                                        },
                                    gap: 2
                                }}
                            >
                                <TextField
                                    label="Search waiting list"
                                    value={
                                        waitingSearch
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setWaitingSearch(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Child, parent, email, phone..."
                                />

                                <FormControl>
                                    <InputLabel>
                                        Section
                                    </InputLabel>

                                    <Select
                                        label="Section"
                                        value={
                                            waitingSectionFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setWaitingSectionFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    >
                                        {sections.map(
                                            (
                                                section
                                            ) => (
                                                <MenuItem
                                                    key={
                                                        section
                                                    }
                                                    value={
                                                        section
                                                    }
                                                >
                                                    {section ===
                                                    "all"
                                                        ? "All Sections"
                                                        : section}
                                                </MenuItem>
                                            )
                                        )}
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>
                                        Sort
                                    </InputLabel>

                                    <Select
                                        label="Sort"
                                        value={
                                            waitingSort
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setWaitingSort(
                                                event
                                                    .target
                                                    .value as WaitingSort
                                            )
                                        }
                                    >
                                        <MenuItem
                                            value="oldest"
                                        >
                                            Oldest First
                                        </MenuItem>

                                        <MenuItem
                                            value="newest"
                                        >
                                            Newest First
                                        </MenuItem>

                                        <MenuItem
                                            value="name"
                                        >
                                            Name A-Z
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </Paper>

                        <Box
                            sx={{
                                display:
                                    "grid",
                                gridTemplateColumns:
                                    {
                                        xs: "1fr 1fr",
                                        md: "repeat(5, 1fr)"
                                    },
                                gap: 2,
                                mb: 3
                            }}
                        >
                            {waitingCountsBySection.map(
                                (
                                    item
                                ) => (
                                    <Paper
                                        key={
                                            item.section
                                        }
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            textAlign:
                                                "center",
                                            cursor:
                                                "pointer",
                                            borderColor:
                                                waitingSectionFilter ===
                                                item.section
                                                    ? "warning.main"
                                                    : "divider",
                                            borderWidth:
                                                waitingSectionFilter ===
                                                item.section
                                                    ? 2
                                                    : 1
                                        }}
                                        onClick={() =>
                                            setWaitingSectionFilter(
                                                item.section
                                            )
                                        }
                                    >
                                        <Typography
                                            variant="h5"
                                            color="secondary"
                                        >
                                            {
                                                item.count
                                            }
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {
                                                item.section
                                            }
                                        </Typography>
                                    </Paper>
                                )
                            )}
                        </Box>

                        {waitingListRecords.length ===
                        0 ? (
                            <Alert
                                severity="info"
                            >
                                No applicants match
                                the current waiting
                                list filters.
                            </Alert>
                        ) : (
                            <Box
                                sx={{
                                    display:
                                        "grid",
                                    gap: 2
                                }}
                            >
                                {waitingListRecords.map(
                                    (
                                        record,
                                        index
                                    ) => (
                                        <Paper
                                            key={
                                                record.id
                                            }
                                            variant="outlined"
                                            sx={{
                                                p: 2.5,
                                                borderLeft:
                                                    "6px solid",
                                                borderColor:
                                                    "warning.main"
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display:
                                                        "flex",
                                                    flexDirection:
                                                        {
                                                            xs: "column",
                                                            md: "row"
                                                        },
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 2
                                                }}
                                            >
                                                <Box>
                                                    <Stack
                                                        direction="row"
                                                        spacing={
                                                            1
                                                        }
                                                        sx={{
                                                            alignItems:
                                                                "center",
                                                            flexWrap:
                                                                "wrap",
                                                            rowGap:
                                                                1
                                                        }}
                                                    >
                                                        <Chip
                                                            label={`#${index + 1}`}
                                                            color="warning"
                                                            size="small"
                                                        />

                                                        <Typography
                                                            variant="h5"
                                                            color="secondary"
                                                        >
                                                            {
                                                                record.childName
                                                            }
                                                        </Typography>

                                                        {record.section && (
                                                            <Chip
                                                                label={
                                                                    record.section
                                                                }
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        )}
                                                    </Stack>

                                                    <Typography
                                                        sx={{
                                                            mt: 1
                                                        }}
                                                    >
                                                        Parent /
                                                        Guardian:{" "}
                                                        {
                                                            record.parentName ||
                                                            "Not provided"
                                                        }
                                                    </Typography>

                                                    <Typography
                                                        sx={{
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        Phone:{" "}
                                                        {
                                                            record.mobileNumber ||
                                                            "Not provided"
                                                        }
                                                    </Typography>

                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        Joined waiting
                                                        list from
                                                        enquiry
                                                        submitted{" "}
                                                        {formatDate(
                                                            record.submittedAt
                                                        )}
                                                    </Typography>
                                                </Box>

                                                <Button
                                                    variant="contained"
                                                    color="warning"
                                                    onClick={() =>
                                                        openRecord(
                                                            record
                                                        )
                                                    }
                                                >
                                                    Manage
                                                </Button>
                                            </Box>
                                        </Paper>
                                    )
                                )}
                            </Box>
                        )}
                    </>
                ) : (
                    <>
                        <Paper
                            elevation={2}
                            sx={{
                                p: 3,
                                mb: 3
                            }}
                        >
                            <Box
                                sx={{
                                    display:
                                        "grid",
                                    gridTemplateColumns:
                                        {
                                            xs: "1fr",
                                            md: "2fr 1fr 1fr"
                                        },
                                    gap: 2
                                }}
                            >
                                <TextField
                                    label="Search enquiries"
                                    value={
                                        search
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setSearch(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Child, parent, email, phone..."
                                />

                                <FormControl>
                                    <InputLabel>
                                        Section
                                    </InputLabel>

                                    <Select
                                        label="Section"
                                        value={
                                            sectionFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setSectionFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    >
                                        {sections.map(
                                            (
                                                section
                                            ) => (
                                                <MenuItem
                                                    key={
                                                        section
                                                    }
                                                    value={
                                                        section
                                                    }
                                                >
                                                    {section ===
                                                    "all"
                                                        ? "All Sections"
                                                        : section}
                                                </MenuItem>
                                            )
                                        )}
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>
                                        Status
                                    </InputLabel>

                                    <Select
                                        label="Status"
                                        value={
                                            statusFilter
                                        }
                                        onChange={(
                                            event
                                        ) => {
                                            const nextStatus =
                                                event.target.value as
                                                    | JoinStatus
                                                    | "all";

                                            setStatusFilter(
                                                nextStatus
                                            );

                                            if (
                                                nextStatus ===
                                                "waiting-list"
                                            ) {
                                                setViewMode(
                                                    "waiting-list"
                                                );
                                                setWaitingSectionFilter(
                                                    "all"
                                                );
                                                setWaitingSearch(
                                                    ""
                                                );
                                            } else {
                                                setViewMode(
                                                    "all"
                                                );
                                            }
                                        }}
                                    >
                                        <MenuItem
                                            value="all"
                                        >
                                            All Statuses
                                        </MenuItem>

                                        {statuses.map(
                                            (
                                                status
                                            ) => (
                                                <MenuItem
                                                    key={
                                                        status
                                                    }
                                                    value={
                                                        status
                                                    }
                                                >
                                                    {statusLabel(
                                                        status
                                                    )}
                                                </MenuItem>
                                            )
                                        )}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Paper>

                        {error && (
                            <Alert
                                severity="error"
                                sx={{
                                    mb: 3
                                }}
                            >
                                {error}
                            </Alert>
                        )}

                        {message && (
                            <Alert
                                severity="success"
                                sx={{
                                    mb: 3
                                }}
                            >
                                {message}
                            </Alert>
                        )}

                        {loading ? (
                            <Box
                                sx={{
                                    minHeight:
                                        300,
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center"
                                }}
                            >
                                <CircularProgress
                                    color="success"
                                />
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    display:
                                        "grid",
                                    gap: 2
                                }}
                            >
                                {visibleRecords.length ===
                                    0 && (
                                    <Alert
                                        severity="info"
                                    >
                                        No Join Us
                                        enquiries match
                                        the current
                                        filters.
                                    </Alert>
                                )}

                                {visibleRecords.map(
                                    (
                                        record
                                    ) => (
                                        <Paper
                                            key={
                                                record.id
                                            }
                                            variant="outlined"
                                            sx={{
                                                p: 2.5
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display:
                                                        "flex",
                                                    flexDirection:
                                                        {
                                                            xs: "column",
                                                            md: "row"
                                                        },
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 2
                                                }}
                                            >
                                                <Box>
                                                    <Stack
                                                        direction="row"
                                                        spacing={
                                                            1
                                                        }
                                                        sx={{
                                                            alignItems:
                                                                "center",
                                                            flexWrap:
                                                                "wrap",
                                                            rowGap:
                                                                1
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="h5"
                                                            color="secondary"
                                                        >
                                                            {
                                                                record.childName
                                                            }
                                                        </Typography>

                                                        <Chip
                                                            label={
                                                                statusLabel(
                                                                    record.status
                                                                )
                                                            }
                                                            color={
                                                                statusColor(
                                                                    record.status
                                                                )
                                                            }
                                                            size="small"
                                                        />

                                                        {record.section && (
                                                            <Chip
                                                                label={
                                                                    record.section
                                                                }
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        )}

                                                        {record.memberId && (
                                                            <Chip
                                                                label="Member Created"
                                                                color="success"
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        )}
                                                    </Stack>

                                                    <Typography
                                                        sx={{
                                                            mt: 1
                                                        }}
                                                    >
                                                        Parent /
                                                        Guardian:{" "}
                                                        {
                                                            record.parentName ||
                                                            "Not provided"
                                                        }
                                                    </Typography>

                                                    <Typography
                                                        sx={{
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        Phone:{" "}
                                                        {
                                                            record.mobileNumber ||
                                                            "Not provided"
                                                        }
                                                    </Typography>

                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        Submitted{" "}
                                                        {formatDate(
                                                            record.submittedAt
                                                        )}
                                                    </Typography>
                                                </Box>

                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    onClick={() =>
                                                        openRecord(
                                                            record
                                                        )
                                                    }
                                                >
                                                    Manage
                                                </Button>
                                            </Box>
                                        </Paper>
                                    )
                                )}
                            </Box>
                        )}
                    </>
                )}

                <Dialog
                    open={
                        Boolean(
                            selected
                        )
                    }
                    onClose={() =>
                        setSelected(
                            null
                        )
                    }
                    maxWidth="md"
                    fullWidth
                >
                    {selected && (
                        <>
                            <DialogTitle>
                                Manage Enquiry —{" "}
                                {
                                    selected.childName
                                }
                            </DialogTitle>

                            <DialogContent
                                dividers
                            >
                                {error && (
                                    <Alert
                                        severity="error"
                                        sx={{
                                            mb: 2
                                        }}
                                    >
                                        {error}
                                    </Alert>
                                )}

                                {message && (
                                    <Alert
                                        severity="success"
                                        sx={{
                                            mb: 2
                                        }}
                                    >
                                        {message}
                                    </Alert>
                                )}

                                <Typography
                                    variant="h6"
                                    color="secondary"
                                >
                                    Applicant
                                </Typography>

                                <Box
                                    sx={{
                                        display:
                                            "grid",
                                        gridTemplateColumns:
                                            {
                                                xs: "1fr",
                                                sm: "1fr 1fr"
                                            },
                                        gap: 2,
                                        mt: 2
                                    }}
                                >
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            CHILD
                                        </Typography>

                                        <Typography
                                            sx={{
                                                fontWeight:
                                                    700
                                            }}
                                        >
                                            {
                                                selected.childName
                                            }
                                        </Typography>
                                    </Paper>

                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            SECTION
                                        </Typography>

                                        <Typography
                                            sx={{
                                                fontWeight:
                                                    700
                                            }}
                                        >
                                            {
                                                selected.section ||
                                                "Not provided"
                                            }
                                        </Typography>
                                    </Paper>

                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            PARENT /
                                            GUARDIAN
                                        </Typography>

                                        <Typography
                                            sx={{
                                                fontWeight:
                                                    700
                                            }}
                                        >
                                            {
                                                selected.parentName ||
                                                "Not provided"
                                            }
                                        </Typography>
                                    </Paper>

                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            CONTACT
                                        </Typography>

                                        <Typography>
                                            {
                                                selected.mobileNumber ||
                                                "No phone"
                                            }
                                        </Typography>

                                        <Typography>
                                            {
                                                selected.emailAddress ||
                                                "No email"
                                            }
                                        </Typography>
                                    </Paper>
                                </Box>

                                <Divider
                                    sx={{
                                        my: 3
                                    }}
                                />

                                <Typography
                                    variant="h6"
                                    color="secondary"
                                    sx={{
                                        mb: 2
                                    }}
                                >
                                    Workflow Status
                                </Typography>

                                <FormControl
                                    fullWidth
                                >
                                    <InputLabel>
                                        Status
                                    </InputLabel>

                                    <Select
                                        label="Status"
                                        value={
                                            selected.status
                                        }
                                        disabled={
                                            saving
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            void changeStatus(
                                                event
                                                    .target
                                                    .value as JoinStatus
                                            )
                                        }
                                    >
                                        {statuses.map(
                                            (
                                                status
                                            ) => (
                                                <MenuItem
                                                    key={
                                                        status
                                                    }
                                                    value={
                                                        status
                                                    }
                                                >
                                                    {statusLabel(
                                                        status
                                                    )}
                                                </MenuItem>
                                            )
                                        )}
                                    </Select>
                                </FormControl>

                                <Divider
                                    sx={{
                                        my: 3
                                    }}
                                />

                                <Typography
                                    variant="h6"
                                    color="secondary"
                                >
                                    Leader Notes
                                </Typography>

                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={4}
                                    value={
                                        notesDraft
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setNotesDraft(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Internal notes about this joining enquiry..."
                                    sx={{
                                        mt: 2
                                    }}
                                />

                                <Box
                                    sx={{
                                        display:
                                            "flex",
                                        justifyContent:
                                            "flex-end",
                                        mt: 1.5
                                    }}
                                >
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        disabled={
                                            saving
                                        }
                                        onClick={() =>
                                            void saveNotes()
                                        }
                                    >
                                        Save Notes
                                    </Button>
                                </Box>

                                <Divider
                                    sx={{
                                        my: 3
                                    }}
                                />

                                <Typography
                                    variant="h6"
                                    color="secondary"
                                >
                                    Contact History
                                </Typography>

                                <Box
                                    sx={{
                                        display:
                                            "grid",
                                        gridTemplateColumns:
                                            {
                                                xs: "1fr",
                                                sm: "180px 1fr"
                                            },
                                        gap: 2,
                                        mt: 2
                                    }}
                                >
                                    <FormControl>
                                        <InputLabel>
                                            Method
                                        </InputLabel>

                                        <Select
                                            label="Method"
                                            value={
                                                contactMethod
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setContactMethod(
                                                    event
                                                        .target
                                                        .value as ContactMethod
                                                )
                                            }
                                        >
                                            {contactMethods.map(
                                                (
                                                    method
                                                ) => (
                                                    <MenuItem
                                                        key={
                                                            method.value
                                                        }
                                                        value={
                                                            method.value
                                                        }
                                                    >
                                                        {
                                                            method.label
                                                        }
                                                    </MenuItem>
                                                )
                                            )}
                                        </Select>
                                    </FormControl>

                                    <TextField
                                        label="Contact note"
                                        value={
                                            contactNote
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setContactNote(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    />
                                </Box>

                                <Box
                                    sx={{
                                        display:
                                            "flex",
                                        justifyContent:
                                            "flex-end",
                                        mt: 1.5
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        color="success"
                                        disabled={
                                            saving
                                        }
                                        onClick={() =>
                                            void addContact()
                                        }
                                    >
                                        Add Contact
                                    </Button>
                                </Box>

                                <Box
                                    sx={{
                                        display:
                                            "grid",
                                        gap: 1.5,
                                        mt: 2
                                    }}
                                >
                                    {selected.contactHistory.length ===
                                    0 ? (
                                        <Typography
                                            color="text.secondary"
                                        >
                                            No contact
                                            history recorded.
                                        </Typography>
                                    ) : (
                                        [
                                            ...selected.contactHistory
                                        ]
                                            .reverse()
                                            .map(
                                                (
                                                    entry
                                                ) => (
                                                    <Paper
                                                        key={
                                                            entry.id
                                                        }
                                                        variant="outlined"
                                                        sx={{
                                                            p: 2
                                                        }}
                                                    >
                                                        <Stack
                                                            direction="row"
                                                            spacing={
                                                                1
                                                            }
                                                            sx={{
                                                                alignItems:
                                                                    "center",
                                                                flexWrap:
                                                                    "wrap"
                                                            }}
                                                        >
                                                            <Chip
                                                                label={
                                                                    contactMethods.find(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            item.value ===
                                                                            entry.method
                                                                    )
                                                                        ?.label ??
                                                                    entry.method
                                                                }
                                                                size="small"
                                                                variant="outlined"
                                                            />

                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                {entry.date
                                                                    ? new Date(
                                                                          entry.date
                                                                      ).toLocaleString(
                                                                          "en-IE"
                                                                      )
                                                                    : "Unknown date"}
                                                            </Typography>
                                                        </Stack>

                                                        <Typography
                                                            sx={{
                                                                mt: 1
                                                            }}
                                                        >
                                                            {
                                                                entry.note
                                                            }
                                                        </Typography>
                                                    </Paper>
                                                )
                                            )
                                    )}
                                </Box>

                                <Divider
                                    sx={{
                                        my: 3
                                    }}
                                />

                                <Typography
                                    variant="h6"
                                    color="secondary"
                                    sx={{
                                        mb: 2
                                    }}
                                >
                                    Member Creation
                                </Typography>

                                {selected.memberId ? (
                                    <Alert
                                        severity="success"
                                    >
                                        This enquiry
                                        has already
                                        been converted
                                        to a member
                                        record.
                                    </Alert>
                                ) : selected.status ===
                                  "accepted" ? (
                                    <Alert
                                        severity="info"
                                        action={
                                            <Button
                                                color="inherit"
                                                size="small"
                                                disabled={
                                                    saving
                                                }
                                                onClick={() =>
                                                    void convertToMember()
                                                }
                                            >
                                                Create Member
                                            </Button>
                                        }
                                    >
                                        This enquiry is
                                        accepted and is
                                        ready to become a
                                        member record.
                                    </Alert>
                                ) : (
                                    <Alert
                                        severity="warning"
                                    >
                                        Set the enquiry
                                        status to Accepted
                                        before creating a
                                        member record.
                                    </Alert>
                                )}
                            </DialogContent>

                            <DialogActions>
                                <Button
                                    onClick={() =>
                                        setSelected(
                                            null
                                        )
                                    }
                                >
                                    Close
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </Dialog>
            </Container>
        </Box>
    );
}








