"use client";

import { useEffect } from "react";

// How long to keep re-checking after a trigger. The keyboard's open
// animation and the container's keyboard-inset padding (applied via React
// state, a render behind raw visualViewport events) both settle over a
// handful of frames — a single one-shot correction can run mid-animation,
// undershoot, and never get another chance. Re-running every frame for this
// window lets each pass correct whatever's left, converging once things
// settle; once the field is fully revealed, later passes are no-ops.
const SETTLE_MS = 500;

/**
 * Ensures the currently-focused field inside `containerRef` is scrolled
 * above the on-screen keyboard. The container's own bounding box doesn't
 * shrink for the keyboard (see `useKeyboardInset`), so neither Safari's
 * native scroll-into-view nor a plain `scrollIntoView()` call knows the
 * bottom portion is actually covered — this checks the field's position
 * against `visualViewport` directly and corrects `scrollTop` by the exact
 * overlap.
 */
export function useScrollFocusedIntoView(
  containerRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const reveal = () => {
      const container = containerRef.current;
      const active = document.activeElement as HTMLElement | null;
      if (!container || !active || !container.contains(active)) return;

      const rect = active.getBoundingClientRect();
      const visibleTop = vv.offsetTop;
      const visibleBottom = vv.height + vv.offsetTop;

      const overlap = rect.bottom - visibleBottom;
      if (overlap > 0) {
        container.scrollTop += overlap + 16;
        return;
      }
      const hiddenAbove = visibleTop - rect.top;
      if (hiddenAbove > 0) {
        container.scrollTop -= hiddenAbove + 16;
      }
    };

    let raf = 0;
    const settle = () => {
      cancelAnimationFrame(raf);
      const start = performance.now();
      const tick = (now: number) => {
        reveal();
        if (now - start < SETTLE_MS) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const container = containerRef.current;
    container?.addEventListener("focusin", settle);
    vv.addEventListener("resize", settle);
    vv.addEventListener("scroll", settle);
    return () => {
      cancelAnimationFrame(raf);
      container?.removeEventListener("focusin", settle);
      vv.removeEventListener("resize", settle);
      vv.removeEventListener("scroll", settle);
    };
  }, [containerRef]);
}
