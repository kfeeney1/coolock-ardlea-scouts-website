import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminAuthProvider } from "./components/admin/AdminAuthProvider";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import ProtectedSiteSettingsRoute from "./components/admin/ProtectedSiteSettingsRoute";
import Layout from "./components/Layout";
import { PublicSiteContentProvider } from "./components/PublicSiteContentProvider";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Activities = lazy(() => import("./pages/Activities"));
const ConsentForm = lazy(() => import("./pages/ConsentForm"));
const EventConsent = lazy(() => import("./pages/EventConsent"));
const ParentPortal = lazy(() => import("./pages/ParentPortal"));
const Join = lazy(() => import("./pages/Join"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const LeaderRegister = lazy(() => import("./pages/LeaderRegister"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const LeaderRequests = lazy(() => import("./pages/LeaderRequests"));
const LeaderAccessManagement = lazy(() => import("./pages/LeaderAccessManagement"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const LeaderProfile = lazy(() => import("./pages/LeaderProfile"));
const LeaderReports = lazy(() => import("./pages/LeaderReports"));
const AttendanceInsights = lazy(() => import("./pages/AttendanceInsights"));
const LeaderCommunications = lazy(() => import("./pages/LeaderCommunications"));
const MeetingRecords = lazy(() => import("./pages/MeetingRecords"));
const WeeklySectionTracker = lazy(() => import("./pages/WeeklySectionTracker"));
const OrganisationChart = lazy(() => import("./pages/OrganisationChart"));
const ConsentManagement = lazy(() => import("./pages/ConsentManagement"));
const LeaderInfo = lazy(() => import("./pages/LeaderInfo"));
const JoinManagement = lazy(() => import("./pages/JoinManagement"));
const MemberManagement = lazy(() => import("./pages/MemberManagement"));
const MemberHistory = lazy(() => import("./pages/MemberHistory"));
const EventsManagement = lazy(() => import("./pages/EventsManagement"));
const EventConsentManagement = lazy(() => import("./pages/EventConsentManagement"));
const ParentAccessManagement = lazy(() => import("./pages/ParentAccessManagement"));
const SiteSettings = lazy(() => import("./pages/SiteSettings"));

function RouteFallback() {
  return (
    <div role="status" aria-live="polite" style={{ padding: "2rem", textAlign: "center" }}>
      Loading page…
    </div>
  );
}

function protectedRoute(element: ReactNode) {
  return <ProtectedAdminRoute>{element}</ProtectedAdminRoute>;
}

function protectedSettingsRoute(element: ReactNode) {
  return protectedRoute(<ProtectedSiteSettingsRoute>{element}</ProtectedSiteSettingsRoute>);
}

export default function App() {
  return (
    <PublicSiteContentProvider>
      <AdminAuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/whos-who" element={<Navigate to="/about" replace />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/activities/consent" element={<ConsentForm />} />
              <Route path="/event-consent/:token" element={<EventConsent />} />
              <Route path="/parent" element={<ParentPortal />} />
              <Route path="/join" element={<Join />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/leader/login" element={<AdminLogin />} />
              <Route path="/leader/register" element={<LeaderRegister />} />
              <Route path="/leader" element={protectedRoute(<AdminDashboard />)} />
              <Route path="/leader/requests" element={protectedRoute(<LeaderRequests />)} />
              <Route path="/leader/access" element={protectedRoute(<LeaderAccessManagement />)} />
              <Route path="/leader/activity" element={protectedRoute(<ActivityLog />)} />
              <Route path="/leader/profile" element={protectedRoute(<LeaderProfile />)} />
              <Route path="/leader/reports" element={protectedRoute(<LeaderReports />)} />
              <Route path="/leader/attendance" element={protectedRoute(<AttendanceInsights />)} />
              <Route path="/leader/communications" element={protectedRoute(<LeaderCommunications />)} />
              <Route path="/leader/meetings" element={protectedRoute(<MeetingRecords />)} />
              <Route path="/leader/weekly" element={protectedRoute(<WeeklySectionTracker />)} />
              <Route path="/leader/organisation" element={protectedRoute(<OrganisationChart />)} />
              <Route path="/leader/consents" element={protectedRoute(<ConsentManagement />)} />
              <Route path="/leader/info" element={protectedRoute(<LeaderInfo />)} />
              <Route path="/leader/join" element={protectedRoute(<JoinManagement />)} />
              <Route path="/leader/members" element={protectedRoute(<MemberManagement />)} />
              <Route path="/leader/member-history" element={protectedRoute(<MemberHistory />)} />
              <Route path="/leader/events" element={protectedRoute(<EventsManagement />)} />
              <Route path="/leader/event-consent" element={protectedRoute(<EventConsentManagement />)} />
              <Route path="/leader/parent-access" element={protectedRoute(<ParentAccessManagement />)} />
              <Route path="/leader/settings" element={protectedSettingsRoute(<SiteSettings />)} />
            </Route>
          </Routes>
        </Suspense>
      </AdminAuthProvider>
    </PublicSiteContentProvider>
  );
}
