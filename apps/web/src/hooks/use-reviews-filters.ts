import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export type ReviewsFilters = {
  search: string;
  playstyle: 'SINGLE' | 'DOUBLE';
  minMeter: number | null;
  maxMeter: number | null;
  unreviewedOnly: boolean;
  publiclyReviewableOnly: boolean;
  // TechTag.code values (e.g. "BR", "XO") - a submission needs at least one to show up at all;
  // exact-set matches are ranked first server-side (see reviews.service.ts's
  // buildTechTagRankFragment), same as search relevance.
  techTags: string[];
};

const DEFAULT_FILTERS: ReviewsFilters = {
  search: '',
  playstyle: 'SINGLE',
  minMeter: null,
  maxMeter: null,
  unreviewedOnly: false,
  publiclyReviewableOnly: false,
  techTags: [],
};

// Exported so event-detail.tsx can strip these atomically, in the SAME setSearchParams call
// that changes `tab`, when navigating away from Reviews - see use-reviews-sort.ts's
// SORT_PARAM_KEYS comment for why an effect-cleanup-on-unmount approach here was reverted
// (it races the tab-switch navigation via a stale setSearchParams closure).
export const FILTER_PARAM_KEYS = [
  'search',
  'playstyle',
  'minMeter',
  'maxMeter',
  'unreviewedOnly',
  'publiclyReviewableOnly',
  'techTags',
] as const;

function storageKey(slug: string): string {
  return `itl-reviews-filters:${slug}`;
}

// Any filter param present in the URL makes the URL the COMPLETE source of truth for the
// initial state - missing keys fall back to hard defaults, never to localStorage. A normal
// in-app filter change always mirrors the full current state into the URL (see setFilters
// below), so a shared link is naturally always fully-formed; a partial URL only arises from
// hand-editing, where hard defaults are the more predictable behavior.
function parseFromParams(params: URLSearchParams): ReviewsFilters {
  return {
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    playstyle: params.get('playstyle') === 'DOUBLE' ? 'DOUBLE' : 'SINGLE',
    minMeter: params.has('minMeter') ? Number(params.get('minMeter')) : DEFAULT_FILTERS.minMeter,
    maxMeter: params.has('maxMeter') ? Number(params.get('maxMeter')) : DEFAULT_FILTERS.maxMeter,
    unreviewedOnly: params.get('unreviewedOnly') === 'true',
    publiclyReviewableOnly: params.get('publiclyReviewableOnly') === 'true',
    techTags: params.has('techTags')
      ? (params.get('techTags') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : DEFAULT_FILTERS.techTags,
  };
}

function readFromLocalStorage(slug: string): ReviewsFilters | null {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<ReviewsFilters>) };
  } catch {
    return null;
  }
}

// Writes the complete filter state into the params, omitting keys that are at their default
// so the URL stays minimal when nothing's been changed from the defaults.
function writeToParams(filters: ReviewsFilters, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string, isDefault: boolean) => {
    if (isDefault) next.delete(key);
    else next.set(key, value);
  };
  setOrDelete('search', filters.search, filters.search === DEFAULT_FILTERS.search);
  setOrDelete('playstyle', filters.playstyle, filters.playstyle === DEFAULT_FILTERS.playstyle);
  setOrDelete('minMeter', String(filters.minMeter), filters.minMeter === DEFAULT_FILTERS.minMeter);
  setOrDelete('maxMeter', String(filters.maxMeter), filters.maxMeter === DEFAULT_FILTERS.maxMeter);
  setOrDelete('unreviewedOnly', 'true', !filters.unreviewedOnly);
  setOrDelete('publiclyReviewableOnly', 'true', !filters.publiclyReviewableOnly);
  setOrDelete('techTags', filters.techTags.join(','), filters.techTags.length === 0);
  return next;
}

// Owns Reviews table filter state, synced both to the URL (shareable) and localStorage
// (sticky per-user default) per the rules in the Reviews plan:
// - Initial load: URL (if any filter param present, whole-state) > localStorage > defaults.
// - Loading from the URL never writes localStorage - only an explicit filter change does,
//   so viewing someone else's shared link never silently overwrites your own saved default.
// - Every filter change writes the full resulting state to both localStorage and the URL
//   (via a non-navigating replaceState-style update, matching event-detail.tsx's tab sync).
export function useReviewsFilters(slug: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFiltersState] = useState<ReviewsFilters>(() => {
    if (FILTER_PARAM_KEYS.some((key) => searchParams.has(key))) {
      return parseFromParams(searchParams);
    }
    return readFromLocalStorage(slug) ?? DEFAULT_FILTERS;
  });

  // Mirrors whatever the initial state turned out to be (from localStorage or defaults) into
  // the URL once, so the current view is linkable immediately - this touches the URL only,
  // never localStorage. Skipped when it would be a no-op (the common case: a first-time
  // visitor with no saved filters and no URL params) - react-router treats every
  // setSearchParams call as a real navigation regardless of content, and calling it
  // unconditionally on mount can race with the router's own initial render.
  // (Cleanup on leaving Reviews lives in event-detail.tsx's tab switcher instead of here - see
  // the FILTER_PARAM_KEYS comment above for why.)
  useEffect(() => {
    setSearchParams(
      (params) => {
        const next = writeToParams(filters, params);
        return next.toString() === params.toString() ? params : next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = useCallback(
    (update: Partial<ReviewsFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...update };
        try {
          localStorage.setItem(storageKey(slug), JSON.stringify(next));
        } catch {
          // localStorage unavailable - filters still work for this session, just won't stick.
        }
        setSearchParams((params) => writeToParams(next, params), { replace: true });
        return next;
      });
    },
    [slug, setSearchParams],
  );

  // A full reset is just a filter change whose new state happens to be the defaults - reuses
  // setFilters so it persists to localStorage and mirrors to the URL exactly like any other
  // filter change.
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [setFilters]);

  return { filters, setFilters, resetFilters };
}
