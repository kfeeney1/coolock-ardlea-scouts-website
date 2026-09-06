import { Alert, Box, Checkbox, FormControlLabel, Paper, Stack, Typography } from "@mui/material";

import type { AdventureSkillStage } from "../../data/adventureSkills/index.ts";
import { draftSelectionState } from "../../services/adventureSkillDraftLogic.ts";
import { requirementProvenance } from "../../services/adventureSkillAwardLogic.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { requirementSelectionState } from "../../services/adventureSkillSelectionLogic.ts";
import { sourceBacklink, sourceLabel } from "../../services/adventureSkillSourceContext.ts";

type Props = {
  disabled: boolean;
  draft: ReadonlyMap<string, boolean>;
  onRequirementChange: (requirementId: string, completed: boolean) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  selectedMemberIds: readonly string[];
  stage?: AdventureSkillStage;
  unsavedChangeCount: number;
};

const displayDate = (value: Date | null) => value ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(value) : "Date pending";

export default function BadgeworkGroupCompetencyControls({ disabled, draft, onRequirementChange, progressByMemberId, selectedMemberIds, stage, unsavedChangeCount }: Props) {
  const singleProgress = selectedMemberIds.length === 1 ? progressByMemberId.get(selectedMemberIds[0]) : undefined;
  return <>
    {unsavedChangeCount > 0 && <Alert severity="warning" sx={{ mb: 2 }}>You have {unsavedChangeCount} unsaved badgework {unsavedChangeCount === 1 ? "change" : "changes"}. Review the individual and group competency changes, then save.</Alert>}
    <Typography sx={{ fontWeight: 800, mb: 1 }}>Group competency changes</Typography>
    <Stack spacing={1.25}>{stage?.requirements.map((requirement) => {
      const persistedState = requirementSelectionState(selectedMemberIds, progressByMemberId, requirement.id);
      const state = draftSelectionState(draft, requirement.id, persistedState);
      const changed = draft.has(requirement.id);
      const provenance = selectedMemberIds.length === 1 ? requirementProvenance(singleProgress, requirement.id) : null;
      return <Paper key={requirement.id} variant="outlined" sx={{ p: 1.5 }}><FormControlLabel disabled={disabled} sx={{ m: 0, width: "100%", alignItems: "flex-start" }} control={<Checkbox checked={state === "all"} indeterminate={state === "some"} onChange={(_, checked) => onRequirementChange(requirement.id, checked)} />} label={<Box sx={{ pt: .6 }}>
        <Typography>{requirement.statement}</Typography>
        {changed && <Typography variant="caption" color="warning.dark" sx={{ display: "block", fontWeight: 700 }}>Unsaved group change</Typography>}
        {requirement.sharedCompetencyKey && <Typography variant="caption" color="success.dark" sx={{ display: "block", fontWeight: 700 }}>Shared competency · saving this also updates equivalent badgework.</Typography>}
        {state === "some" && <Typography variant="caption" color="warning.dark" sx={{ display: "block" }}>Completed by some selected children. Tick to complete for all selected children.</Typography>}
        {provenance && !changed && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }} data-testid={`provenance-${requirement.id}`}>Completed {displayDate(provenance.completedAt)} · {sourceLabel(provenance.sourceType)}{provenance.sourceId && provenance.sourceType !== "manual" && provenance.sourceType !== "migration" ? <> · <a href={sourceBacklink(provenance.sourceType, provenance.sourceId)}>View source</a></> : null}</Typography>}
      </Box>} /></Paper>;
    })}</Stack>
    {selectedMemberIds.length > 1 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Completion source details are shown when one child is selected, so provenance is never attributed ambiguously across a group.</Typography>}
  </>;
}
