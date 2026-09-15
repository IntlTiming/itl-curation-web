import { useEffect, useRef } from 'react';

function storageKey(key: string): string {
  return `itl-scroll:${key}`;
}

// Restores the window's scroll position for a given key once its content is `ready` (e.g. a
// table's data has loaded) - needed because this app's routes fully unmount/remount rather than
// keeping list views alive underneath a detail page (see submission-detail-page.tsx's "Back to
// event" link), so a table's scroll position has nowhere to live across that unless something
// stashes and restores it explicitly. Continuously mirrors the live scroll position into
// sessionStorage (throttled to once per animation frame) so a later remount can read it back.
//
// Not `ready`-gated on the write side - only the one-time restore needs to wait for content;
// saving the current position is safe at any time.
export function useScrollRestoration(key: string, ready: boolean) {
  // Tracks which key's saved position has already been applied this mount, rather than a
  // plain boolean - a key change (e.g. switching events while this component stays mounted)
  // should still get its own restore, not be skipped because *some* key was restored before.
  const restoredForKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || restoredForKeyRef.current === key) return;
    restoredForKeyRef.current = key;
    const saved = sessionStorage.getItem(storageKey(key));
    if (saved !== null) window.scrollTo(0, Number(saved));
  }, [key, ready]);

  useEffect(() => {
    let frame: number | null = null;
    function onScroll() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        try {
          sessionStorage.setItem(storageKey(key), String(window.scrollY));
        } catch {
          // sessionStorage unavailable - scroll position just won't stick, no functional loss.
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [key]);
}
