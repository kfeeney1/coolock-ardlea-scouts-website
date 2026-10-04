import { useEffect, useState } from "react";
import { Alert, Button } from "@mui/material";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
/** Last resort for uncaught async actions; handled failures stay with their screen. */
export default function UnhandledErrorNotice() {
  const [ready, setReady] = useState(false);
  const [severity, setSeverity] = useState<"error" | "warning">("error");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const rejection = (event: PromiseRejectionEvent) => {
      setSeverity("error");
      event.preventDefault();
      setMessage(applicationErrorMessage(event.reason, "An application action could not be completed. Check the affected record before retrying.", "Application", "Unhandled asynchronous action"));
    };
    const exception = (event: ErrorEvent) => {
      setSeverity("error");
      event.preventDefault();
      setMessage(applicationErrorMessage(event.error, "An application action could not be completed. Check the affected record before retrying.", "Application", "Unhandled runtime action"));
    };
    const warning = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      if (typeof detail === "string") { setSeverity("warning"); setMessage(detail); }
    };
    window.addEventListener("application-warning", warning);
    window.addEventListener("unhandledrejection", rejection);
    window.addEventListener("error", exception);
    setReady(true);
    return () => {
      window.removeEventListener("application-warning", warning);
      window.removeEventListener("unhandledrejection", rejection);
      window.removeEventListener("error", exception);
    };
  }, []);
  return message ? <Alert severity={severity} role="alert" action={<Button color="inherit" onClick={() => setMessage("")}>Dismiss</Button>}>{message}</Alert> : ready ? <span hidden data-testid="application-errors-ready" /> : null;
}
