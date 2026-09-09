# SW-31 Windows ADC note

On Windows, the Google Cloud CLI is exposed through the `gcloud.cmd` launcher. The controlled member-import dry-run therefore resolves `gcloud.cmd` on `win32` and `gcloud` on other platforms before requesting an Application Default Credentials access token.

This is a dry-run authentication compatibility fix only. It does not change the reviewed project confirmation, aggregate-only logging, service-account mutation requirement, backup gates, conflict blocking, rollback provenance checks, or production write controls.
