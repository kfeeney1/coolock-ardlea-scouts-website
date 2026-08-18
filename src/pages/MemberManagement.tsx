import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";

import { useEffect, useMemo, useState } from "react";
import {
  loadMemberConsentSummaries,
  loadMembers,
  updateMember
} from "../services/memberAdmin";

import type {
  MemberConsentSummary,
  MemberRecord,
  MemberStatus
} from "../services/memberAdmin";

import { brandColours } from "../theme/theme";

const sections = [
  "all",
  "Beavers",
  "Cubs",
  "Scouts",
  "Ventures",
  "Rovers",
  "Group",
  "Other"
];

const memberStatuses: MemberStatus[] = [
  "active",
  "inactive",
  "left"
];

function statusLabel(status: MemberStatus): string {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Left";
}

function statusColor(
  status: MemberStatus
): "success" | "warning" | "default" {
  if (status === "active") return "success";
  if (status === "inactive") return "warning";
  return "default";
}

function formatDate(value: Date | null): string {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function consentExpired(consentTo: string): boolean {
  if (!consentTo) return false;

  return (
    consentTo <
    new Date().toISOString().slice(0, 10)
  );
}

export default function MemberManagement() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<MemberStatus | "all">("active");

  const [selected, setSelected] =
    useState<MemberRecord | null>(null);

  const [draft, setDraft] =
    useState<MemberRecord | null>(null);

  const [saving, setSaving] = useState(false);

  const [consents, setConsents] =
    useState<MemberConsentSummary[]>([]);

  const [loadingConsents, setLoadingConsents] =
    useState(false);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      setMembers(await loadMembers());
    } catch (loadError) {
      console.error("Unable to load members:", loadError);
      setError("Unable to load member records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleMembers = useMemo(
    () =>
      members.filter((member) => {
        if (
          sectionFilter !== "all" &&
          member.section !== sectionFilter
        ) {
          return false;
        }

        if (
          statusFilter !== "all" &&
          member.status !== statusFilter
        ) {
          return false;
        }

        const query = search.trim().toLowerCase();

        if (!query) return true;

        return [
          member.displayName,
          member.parentName,
          member.emailAddress,
          member.mobileNumber,
          member.section,
          member.emergencyContactName,
          member.emergencyContactPhone
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [members, sectionFilter, statusFilter, search]
  );

  const counts = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      inactive: members.filter((m) => m.status === "inactive").length,
      left: members.filter((m) => m.status === "left").length
    }),
    [members]
  );

  const openMember = async (member: MemberRecord) => {
    setSelected(member);
    setDraft({ ...member });
    setConsents([]);
    setError("");
    setMessage("");
    setLoadingConsents(true);

    try {
      setConsents(await loadMemberConsentSummaries(member));
    } catch (consentError) {
      console.error(
        "Unable to load linked consents:",
        consentError
      );

      setError(
        "Member loaded, but linked consent records could not be checked."
      );
    } finally {
      setLoadingConsents(false);
    }
  };

  const save = async () => {
    if (!selected || !draft) return;

    if (!draft.displayName.trim()) {
      setError("Member name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateMember(selected.id, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        displayName: draft.displayName,
        dateOfBirth: draft.dateOfBirth,
        section: draft.section,
        parentName: draft.parentName,
        emailAddress: draft.emailAddress,
        mobileNumber: draft.mobileNumber,
        emergencyContactName: draft.emergencyContactName,
        emergencyContactPhone: draft.emergencyContactPhone,
        status: draft.status
      });

      const updated = {
        ...draft,
        id: selected.id
      };

      setMembers((current) =>
        current.map((member) =>
          member.id === selected.id
            ? updated
            : member
        )
      );

      setSelected(updated);
      setDraft(updated);
      setMessage("Member details updated.");
    } catch (saveError) {
      console.error("Unable to save member:", saveError);
      setError("Unable to update the member record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        py: { xs: 4, md: 6 }
      }}
    >
      <Container maxWidth="xl">
                <LeaderDashboardHeader />

        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, md: 4 },
            mb: 3,
            borderTop: `6px solid ${brandColours.navy}`
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              justifyContent: "space-between",
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
                        Member Management
                    </Typography>

              <Typography
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Maintain member records, sections,
                contacts and consent indicators.
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
            >
