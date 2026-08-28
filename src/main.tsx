import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";

import "./index.css";

const LEGACY_PUBLIC_LEADERSHIP_PREFIX = "coolock-ardlea-public-leadership-";

function clearLegacyWhosWhoCaches(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith(LEGACY_PUBLIC_LEADERSHIP_PREFIX)) storage.removeItem(key);
      }
    } catch {
      // Storage can be blocked in private/restricted browser modes.
    }
  }

  if ("caches" in window) {
    void window.caches.keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .catch(() => undefined);
  }
}

clearLegacyWhosWhoCaches();

ReactDOM
  .createRoot(document.getElementById("root")!)
  .render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>
  );
