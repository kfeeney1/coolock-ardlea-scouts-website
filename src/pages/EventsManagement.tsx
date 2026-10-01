import { Alert, Box, Button, Container } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import EventListPanel from "../components/admin/EventListPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadEvents } from "../services/eventAdmin";
import type { EventRecord, EventStatus } from "../services/eventAdmin";
import { filterEvents } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function EventsManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedEventId = searchParams.get("event") ?? "";
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("All Sections");
    const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedEvents, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
            setEvents(loadedEvents);
            setMembers(loadedMembers);
            if (requestedEventId && loadedEvents.some((event) => event.id === requestedEventId)) {
                navigate(`/leader/events/${encodeURIComponent(requestedEventId)}`, { replace: true });
            }
        } catch (loadError) {
            console.error("Unable to load events:", loadError);
            setError("Unable to load events and activities.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [requestedEventId]);

    const visibleEvents = useMemo(() => filterEvents(events, search, sectionFilter, statusFilter), [events, search, sectionFilter, statusFilter]);

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Events & Activities" actions={<Button variant="contained" color="success" onClick={() => navigate("/leader/events/create")}>Add Event</Button>} />
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            <EventListPanel events={events} visibleEvents={visibleEvents} members={members} loading={loading} search={search} sectionFilter={sectionFilter} statusFilter={statusFilter} onSearchChange={setSearch} onSectionFilterChange={setSectionFilter} onStatusFilterChange={setStatusFilter} />
        </Container>
    </Box>;
}
