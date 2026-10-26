# SW-420 Compact Plan

Redesigned Plan uses theme-aware, keyboard-accessible disclosures. Populated
activity/badgework rows show their name, duration and leaders; empty new rows
open immediately for entry. Each editor keeps the original stable row ID,
canonical callback and fields. Collapsing or changing Plan/Run/Review does not
unmount an editor or replace its entered values.

Meeting details start open for continuity and can be collapsed. Programme notes
start open when already populated. Programme library is progressively disclosed;
the equipment planning/reservation action, authoritative total and duration
warning stay outside row disclosures. Activity and badgework records remain
separate. All leader, guest, equipment, duration, instructions, add/remove and
library-insertion controls use existing code and permissions.

OFF continues to render the existing fully expanded planner. Closed meetings
retain planning locks. No data migration, new record format, reservation service
or feature setting is introduced. Existing central meeting rollout/rollback
instructions still apply.

Changed-area validation covers keyboard expansion, 320px wrapping, long content,
all/selected/guest leaders, field retention across stages/save/reload, totals and
warnings, zero/new/library-inserted rows, distinct IDs, equipment access, OFF
presentation and closed locks. Shared shell and existing library regressions
remain part of assurance. CI, deployed TEST acceptance and PMT remain separate.
