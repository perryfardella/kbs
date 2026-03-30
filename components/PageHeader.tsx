"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  left,
  right,
  children,
  sticky = true,
}: {
  title: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
}) {
  const isStringTitle = typeof title === "string";

  return (
    <div
      className={
        sticky
          ? "sticky top-0 z-10 bg-bg border-b border-border"
          : "bg-bg border-b border-border"
      }
    >
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {left}
            {isStringTitle ? (
              <h1 className="truncate font-display text-xl font-semibold text-text-primary">
                {title}
              </h1>
            ) : (
              <div
                className="truncate font-display text-xl font-semibold text-text-primary"
                role="heading"
                aria-level={1}
              >
                {title}
              </div>
            )}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

