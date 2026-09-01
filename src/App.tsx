import { lazy, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminAuthProvider } from "./components/admin/AdminAuthProvider";
import MemberCardNavigation from "./components/admin/MemberCardNavigation";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import ProtectedSiteSettingsRoute from "./components/admin/ProtectedSiteSettingsRoute";
import Layout from "./components/Layout";
import { PublicSiteContentProvider } from "./components/PublicSiteContentProvider";
import RouteScrollManager from "./components/RouteScrollManager";
import ThemeExperienceProvider from "./theme/ThemeExperienceProvider";

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
const BadgeworkTracking = lazy(() => import("./pages/BadgeworkTracking"));
const EquipmentManagement = lazy(() => import("./pages/EquipmentManagement"));
const SectionCashbook = lazy(() => import("./pages/SectionCashbook"));
const OrganisationChart = lazy(() => import("./pages/OrganisationChart"));
const ConsentManagement = lazy(() => import("./pages/ConsentManagement"));
const ConsentRecordPage = lazy(() => import("./pages/ConsentRecordPage"));
const LeaderInfo = lazy(() => import("./pages/LeaderInfo"));
const JoinManagement = lazy(() => import("./pages/JoinManagement"));
const JoinRecordPage = lazy(() => import("./pages/JoinRecordPage"));
const MemberManagement = lazy(() => import("./pages/MemberManagement"));
const MemberRecordPage = lazy(() => import("./pages/MemberRecordPage"));
const EventsManagement = lazy(() => import("./pages/EventsManagement"));
const EventRecordPage = lazy(() => import("./pages/EventRecordPage"));
const EventConsentManagement = lazy(() => import("./pages/EventConsentManagement"));
const ParentAccessManagement = lazy(() => import("./pages/ParentAccessManagement"));
const SiteSettings = lazy(() => import("./pages/SiteSettings"));

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
        <ThemeExperienceProvider>
          <RouteScrollManager />
          <MemberCardNavigation />
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
              <Route path="/leader/badgework" element={protectedRoute(<BadgeworkTracking />)} />
              <Route path="/leader/equipment" element={protectedRoute(<EquipmentManagement />)} />
              <Route path="/leader/finance" element={protectedRoute(<SectionCashbook />)} />
              <Route path="/leader/organisation" element={protectedRoute(<OrganisationChart />)} />
              <Route path="/leader/consents" element={protectedRoute(<ConsentManagement />)} />
              <Route path="/leader/consents/:consentId" element={protectedRoute(<ConsentRecordPage />)} />
              <Route path="/leader/info" element={protectedRoute(<LeaderInfo />)} />
              <Route path="/leader/join" element={protectedRoute(<JoinManagement />)} />
              <Route path="/leader/join/:applicationId" element={protectedRoute(<JoinRecordPage />)} />
              <Route path="/leader/members" element={protectedRoute(<MemberManagement />)} />
              <Route path="/leader/members/:memberId" element={protectedRoute(<MemberRecordPage />)} />
              <Route path="/leader/member-history" element={<Navigate to="/leader/members" replace />} />
              <Route path="/leader/events" element={protectedRoute(<EventsManagement />)} />
              <Route path="/leader/events/:eventId" element={protectedRoute(<EventRecordPage />)} />
              <Route path="/leader/event-consent" element={protectedRoute(<EventConsentManagement />)} />
              <Route path="/leader/parent-access" element={protectedRoute(<ParentAccessManagement />)} />
              <Route path="/leader/settings" element={protectedSettingsRoute(<SiteSettings />)} />
            </Route>
          </Routes>
        </ThemeExperienceProvider>
      </AdminAuthProvider>
    </PublicSiteContentProvider>
  );
}
