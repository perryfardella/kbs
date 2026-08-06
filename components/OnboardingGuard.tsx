"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const settings = useQuery(api.settings.get, isConvexAuthenticated ? {} : "skip");
  const ensureDefaults = useMutation(api.settings.ensureDefaults);
  const hasEnsuredRef = useRef(false);
  const inFlightRef = useRef(false);
  const { user, isLoaded: isClerkLoaded } = useUser();

  const ownerName = useMemo(() => {
    if (!isClerkLoaded) return null;
    const fullName = user?.fullName?.trim();
    const emailLocalPart = user?.primaryEmailAddress?.emailAddress
      ?.split("@")[0]
      ?.trim();
    return fullName || emailLocalPart || "User";
  }, [isClerkLoaded, user]);

  useEffect(() => {
    // Convex must have finished attaching the auth token before we can
    // trust `settings === null` to mean "no settings row exists yet"
    // rather than "not authenticated yet".
    if (!isConvexAuthenticated) return;
    if (settings === null && ownerName) {
      if (hasEnsuredRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      void ensureDefaults({ ownerName })
        .catch((err) => {
          console.error("Failed to ensure defaults:", err);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
      // Mark as ensured once the mutation successfully completes and
      // `settings` is no longer null (handled by the query/render).
      // Keeping this as a no-op here avoids retry lockouts on failure.
    }
    if (settings !== null && settings !== undefined) {
      hasEnsuredRef.current = true;
    }
  }, [ensureDefaults, ownerName, settings, isConvexAuthenticated]);

  // Avoid showing the app before we're authenticated and `settings` exist.
  if (!isConvexAuthenticated || settings === undefined || settings === null) return null;

  return <>{children}</>;
}
