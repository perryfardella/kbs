"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

export function FAB() {
  const pathname = usePathname();
  if (pathname !== "/transactions") return null;

  return (
    <Link
      href="/add"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg transition-transform active:scale-95"
      aria-label="Add transaction"
    >
      <Plus size={28} strokeWidth={2.5} className="text-bg" />
    </Link>
  );
}
