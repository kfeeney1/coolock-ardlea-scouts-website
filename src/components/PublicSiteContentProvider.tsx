import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_PUBLIC_SITE_CONTENT } from "../content/defaultPublicSiteContent";
import { loadPublicSiteContent } from "../services/publicSiteContent";
import type { PublicSiteContent } from "../services/publicSiteContent";

type ContextValue = { content: PublicSiteContent; error: string };
const PublicSiteContentContext = createContext<ContextValue | null>(null);

export function PublicSiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PublicSiteContent>(DEFAULT_PUBLIC_SITE_CONTENT);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadPublicSiteContent()
      .then((value) => {
        if (!active) return;
        setContent(value);
        setError("");
      })
      .catch((loadError) => {
        console.error("Unable to load canonical public website content; using built-in fallback:", loadError);
        if (active) setError("Unable to refresh website content from the database.");
      });
    return () => { active = false; };
  }, []);

  return <PublicSiteContentContext.Provider value={{ content, error }}>{children}</PublicSiteContentContext.Provider>;
}

export function usePublicSiteContent(): PublicSiteContent {
  const context = useContext(PublicSiteContentContext);
  if (!context) throw new Error("PublicSiteContentProvider is unavailable.");
  return context.content;
}
