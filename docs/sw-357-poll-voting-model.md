# Dashboard poll voting decisions

SW-357 uses the following voting model:

- Poll answers are **single choice**. Each poll has two to eight distinct options.
- The voting unit is one authenticated account per poll. A leader account can submit one response to a leader poll. A parent poll allows one response per approved parent account, regardless of how many linked children or guardians are in the family.
- A respondent may change their selected answer while the poll remains open. The response document is keyed by the authenticated account ID, so another account cannot create a second response for that person.
- A poll is open only while its status is published and before its optional closing timestamp. Closing it manually or reaching the timestamp rejects new and changed responses.
- Results are aggregate option counts and are visible to authorised poll managers only, both while the poll is open and after it closes. Respondents can read their own saved response; they cannot read other response records or aggregate results, including through direct Firestore access.
- Any active leader may create and publish a section poll limited to sections in their leader profile. Active leaders may manage polls for sections in their assigned scope. Group-wide creation and management require an admin/super-admin or Group Leader/Deputy Group Leader.
- Parent eligibility is based on an approved account with at least one currently active linked member in a targeted section. For a group-wide poll, all canonical programme sections are included. A parent account appears once even when multiple linked children or sections qualify.

Email and WhatsApp distribution are out of scope.