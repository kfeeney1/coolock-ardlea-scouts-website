# Medical information presentation hierarchy (SW-136)

The authorised medical experience uses the canonical consent record. Stored consent records are not reordered, migrated or duplicated.

## Emergency quick view

The read-only **Quick Medical Information** page is the operational incident view. It presents, in deterministic order:

1. **Member identity** — member name and recorded section.
2. **Medical conditions / critical information** — populated canonical medical-warning and ongoing-condition fields.
3. **Medication** — medicine name plus the essential recorded dose, frequency, method, self-administration and instruction fields.
4. **Parents / guardians** — recorded parent/guardian or alternate-contact names with telephone numbers.

Empty values do not reserve space. The page does not infer clinical severity and does not expose edit controls. It uses the existing protected consent read path, so existing leader/section RBAC and Firestore rules remain authoritative.

## Full consent / medical record

The full administrative view remains available separately. Its medical presentation order is:

1. **Immediate warnings and emergency action**: `seriousIllness`, `medAllergies`, `allergies`, `epilepsy`, `diabetes`, `asthma`, `heartDisease`, `skinAllergies`.
2. **Medication administration**: `regularMeds`, `onMedication`, followed by the structured `medicationManagement` record.
3. **Parents / guardians**: `parent1Name`, `mobile1`, `homePhone`, `workPhone`, `parent2Name`, `mobile2`, `altContactName`, `altContactPhone`.
4. **Ongoing conditions and support**: `dietaryReqs`, `medicalFurtherInfo`, `hearingDifficulties`, `highBloodPressure`, `additionalInfo`.
5. **Supporting and administrative information**: `gpName`, `gpTel`, `gpAddress`, `lastCheckup`, `vaccinated`.

Unknown legacy scalar fields retain a neutral supporting placement. Object values are never rendered raw. A future schema field must be deliberately assigned before it is treated as urgent.

Navigation into either medical view carries an explicit semantic return target where an operational origin exists. Direct/deep-link entry falls back to the appropriate module list rather than manufacturing browser history.
