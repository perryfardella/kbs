"use client";

import { useEffect, useState } from "react";

/**
 * Tracks how much of the bottom of the screen the on-screen keyboard is
 * currently covering, in pixels. iOS shrinks the *visual* viewport (not the
 * layout viewport / `dvh`) when the keyboard opens, so this is the only way
 * to detect it. Intentionally returns a single number rather than touching
 * any element directly — callers use it as scroll-container padding, never
 * to reposition or resize a fixed element.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return inset;
}
