import { Alert, Box, CircularProgress } from "@mui/material";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadPublicSiteContent } from "../services/publicSiteContent";
import type { PublicSiteContent } from "../services/publicSiteContent";

type ContextValue = { content: PublicSiteContent | null; error: string };
const PublicSiteContentContext = createContext<ContextValue | null>(null);

export function PublicSiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PublicSiteContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadPublicSiteContent()
      .then((value) => { if (active) setContent(value); })
      .catch((loadError) => {
        console.error("Unable to load canonical public website content:", loadError);
        if (active) setError("Unable to load website content from the database.");
      });
    return () => { active = false; };
  }, []);

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!content) return <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>;

  return <PublicSiteContentContext.Provider value={{ content, error: "" }}>{children}</PublicSiteContentContext.Provider>;
}

export function usePublicSiteContent(): PublicSiteContent {
  const context = useContext(PublicSiteContentContext);
  if (!context?.content) throw new Error("PublicSiteContentProvider is unavailable.");
  return context.content;
}