<Button
                variant="contained"
                color="success"
                onClick={() => void load()}
              >
                Refresh
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr 1fr",
              md: "repeat(4, 1fr)"
            },
            gap: 2,
            mb: 3
          }}
        >
          {[
            ["Total", counts.total],
            ["Active", counts.active],
            ["Inactive", counts.inactive],
            ["Left", counts.left]
          ].map(([label, value]) => (
            <Paper
              key={String(label)}
              variant="outlined"
              sx={{
                p: 2.5,
                textAlign: "center"
              }}
            >
              <Typography variant="h4" color="secondary">
                {value}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                {label}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 3
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "2fr 1fr 1fr"
              },
              gap: 2
            }}
          >
            <TextField
              label="Search members"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Member, parent, phone, email..."
            />

            <FormControl>
              <InputLabel>Section</InputLabel>
              <Select
                label="Section"
                value={sectionFilter}
                onChange={(event) =>
                  setSectionFilter(event.target.value)
                }
              >
                {sections.map((section) => (
                  <MenuItem
                    key={section}
                    value={section}
                  >
                    {section === "all"
                      ? "All Sections"
                      : section}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | MemberStatus
                      | "all"
                  )
                }
              >
                <MenuItem value="all">
                  All Statuses
                </MenuItem>

                {memberStatuses.map((status) => (
                  <MenuItem
                    key={status}
                    value={status}
                  >
                    {statusLabel(status)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <CircularProgress color="success" />
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 2 }}>
            {visibleMembers.length === 0 && (
              <Alert severity="info">
                No members match the current filters.
              </Alert>
            )}

            {visibleMembers.map((member) => (
              <Paper
                key={member.id}
                variant="outlined"
                sx={{ p: 2.5 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: {
                      xs: "column",
                      md: "row"
                    },
                    justifyContent: "space-between",
                    gap: 2
                  }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                        flexWrap: "wrap",
                        rowGap: 1
                      }}
                    >
                      <Typography
                        variant="h5"
                        color="secondary"
                      >
                        {member.displayName}
                      </Typography>

                      <Chip
                        label={statusLabel(member.status)}
                        color={statusColor(member.status)}
                        size="small"
                      />

                      {member.section && (
                        <Chip
                          label={member.section}
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Stack>

                    <Typography sx={{ mt: 1 }}>
                      Parent / Guardian:{" "}
                      {member.parentName || "Not provided"}
                    </Typography>

                    <Typography sx={{ mt: 0.5 }}>
                      Phone:{" "}
                      {member.mobileNumber || "Not provided"}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => void openMember(member)}
                  >
                    Manage
                  </Button>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        <Dialog
          open={Boolean(selected && draft)}
          onClose={() => {
            setSelected(null);
            setDraft(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          {selected && draft && (
            <>
              <DialogTitle>
                Member — {draft.displayName}
              </DialogTitle>

              <DialogContent dividers>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {message && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {message}
                  </Alert>
                )}

                <Typography
                  variant="h5"
                  color="secondary"
                  sx={{ mb: 2 }}
                >
                  Member Details
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "1fr 1fr"
                    },
                    gap: 2
                  }}
                >
                  <TextField
                    label="First name"
                    value={draft.firstName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        firstName: event.target.value
                      })
                    }
                  />

                  <TextField
                    label="Last name"
                    value={draft.lastName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        lastName: event.target.value
                      })
                    }
                  />

                  <TextField
                    required
                    label="Display name"
                    value={draft.displayName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        displayName: event.target.value
                      })
                    }
                  />

                  <TextField
                    type="date"
                    label="Date of birth"
                    value={draft.dateOfBirth}
                    slotProps={{
                      inputLabel: {
                        shrink: true
                      }
                    }}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        dateOfBirth: event.target.value
                      })
                    }
                  />

                  <FormControl>
                    <InputLabel>Section</InputLabel>
                    <Select
                      label="Section"
                      value={draft.section}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          section: event.target.value
                        })
                      }
                    >
                      {sections
                        .filter((section) => section !== "all")
                        .map((section) => (
                          <MenuItem
                            key={section}
                            value={section}
                          >
                            {section}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status:
                            event.target.value as MemberStatus
                        })
                      }
                    >
                      {memberStatuses.map((status) => (
                        <MenuItem
                          key={status}
                          value={status}
                        >
                          {statusLabel(status)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Parent / Guardian"
                    value={draft.parentName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        parentName: event.target.value
                      })
                    }
                  />

                  <TextField
                    label="Parent / Guardian email"
                    value={draft.emailAddress}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        emailAddress: event.target.value
                      })
                    }
                  />

                  <TextField
                    label="Parent / Guardian phone"
                    value={draft.mobileNumber}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        mobileNumber: event.target.value
                      })
                    }
                  />

                  <TextField
                    label="Emergency contact"
                    value={draft.emergencyContactName}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        emergencyContactName:
                          event.target.value
                      })
                    }
                  />

                  <TextField
                    label="Emergency contact phone"
                    value={draft.emergencyContactPhone}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        emergencyContactPhone:
                          event.target.value
                      })
                    }
                  />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: 3
                  }}
                >
                  <Button
                    variant="contained"
                    color="success"
                    disabled={saving}
                    onClick={() => void save()}
                  >
                    {saving ? "Saving..." : "Save Member"}
                  </Button>
                </Box>

                <Box sx={{ mt: 4 }}>
                  <Typography
                    variant="h5"
                    color="secondary"
                  >
                    Consent Records
                  </Typography>

                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5, mb: 2 }}
                  >
                    Matching is currently based on
                    member name and date of birth.
                  </Typography>

                  {loadingConsents ? (
                    <CircularProgress size={28} />
                  ) : consents.length === 0 ? (
                    <Alert severity="warning">
                      No matching consent record was found.
                    </Alert>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.5
                      }}
                    >
                      {consents.map((consent) => (
                        <Paper
                          key={consent.consentId}
                          variant="outlined"
                          sx={{ p: 2 }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              flexWrap: "wrap",
                              alignItems: "center",
                              rowGap: 1
                            }}
                          >
                            <Typography
                              sx={{ fontWeight: 700 }}
                            >
                              Submitted{" "}
                              {formatDate(
                                consent.submittedAt
                              )}
                            </Typography>

                            {consent.hasMedicalAlert && (
                              <Chip
                                label="Medical"
                                color="warning"
                                size="small"
                              />
                            )}

                            {consent.hasMedicationManagement && (
                              <Chip
                                label="Medication"
                                color="error"
                                size="small"
                              />
                            )}

                            {consentExpired(
                              consent.consentTo
                            ) && (
                              <Chip
                                label="Expired"
                                color="error"
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </Stack>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            Consent to:{" "}
                            {consent.consentTo ||
                              "Not specified"}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Box>
              </DialogContent>

              <DialogActions>
                <Button
                  onClick={() => {
                    setSelected(null);
                    setDraft(null);
                  }}
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






