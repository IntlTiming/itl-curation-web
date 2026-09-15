import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// A segment with `to` renders as a link (an ancestor page, e.g. the event when viewing one of
// its submissions); one without renders as the current, non-linked page - normally the last
// segment in the trail.
export type BreadcrumbSegment = { label: string; to?: string };

const BreadcrumbSegmentsContext = createContext<{
  segments: BreadcrumbSegment[];
  setSegments: (segments: BreadcrumbSegment[]) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([]);
  return (
    <BreadcrumbSegmentsContext.Provider value={{ segments, setSegments }}>
      {children}
    </BreadcrumbSegmentsContext.Provider>
  );
}

export function useBreadcrumbSegments() {
  const ctx = useContext(BreadcrumbSegmentsContext);
  if (!ctx) throw new Error('useBreadcrumbSegments must be used within a BreadcrumbProvider');
  return ctx.segments;
}

// Lets the current page announce its own breadcrumb trail (e.g. an event's name, or for a
// submission page the event name followed by the chart title), clearing it again when the page
// unmounts. Pass an empty array while the trail's data hasn't loaded yet.
//
// Depends on the segments array by content, not by reference, since callers naturally build a
// fresh array literal on every render - without this, the effect would fire (and re-render the
// breadcrumb) on every render of every page, not just when the trail actually changes.
export function usePageBreadcrumb(segments: BreadcrumbSegment[]) {
  const ctx = useContext(BreadcrumbSegmentsContext);
  if (!ctx) throw new Error('usePageBreadcrumb must be used within a BreadcrumbProvider');
  const { setSegments } = ctx;
  const key = JSON.stringify(segments);

  useEffect(() => {
    setSegments(JSON.parse(key));
    return () => setSegments([]);
  }, [key, setSegments]);
}
