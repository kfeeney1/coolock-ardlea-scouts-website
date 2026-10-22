import { useCalendarAccess } from "../../hooks/useCalendarAccess";
import { useEffect, useState } from "react";
import { useAdminAuth } from "../admin/AdminAuthProvider";
import { Button, Container } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { calendarReturnPath } from "../../services/calendarSourceLogic";
export default function CalendarReturnNavigation() {
  const location = useLocation();
  const calendar = useCalendarAccess();
  const {user} = useAdminAuth();
  const supplied = calendarReturnPath(location.state);
  const family = location.pathname === "/leader/weekly" ? "/leader/weekly" : location.pathname.match(/^\/(?:leader\/events|maintenance\/tasks)\/[^/]+/)?.[0] || "";
  const [context, setContext] = useState<{uid: string; family: string; path: string} | null>(null);
  useEffect(() => {
    if (!user || !family) {setContext(null); return;}
    if (supplied) setContext({uid: user.uid, family, path: supplied});
    else setContext(previous => previous?.uid === user.uid && previous.family === family ? previous : null);
  }, [user?.uid, family, supplied]);
  const path = supplied || (context?.uid === user?.uid && context?.family === family ? context?.path : null);
  return calendar.allowed && path && family ? <Container maxWidth="xl" sx={{pt: 2}}><Button component={Link} to={path} color="secondary" sx={{minHeight: 44}}>Back to calendar</Button></Container> : null;
}
