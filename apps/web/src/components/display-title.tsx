import { useTitleDisplay } from '@/components/title-display-provider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Renders a chart title/subtitle/artist in the variant chosen by the user's Song Title Display
// setting, with the other variant shown in a tooltip on hover. The tooltip is skipped when the
// other variant is empty (no translit tag) or identical, since it would add nothing.
export function DisplayTitle({
  native,
  romaji,
  className,
}: {
  native: string;
  romaji: string;
  className?: string;
}) {
  const { titleDisplay } = useTitleDisplay();
  const [preferred, other] = titleDisplay === 'native' ? [native, romaji] : [romaji, native];
  const shown = preferred || other;
  if (!preferred || !other || preferred === other) {
    return <span className={className}>{shown}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{shown}</span>
      </TooltipTrigger>
      <TooltipContent>{other}</TooltipContent>
    </Tooltip>
  );
}
