# SW-421 Save before sharing

In redesigned Plan, Share programme sits beside Save. Run and Review retain
sharing in More actions. The action saves a frozen meeting snapshot, including
pending leader-attendance writes, before loading canonical completed badgework
and preparing the existing WhatsApp payload. Canonical services and permissions
remain authoritative; no new record format or backend is introduced.

A preview dialog shows saving/preparing state. A WhatsApp anchor appears only
after success and opens from a direct user click, avoiding asynchronous popup
blocking. Failed save or preparation exposes no stale link, retains entered
values, and offers retry. Double activation shares one in-flight operation.
Opening from More actions waits for that menu's history marker to be consumed
before opening the dialog. Closing the preview does not discard saved work.

Read-only users share only their last permitted saved snapshot and perform no
meeting writes. Closed-meeting operational saves keep their existing restricted
service. OFF retains the legacy link experience. Payload generation is shared
between both experiences and contains only the existing public programme and
badgework summary; member names, attendance, uniform, leader details, instructions,
medical incidents and private notes are not added to the outgoing programme.

Unit checks verify complete-save ordering, immutable snapshots, blocked save and
preparation failures, and private-field exclusion. Real emulator browser checks
cover programme and leader-attendance persistence before readiness, duplicate
activation, no automatic popup, stale-record write failure/recovery, offline
blocking, Run/Review More actions, read-only sharing and legacy payload parity.
All rollout, live TEST and PMT evidence gates remain separate. Do not enable
Production from implementation/CI evidence.
