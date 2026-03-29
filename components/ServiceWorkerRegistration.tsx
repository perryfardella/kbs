"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (process.env.NODE_ENV === "development") {
            console.log("[SW] Registered:", reg.scope);
          }
        })
        .catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.error("[SW] Registration failed:", err);
          }
        });
    }
  }, []);

  return null;
}
