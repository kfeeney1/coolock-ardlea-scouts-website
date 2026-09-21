# Medical information presentation hierarchy (SW-136)

The authorised consent-details view uses an explicit presentation definition. Stored consent records are not reordered or migrated.

1. **Immediate warnings and emergency action**: `seriousIllness`, `medAllergies`, `allergies`, and the established Scouter medical flags `epilepsy`, `diabetes`, `asthma`, `heartDisease`, `skinAllergies`.
2. **Medication administration**: `regularMeds`, `onMedication`, followed by the existing `medicationManagement` record. Within medication management, medicine, dosage, frequency, method, self-administration and additional recorded instructions precede supply/authorisation/contact/signature metadata.
3. **Ongoing conditions and support**: `dietaryReqs`, `medicalFurtherInfo`, `hearingDifficulties`, `highBloodPressure`, `additionalInfo`.
4. **Supporting and administrative information**: `gpName`, `gpTel`, `gpAddress`, `lastCheckup`, `vaccinated`.

Unknown legacy scalar fields are retained in a neutral supporting placement. Object values are never rendered raw. A future schema field must be deliberately assigned to a group before it is treated as urgent; clinical severity is not inferred from ambiguous values.

The same broad hierarchy is used by the print view. Existing authentication, section filtering and Firestore rules remain authoritative.
