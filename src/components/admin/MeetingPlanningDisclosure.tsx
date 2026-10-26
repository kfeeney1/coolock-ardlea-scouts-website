import { Accordion, AccordionDetails, AccordionSummary, Box, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useId, type ReactNode } from "react";

/** Disclosure changes presentation only; editors remain mounted with their original IDs and callbacks. */
export default function MeetingPlanningDisclosure({ enabled, title, summary, initiallyOpen = false, children }: {
  enabled: boolean; title: string; summary?: string; initiallyOpen?: boolean; children: ReactNode;
}) {
  const id = useId();
  if (!enabled) return <>{children}</>;
  return <Accordion defaultExpanded={initiallyOpen} disableGutters elevation={0} slotProps={{ transition: { timeout: 0 } }} sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: "12px !important", "&::before": { display: "none" } }}>
    <AccordionSummary id={`${id}-heading`} aria-controls={`${id}-content`} expandIcon={<ExpandMoreIcon />} sx={{ minHeight: "44px !important", "& .MuiAccordionSummary-content": { minWidth: 0, my: 1 } }}>
      <Box sx={{ minWidth: 0 }}><Typography color="secondary" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{title}</Typography>{summary && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{summary}</Typography>}</Box>
    </AccordionSummary>
    <AccordionDetails id={`${id}-content`} sx={{ minWidth: 0, p: { xs: 1, sm: 2 } }}><Stack spacing={1.5} sx={{minWidth:0}}>{children}</Stack></AccordionDetails>
  </Accordion>;
}
