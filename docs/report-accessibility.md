# Report and generated-document accessibility

## Audit result

The SW-82 repository audit found no application-owned PDF generator, PDF library, `application/pdf` response, or committed PDF report template in the current Scout website. The leader reporting surface currently provides:

- CSV downloads for operational report data;
- an HTML report summary rendered in the normal application; and
- a `Print Summary` action that delegates to the browser's `window.print()` capability.

A user can choose “Save as PDF” in some browsers, but that file is produced by the browser/print driver, not by a PDF generator controlled by this repository. The application therefore cannot guarantee PDF tagging, reading order metadata, document language metadata or viewer behaviour for a browser-generated PDF.

## Accessible source of truth

The accessible source for the printable summary is the HTML leader report page itself. The same operational data is also available in CSV form where an export is provided. HTML remains subject to the site's normal keyboard, semantic and Playwright accessibility regression checks, while CSV remains selectable machine-readable text suitable for spreadsheet/screen-reader workflows.

If a browser-generated PDF is difficult to consume with assistive technology, users should use the HTML report view or corresponding CSV export rather than relying on that generated PDF.

## Report inventory

The current `LeaderReports` surface includes CSV exports for member lists, membership summary, event overview, attendance trends, event attendance/consent roster and outstanding consent. Finance reporting and the shared generated-report download experience also use CSV/text-based exports rather than an application-owned PDF stack.

## Manual assessment

Representative current outputs were assessed at the implementation level:

- **Selectable text:** HTML and CSV are text, not rasterised images.
- **Reading order:** the HTML source follows the page DOM; CSV follows deterministic column/row ordering from the report builders.
- **Document title/language:** the HTML application supplies browser document semantics; CSV does not carry rich document metadata.
- **Heading/table structure:** applicable to the HTML report surface and covered by browser accessibility regression checks; CSV has tabular text columns rather than tagged document structure.
- **Tagged PDF:** not applicable to the current application because it does not create PDFs. Browser print-to-PDF tagging is browser/viewer dependent and is not asserted as conformant.

## Guardrail for future PDF work

A future change that introduces an application-owned PDF generator must not assume visual appearance equals accessibility. Before release it must assess document title/language, selectable text, logical reading order, headings, table semantics, tagging support and an accessible HTML/CSV alternative. SW-82 does not justify adding a PDF library when the current reporting architecture does not need one.
