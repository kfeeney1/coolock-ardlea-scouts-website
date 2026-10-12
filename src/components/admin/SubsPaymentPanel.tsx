import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import type { MemberRecord } from "../../services/memberAdmin";
import { balanceFor, formatEuro, paymentMethodLabel, SUBS_PAYMENT_METHODS, type SubsAssignment, type SubsPayment, type SubsPaymentMethod, type SubsRatePolicy } from "../../services/subsLogic";
import { ALL_AUTHORISED_SECTIONS } from "../../services/subsScope";
import { formatSiteDate } from "../../services/siteDateFormat";

type Props = {
  visibleMembers: MemberRecord[];
  policies: SubsRatePolicy[];
  memberId: string;
  period: string;
  amount: string;
  method: SubsPaymentMethod;
  paymentDate: string;
  note: string;
  selectedAssignment: SubsAssignment | undefined;
  selectedBalance: ReturnType<typeof balanceFor> | null;
  sharedBalanceRestricted: boolean;
  memberPayments: SubsPayment[];
  error: string;
  effectiveSection: string;
  saving: boolean;
  paymentReady: boolean;
  onMemberChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: SubsPaymentMethod) => void;
  onPaymentDateChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onReviewPayment: () => void;
  onExportMember: () => void;
};

/** Payment presentation; authorisation, validation and ledger mutations stay in SubsManagement. */
export default function SubsPaymentPanel({
  visibleMembers, policies, memberId, period, amount, method, paymentDate, note, selectedAssignment, selectedBalance, sharedBalanceRestricted, memberPayments, error, effectiveSection, saving, paymentReady, onMemberChange, onPeriodChange, onAmountChange, onMethodChange, onPaymentDateChange, onNoteChange, onReviewPayment, onExportMember
}: Props) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
              Record a payment
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" },
                gap: 2,
              }}
            >
              <FormControl required>
                <InputLabel id="subs-member-label">Member</InputLabel>
                <Select labelId="subs-member-label" label="Member" value={memberId} onChange={(e) => onMemberChange(e.target.value)} data-testid="subs-member-select">
                  {visibleMembers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.displayName} · {m.section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl required>
                <InputLabel id="subs-period-label">Scout year</InputLabel>
                <Select labelId="subs-period-label" label="Scout year" value={period} onChange={(e) => onPeriodChange(e.target.value)}>
                  {policies.map((p) => (
                    <MenuItem key={p.id} value={p.period}>
                      {p.period}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField required label="Amount (EUR)" value={amount} onChange={(e) => onAmountChange(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
              <FormControl required>
                <InputLabel id="subs-method-label">Payment method</InputLabel>
                <Select labelId="subs-method-label" label="Payment method" value={method} onChange={(e) => onMethodChange(e.target.value as SubsPaymentMethod)}>
                  {SUBS_PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {paymentMethodLabel(m)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField required type="date" label="Payment date" value={paymentDate} onChange={(e) => onPaymentDateChange(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="Note (optional)" value={note} onChange={(e) => onNoteChange(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            </Box>
            {!error && visibleMembers.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No members are available for {effectiveSection === ALL_AUTHORISED_SECTIONS ? "the selected authorised sections" : effectiveSection}.
              </Alert>
            )}
            {selectedAssignment && selectedBalance ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                  <Chip label={`Due ${formatEuro(selectedBalance.dueCents)}`} />
                  <Chip label={`Paid ${formatEuro(selectedBalance.paidCents)}`} />
                  <Chip label={selectedBalance.remainingCents < 0 ? `Credit ${formatEuro(-selectedBalance.remainingCents)}` : `Remaining ${formatEuro(selectedBalance.remainingCents)}`} />
                </Stack>
                {selectedAssignment.accountId && (
                  <Alert severity="info" sx={{ mt: 2 }} data-testid="subs-shared-family-balance">
                    This is the shared family balance for the Scout year. Payments recorded through any member in this family reduce the same balance.
                  </Alert>
                )}
              </>
            ) : sharedBalanceRestricted ? (
              <Alert severity="info" sx={{ mt: 2 }} data-testid="subs-shared-family-private">
                This member belongs to a shared family subs account. You can record a payment for this member, but complete cross-section family details remain restricted to authorised group finance users.
              </Alert>
            ) : (
              memberId && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This member needs an authorised rate classification for the selected Scout year before payment can be recorded.
                </Alert>
              )
            )}
            <Button variant="contained" sx={{ mt: 3, minHeight: 44 }} disabled={saving || !paymentReady} onClick={onReviewPayment}>
              Review payment
            </Button>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ mt: 4, justifyContent: "space-between" }}>
              <Typography variant="h6">Payment history</Typography>
              {selectedAssignment && selectedBalance && (
                <Button variant="outlined" onClick={onExportMember}>
                  Download member CSV
                </Button>
              )}
            </Stack>
            {sharedBalanceRestricted && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Only payments in your authorised scope are shown here; this is not the complete family ledger.
              </Typography>
            )}
            <Stack spacing={1} sx={{ mt: 1 }}>
              {memberPayments.map((p) => (
                <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatSiteDate(p.paymentDate)} · {paymentMethodLabel(p.method)}
                  </Typography>
                  <Typography>
                    {formatEuro(p.amountCents)}
                    {p.reversalOfPaymentId ? " · Correction" : ""}
                  </Typography>
                  {p.note && <Typography color="text.secondary">{p.note}</Typography>}
                </Paper>
              ))}
            </Stack>
          </Paper>
  );
}
