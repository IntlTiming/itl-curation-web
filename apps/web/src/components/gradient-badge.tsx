import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { gradientColors, type GradientDirection } from '@/lib/gradient-color';

// A Badge whose fill/text color is computed from where `value` falls between `min` and `max` -
// red at the "bad" end, green at the "good" end, yellow in between - rather than one of Badge's
// fixed variants. Colors are set via CSS custom properties (light/dark computed once in JS,
// picked by the `dark:` variant in CSS) since a continuous gradient has no fixed Tailwind class
// to reach for. Used for read-only Rating/Passing/Scoring displays (reviews-table.tsx,
// submission-detail-page.tsx) - never for the editable review-modal.tsx selects.
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
  const colors = gradientColors(value, min, max, direction);
  const style = {
    '--gradient-bg-light': colors.light.background,
    '--gradient-fg-light': colors.light.foreground,
    '--gradient-bg-dark': colors.dark.background,
    '--gradient-fg-dark': colors.dark.foreground,
  } as unknown as CSSProperties;

  return (
    <Badge
      style={style}
      className="border-transparent [background-color:var(--gradient-bg-light)] [color:var(--gradient-fg-light)] dark:[background-color:var(--gradient-bg-dark)] dark:[color:var(--gradient-fg-dark)]"
    >
      {children}
    </Badge>
  );
}
