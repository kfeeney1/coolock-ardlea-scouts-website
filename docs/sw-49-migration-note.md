# SW-49 migration compatibility

SW-49 performs no production data mutation. Existing Deputy Group Leader aliases are accepted at authorization boundaries for continuity, and deterministic test data writes only the canonical `Deputy Group Leader` value.

Any future production normalization must first run as a dry-run audit producing an explicit manifest of affected records. Applying that manifest requires separate owner approval at the final production mutation point.
