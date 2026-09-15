// Continuous color scale for a value between a min and max - used by GradientBadge to color
// Rating/Passing/Scoring/Stdev values by how "good" (or how notable) they are, instead of one
// of Badge's fixed variants.

// 'ascending'/'descending' are the red/yellow/green quality scales (Rating/Passing/Scoring).
// 'toRed' is a neutral-gray-to-red scale for values with no "good" end to gauge against, just
// an increasingly notable one (Stdev - see STDEV_GRADIENT below).
export type GradientDirection = 'ascending' | 'descending' | 'toRed';

// The three params every gradientColors call site needs together - RATING_GRADIENT etc. below
// all satisfy this shape, so a component can accept "a gradient" as one prop instead of three.
export type GradientRange = { min: number; max: number; direction: GradientDirection };

function clampedT(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Hue 0 = red, 120 = green - a straight-line interpolation between the two naturally passes
// through yellow (~60) at the midpoint, so this single lerp covers both an explicit
// red->yellow->green gradient ('ascending', e.g. Rating: higher is better) and a green->red
// one ('descending', e.g. Passing/Scoring: higher is worse) without a separate three-stop case.
function gradientHue(t: number, direction: 'ascending' | 'descending'): number {
  return direction === 'ascending' ? t * 120 : 120 - t * 120;
}

export type GradientTone = { background: string; foreground: string };
export type GradientColors = { light: GradientTone; dark: GradientTone };

// Light: a pastel fill with dark text, matching the *-100/*-800 Tailwind pairing this codebase
// already uses for fixed-color badges (e.g. SubmissionStatusBadge's amber fill). Dark: a
// low-opacity fill with light text, matching the *-500/15..25 + *-400 pairing used throughout
// (e.g. submission-row.tsx's ROW_TONE_CLASS, the reviews-table basic-check tags).
function hueGradientColors(t: number, direction: 'ascending' | 'descending'): GradientColors {
  const hue = gradientHue(t, direction);
  return {
    light: { background: `hsl(${hue} 85% 90%)`, foreground: `hsl(${hue} 75% 28%)` },
    dark: { background: `hsl(${hue} 80% 55% / 0.2)`, foreground: `hsl(${hue} 90% 70%)` },
  };
}

// Fixed at hue 0 (red) throughout - saturation ramps up from 0 (gray, at min) to the same
// saturation hueGradientColors uses at its red end (at max), so a value at min reads as neutral
// (matching Badge's plain `secondary` variant) and only climbs toward red as it rises, with no
// green "this is good" implication in between.
function toRedColors(t: number): GradientColors {
  return {
    light: {
      background: `hsl(0 ${lerp(0, 85, t)}% ${lerp(93, 90, t)}%)`,
      foreground: `hsl(0 ${lerp(0, 75, t)}% ${lerp(30, 28, t)}%)`,
    },
    dark: {
      background: `hsl(0 ${lerp(0, 80, t)}% ${lerp(30, 55, t)}% / ${lerp(1, 0.2, t)})`,
      foreground: `hsl(0 ${lerp(0, 90, t)}% ${lerp(75, 70, t)}%)`,
    },
  };
}

export function gradientColors(
  value: number,
  min: number,
  max: number,
  direction: GradientDirection,
): GradientColors {
  const t = clampedT(value, min, max);
  return direction === 'toRed' ? toRedColors(t) : hueGradientColors(t, direction);
}

// The known value scales this app colors - kept alongside gradientColors so every call site
// uses the exact same bounds/direction rather than risking drift between copies.
export const RATING_GRADIENT = { min: 0, max: 3, direction: 'ascending' as const };
export const PASSING_GRADIENT = { min: 1, max: 5, direction: 'descending' as const };
export const SCORING_GRADIENT = { min: 1, max: 10, direction: 'descending' as const };
// Stdev is a spread statistic, not a quality score - low disagreement isn't "good" the way a
// high rating is, so it stays neutral (gray, matching Badge's plain `secondary` variant) until
// disagreement climbs, then reddens. 1.5 is the theoretical max population stdev for ratings
// bounded in [0, 3] (reviewers split exactly 50/50 between 0 and 3), but real disagreement
// across the discrete rating options ({0, 1, 1.5, 2, 2.5, 3}) rarely climbs past ~1.0 - clipping
// the red end there (rather than at the mathematical 1.5 ceiling) keeps the gradient sensitive
// across the range reviewers actually produce, instead of compressing everything near-neutral.
export const STDEV_GRADIENT = { min: 0, max: 1, direction: 'toRed' as const };
