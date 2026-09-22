import { Badge } from '@/components/ui/badge';
import type { BasicCheckLevel } from '@/hooks/use-basic-check-reasons';

// Shared by ReviewCard and ReviewRevisionCard - a basic check's free-text note is shown directly
// on the card, not behind a hover tooltip, so it's visible at a glance.
export function BasicCheckList({
  checks,
}: {
  checks: { id: string; label: string; level: BasicCheckLevel; note: string | null }[];
}) {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <div key={check.id} className="flex flex-col gap-0.5">
          <Badge
            variant={check.level === 'DISQUALIFIED' ? 'destructive' : 'outline'}
            className="w-fit"
          >
            {check.label}
          </Badge>
          {check.note && <p className="text-muted-foreground pl-0.5 text-xs">{check.note}</p>}
        </div>
      ))}
    </div>
  );
}
