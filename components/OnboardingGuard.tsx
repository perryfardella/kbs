"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const settings = useQuery(api.settings.get);
  const router = useRouter();

  useEffect(() => {
    if (settings === null) {
      router.replace("/onboarding");
    }
  }, [settings, router]);

  return <>{children}</>;
}
