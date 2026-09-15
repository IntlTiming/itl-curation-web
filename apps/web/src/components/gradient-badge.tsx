import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { gradientColors, type GradientDirection } from '@/lib/gradient-color';

// The four colors gradientColors computes, as CSS custom properties - light/dark are both set
// unconditionally and picked between by a `dark:` variant class at render time, since a
// continuous gradient has no fixed Tailwind class to reach for. Shared by GradientBadge below
// and by review-modal.tsx's GradientSelectTrigger/GradientSelectItem, which apply the same
// vars to a Select's trigger/option elements instead of a Badge.
export function gradientCssVars(
  value: number,
  min: number,
  max: number,
  direction: GradientDirection,
): CSSProperties {
  const colors = gradientColors(value, min, max, direction);
  return {
    '--gradient-bg-light': colors.light.background,
    '--gradient-fg-light': colors.light.foreground,
    '--gradient-bg-dark': colors.dark.background,
    '--gradient-fg-dark': colors.dark.foreground,
  } as unknown as CSSProperties;
}

// Solid tinted fill, no border of its own - for an element that already reads as a discrete
// chip (Badge, a Select option row).
//
// Uses Tailwind's arbitrary-VALUE syntax (bg-[var(...)]) on the named bg/text utilities, not
// arbitrary-PROPERTY syntax ([background-color:var(...)]) - `cn` (this repo's tailwind-merge
// replacement) only recognizes a conflict between two uses of the *same* utility name, so
// bg-[var(...)] correctly displaces Badge's own unconditional `bg-primary`/`text-primary-
// foreground`, while a raw [background-color:...] escape does not: both classes would survive
// into the DOM and the browser's cascade order - not `cn` - would decide the winner, which is
// exactly the bug this replaced (solid black/white badges in light mode, correct colors in dark
// only because dark:-scoped rules happen to sort later in Tailwind's generated CSS).
export const GRADIENT_FILL_CLASSNAME =
  'border-transparent bg-[var(--gradient-bg-light)] text-[var(--gradient-fg-light)] dark:bg-[var(--gradient-bg-dark)] dark:text-[var(--gradient-fg-dark)]';

// Tinted fill plus a border matching the text color - for a control that already draws its own
// border at rest (a Select trigger), so it reads as "this control, tinted" rather than a pill.
// Same arbitrary-VALUE reasoning as GRADIENT_FILL_CLASSNAME above - border-[var(...)] correctly
// displaces SelectTrigger's own unconditional `border-input`.
export const GRADIENT_OUTLINE_CLASSNAME =
  'bg-[var(--gradient-bg-light)] text-[var(--gradient-fg-light)] border-[var(--gradient-fg-light)] dark:bg-[var(--gradient-bg-dark)] dark:text-[var(--gradient-fg-dark)] dark:border-[var(--gradient-fg-dark)]';

// A Badge whose fill/text color is computed from where `value` falls between `min` and `max` -
// red at the "bad" end, green at the "good" end, yellow in between - rather than one of Badge's
// fixed variants. Used for read-only Rating/Passing/Scoring/Stdev displays (reviews-table.tsx,
// submission-detail-page.tsx); review-modal.tsx's editable selects use gradientCssVars/
// GRADIENT_*_CLASSNAME directly instead, since they're tinting a Select, not a Badge.
export function GradientBadge({
  value,
  min,
  max,
  direction,
  children,
}: {
  value: number;
  min: number;
  max: number;
  direction: GradientDirection;
  children: ReactNode;
}) {
  return (
    <Badge style={gradientCssVars(value, min, max, direction)} className={GRADIENT_FILL_CLASSNAME}>
      {children}
    </Badge>
  );
}
