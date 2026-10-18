import DatePickerField from "../DatePickerField";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { formatSiteDate } from "../../services/siteDateFormat";
import { initialScheduleId, orderedSchedule, scheduleIdForDate, type ScheduleIdentity } from "../../services/scheduleSelection";

export type ScheduleTile = ScheduleIdentity & { title: string; content: ReactNode; actions: ReactNode };
export default function ScheduleTiles({ items, label, loading = false, error = "", onRetry }: {
  items: ScheduleTile[]; label: string; loading?: boolean; error?: string; onRetry?: () => void;
}) {
  const id = useId();
  const sorted = useMemo(() => orderedSchedule(items), [items]);
  const [selection, setSelection] = useState("");
  const selected = sorted.find((item) => item.id === selection)?.id ?? initialScheduleId(sorted);
  const index = sorted.findIndex((item) => item.id === selected);
  const viewport = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef(0);
  const scrollTarget = useRef<string | null>(null);
  const identity = sorted.map((item) => item.id).join("|");
  useEffect(() => {
    const node = viewport.current;
    if (!node || index < 0) return;
    scrollTarget.current = selected;
    node.scrollTo({ left: index * node.clientWidth, behavior: "instant" });
    scrollTarget.current = null;
  }, [selected, identity, index]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => node.scrollTo({ left: Math.max(0, index) * node.clientWidth, behavior: "instant" }));
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(scrollFrame.current); };
  }, [index]);
  const choose = (next: number) => {
    if (sorted[next]) setSelection(sorted[next].id);
  };
  if (loading) return <Box role="status" sx={{ p: 3 }}><CircularProgress aria-label={`Loading ${label}`} /><Typography>Loading {label}…</Typography></Box>;
  if (error) return <Alert severity="error">{error}{onRetry && <Button onClick={onRetry}>Retry {label}</Button>}</Alert>;
  if (!sorted.length) return <Alert severity="info">No {label} match the current filters.</Alert>;
  return <Stack spacing={2} role="region" aria-label={`${label} schedule`} sx={{ minWidth: 0, "& .MuiIconButton-root": { minWidth: 44, minHeight: 44 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <DatePickerField label={`${label} date`} value={sorted[index]?.date ?? ""} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => { if (event.target.value) setSelection(scheduleIdForDate(sorted, event.target.value)); }} />
      <Stack direction="row" spacing={1}>
        <Button color="secondary" disabled={index <= 0} onClick={() => choose(index - 1)} aria-controls={`${id}-tiles`} sx={{ minHeight: 44 }}>Previous</Button>
        <Button color="secondary" disabled={index === sorted.length - 1} onClick={() => choose(index + 1)} aria-controls={`${id}-tiles`} sx={{ minHeight: 44 }}>Next</Button>
      </Stack>
    </Stack>
    <Typography role="status" aria-live="polite" variant="body2">{index + 1} of {sorted.length} · {formatSiteDate(sorted[index].date)} · {sorted[index].title}</Typography>
    <Box ref={viewport} id={`${id}-tiles`} tabIndex={0} aria-label={`Browse ${label}; use Left and Right arrow keys`} onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        choose(event.key === "Home" ? 0 : event.key === "End" ? sorted.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1));
      }
    }} onScroll={() => {
      if (scrollTarget.current) return;
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        const node = viewport.current;
        if (!node?.clientWidth) return;
        const next = Math.round(node.scrollLeft / node.clientWidth);
        if (sorted[next]) setSelection(sorted[next].id);
      });
    }} sx={{ display: "flex", width: "100%", minWidth: 0, overflowX: "auto", overscrollBehaviorX: "contain", scrollSnapType: "x mandatory", borderRadius: 2, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
      {sorted.map((item) => <Box key={item.id} aria-hidden={selected !== item.id} inert={selected !== item.id} sx={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", p: 0.5, boxSizing: "border-box" }}>
        <Paper component="article" aria-label={item.title} aria-current={selected === item.id ? "true" : undefined} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, borderLeft: "4px solid", borderLeftColor: "secondary.main", overflowWrap: "anywhere" }}>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{item.title}</Typography>
          <Typography sx={{ mt: 1, mb: 2, p: 1, borderRadius: 1, bgcolor: "action.selected" }}>{formatSiteDate(item.date)}{item.endDate && item.endDate !== item.date ? ` – ${formatSiteDate(item.endDate)}` : ""}</Typography>
          {item.content}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 3, "& .MuiButton-root": { minHeight: 44 } }}>{item.actions}</Stack>
        </Paper>
      </Box>)}
    </Box>
  </Stack>;
}
