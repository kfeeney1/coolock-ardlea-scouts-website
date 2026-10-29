# SW-553: original Swimming artwork

Replaces the supplier photograph of embroidered badges with the six original
vector badge designs on page 2 of the owner's March 2026 programme guide:
https://scouting360.ie/wp-content/uploads/2026/06/Swimming-Adventure-Skills-1-to-6-20mar2026.pdf

`public/badges/adventure-skills/swimming/source.json` records the PDF SHA-256,
byte size, page, exact outer-frame crop bounds in PDF points, PyMuPDF version,
378px output dimensions and SHA-256/bytes for each PNG. Reproduction: download
and verify the PDF, open page index 1 in that PyMuPDF version, set its cropbox to
each recorded bounds rectangle, and call `get_pixmap` with x/y scale
`378 / rectangle.width` and `378 / rectangle.height`, `alpha=False`. Save as PNG
and reset the cropbox to the mediabox between stages. No drawing, recolouring,
number substitution or generic icons are involved. The PDF's own stage-6 frame
is dark red/maroon; retain it unchanged rather than approximate a brown outline.

The shared mapping now follows the same per-stage PNG path as the other nine
skills. The photograph and source-specific viewport/silhouette code are removed.
All 81 other PNGs are unchanged. Competencies, award eligibility/history, six-stage
boundary, default-off rollout, permissions, parent read-only behaviour and the
compact mobile 3+3+3+1 layout are preserved.

Validation covers source/dimension/checksum uniqueness for all six stages,
original frame pixels at zero/partial/full completion, unsaved/awarded states,
reduced motion, explicit artwork failure/retry, leader and parent views and
mobile stage navigation. Record actual local/CI results in Jira and the PR.
Deployed TEST and Android Production acceptance remain separate and pending.
Manual: inspect Swimming stages 1-6 in leader and linked-parent views, compare
symbols/numerals/frames with PDF page 2, verify partial bottom-to-top fill and
saved counts, earlier awards, stage-7 denial, mobile grid and rollout off.
