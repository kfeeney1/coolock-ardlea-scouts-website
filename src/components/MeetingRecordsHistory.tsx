import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { openMeetingDocument } from "../services/meetingDocuments";
import type { MeetingRecord, MeetingRecordVersion, MeetingType } from "../services/meetingRecords";
import { formatSiteDate, formatSiteDateTime } from "../services/siteDateFormat";

type Props = {
  redesigned: boolean;
  records: MeetingRecord[];
  loading: boolean;
  isAdmin: boolean;
  editDisabled: boolean;
  canEditRecord: (record: MeetingRecord) => boolean;
  onEdit: (record: MeetingRecord) => void;
  onToggleVersions: (record: MeetingRecord) => void;
  expandedVersionId: string | null;
  versionLoadingId: string | null;
  versionsByMeeting: Record<string, MeetingRecordVersion[]>;
};

function formatMeetingDate(value: string): string {
  if (!value) return "Date not recorded";
  return value.includes("T") ? formatSiteDateTime(value) : formatSiteDate(value);
}

function formatVersionDate(value: Date | null): string {
  return value ? formatSiteDateTime(value) : "Timestamp pending";
}

function meetingTypeLabel(type: MeetingType): string {
  if (type === "group") return "Group Council";
  if (type === "group-leaders") return "Group Leaders Meeting";
  return "Leader Meeting";
}

export default function MeetingRecordsHistory({
  redesigned, records, loading, isAdmin, editDisabled, canEditRecord, onEdit,
  onToggleVersions, expandedVersionId, versionLoadingId, versionsByMeeting
}: Props) {
  return <Paper variant={redesigned ? "outlined" : "elevation"} elevation={redesigned ? 0 : 2} sx={{ minWidth: 0, p: { xs: 2, md: 3 }, overflowWrap: "anywhere" }}>
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Meeting history</Typography>
        {loading ? <Typography color="text.secondary">Loading meeting records...</Typography> : records.length === 0 ? <Alert severity="info">No meeting records have been saved in your permitted scope yet.</Alert> : <Stack spacing={2}>
          {records.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`meeting-record-${record.id}`}>
            <Stack direction={redesigned ? "column" : { xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: redesigned ? "stretch" : { xs: "flex-start", md: "center" } }}>
              <Box>
                <Typography component="h3" variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{record.title}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Chip size="small" label={meetingTypeLabel(record.meetingType)} />
                  <Chip size="small" variant="outlined" label={record.section} />
                  <Chip size="small" variant="outlined" label={formatMeetingDate(record.meetingDate)} />
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44, maxWidth: "100%", overflowWrap: "anywhere", display: "block" } }}>
                {record.attachment && <Button type="button" variant="outlined" onClick={() => void openMeetingDocument(record.attachment!)}>Open {record.attachment.fileName}</Button>}
                {isAdmin && <Button type="button" variant="outlined" aria-expanded={expandedVersionId === record.id} onClick={() => onToggleVersions(record)}>{expandedVersionId === record.id ? "Hide Version History" : "Version History"}</Button>}
                {canEditRecord(record) && <Button variant="outlined" disabled={editDisabled} onClick={() => onEdit(record)}>Edit</Button>}
              </Stack>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2">Attendees</Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>{record.attendees.join(", ")}</Typography>
            {record.notes && <><Typography variant="subtitle2">Minutes</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.notes}</Typography></>}
            {record.decisions && <><Typography variant="subtitle2">Decisions</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.decisions}</Typography></>}
            {record.actions && <><Typography variant="subtitle2">Actions</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{record.actions}</Typography></>}

            {isAdmin && expandedVersionId === record.id && <Box sx={{ mt: 2 }} data-testid={`meeting-version-history-${record.id}`}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Previous versions</Typography>
              {versionLoadingId === record.id ? <Typography color="text.secondary">Loading version history...</Typography> : (versionsByMeeting[record.id]?.length ?? 0) === 0 ? <Alert severity="info">No previous versions have been recorded yet.</Alert> : <Stack spacing={1.5}>
                {versionsByMeeting[record.id].map((version, index) => <Paper key={version.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 800 }}>Previous version {versionsByMeeting[record.id].length - index}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Saved before an edit · {formatVersionDate(version.versionedAt)}</Typography>
                  <Typography variant="subtitle2">Title</Typography>
                  <Typography sx={{ mb: 1 }}>{version.title}</Typography>
                  <Typography variant="subtitle2">Attendees</Typography>
                  <Typography sx={{ mb: 1 }}>{version.attendees.join(", ")}</Typography>
                  {version.notes && <><Typography variant="subtitle2">Minutes</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{version.notes}</Typography></>}
                  {version.decisions && <><Typography variant="subtitle2">Decisions</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{version.decisions}</Typography></>}
                  {version.actions && <><Typography variant="subtitle2">Actions</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{version.actions}</Typography></>}
                </Paper>)}
              </Stack>}
            </Box>}
          </Paper>)}
        </Stack>}
      </Paper>;
}
