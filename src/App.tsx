import EventsManagement from "./pages/EventsManagement";
import MemberManagement from "./pages/MemberManagement";
import JoinManagement from "./pages/JoinManagement";
import LeaderInfo from "./pages/LeaderInfo";
import ConsentManagement from "./pages/ConsentManagement";
import LeaderProfile from "./pages/LeaderProfile";
import LeaderRequests from "./pages/LeaderRequests";
import LeaderRegister from "./pages/LeaderRegister";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { AdminAuthProvider } from "./components/admin/AdminAuthProvider";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import About from "./pages/About";
import Activities from "./pages/Activities";
import ConsentForm from "./pages/ConsentForm";
import Contact from "./pages/Contact";
import Home from "./pages/Home";
import Join from "./pages/Join";

export default function App() {
    return (
        <AdminAuthProvider>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/activities" element={<Activities />} />
                    <Route path="/activities/consent" element={<ConsentForm />} />
                    <Route path="/join" element={<Join />} />
                    <Route path="/contact" element={<Contact />} />
                </Route>

                <Route path="/leader/login" element={<AdminLogin />} />
                <Route path="/leader/register" element={<LeaderRegister />} />

                <Route
                    path="/leader"
                    element={
                        <ProtectedAdminRoute>
                            <AdminDashboard />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/requests"
                    element={
                        <ProtectedAdminRoute>
                            <LeaderRequests />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/profile"
                    element={
                        <ProtectedAdminRoute>
                            <LeaderProfile />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/consents"
                    element={
                        <ProtectedAdminRoute>
                            <ConsentManagement />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/info"
                    element={
                        <ProtectedAdminRoute>
                            <LeaderInfo />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/join"
                    element={
                        <ProtectedAdminRoute>
                            <JoinManagement />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/members"
                    element={
                        <ProtectedAdminRoute>
                            <MemberManagement />
                        </ProtectedAdminRoute>
                    }
                />

                <Route
                    path="/leader/events"
                    element={
                        <ProtectedAdminRoute>
                            <EventsManagement />
                        </ProtectedAdminRoute>
                    }
                />
            </Routes>
        </AdminAuthProvider>
    );
}
