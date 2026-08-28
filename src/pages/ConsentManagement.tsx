import { Alert, Box, Button, Container } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import ConsentDetailDialog from "../components/admin/ConsentDetailDialog";
import ConsentOverviewPanel from "../components/admin/ConsentOverviewPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadConsentAdminRecords } from "../services/consentAdmin";
import type { ConsentAdminRecord } from "../services/consentAdmin";
import { consentRecordPrintHtml, filterConsentRecords } from "../services/consentManagementLogic";
import type { AlertFilter, TypeFilter } from "../services/consentManagementLogic";

export default function ConsentManagement() {
    const [records, setRecords] = useState<ConsentAdminRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
    const [selected, setSelected] = useState<ConsentAdminRecord | null>(null);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            setRecords(await loadConsentAdminRecords());
        } catch (loadError) {
            console.error("Unable to load consent management records:", loadError);
            setError("Unable to load consent records.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const filteredRecords = useMemo(
        () => filterConsentRecords(records, search, typeFilter, sectionFilter, alertFilter),
        [records, search, typeFilter, sectionFilter, alertFilter]
    );

    const printRecord = (record: ConsentAdminRecord) => {
        const printWindow = window.open("", "_blank", "width=1000,height=800");
        if (!printWindow) {
            window.alert("The print window was blocked by your browser. Please allow pop-ups for this site and try again.");
            return;
        }
        printWindow.document.open();
        printWindow.document.write(consentRecordPrintHtml(record));
        printWindow.document.close();
        window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
    };

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Consent Management" description="Youth consent, Scouter ES3 and medication information." actions={<Button variant="contained" color="success" onClick={() => void load()}>Refresh</Button>} />
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            <ConsentOverviewPanel records={records} filteredRecords={filteredRecords} loading={loading} search={search} typeFilter={typeFilter} sectionFilter={sectionFilter} alertFilter={alertFilter} onSearchChange={setSearch} onTypeFilterChange={setTypeFilter} onSectionFilterChange={setSectionFilter} onAlertFilterChange={setAlertFilter} onView={setSelected} onPrint={printRecord} />
            <ConsentDetailDialog record={selected} onClose={() => setSelected(null)} onPrint={printRecord} />
        </Container>
    </Box>;
}
