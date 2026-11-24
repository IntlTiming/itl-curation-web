import { format } from 'date-fns';
import { ListChecks } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { SelectionLogEntry } from '@/hooks/use-submission-detail';
import { discordAvatarUrl } from '@/lib/discord-avatar';

// One audit-log line in the submission detail page's activity feed - who selected or unselected
// this submission, and when. Same header layout as ReviewRevisionCard, with no body.
export function SelectionLogCard({
  entry,
  eventSlug,
}: {
  entry: SelectionLogEntry;
  eventSlug: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Avatar className="size-6">
          <AvatarImage src={discordAvatarUrl(entry.user)} alt={entry.user.displayName} />
          <AvatarFallback className="text-[10px]">
            {entry.user.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">
          <Link
            to={`/events/${encodeURIComponent(eventSlug)}/user/${encodeURIComponent(entry.user.id)}`}
            className="hover:underline"
          >
            {entry.user.displayName}
          </Link>
          <span className="text-muted-foreground font-normal">
            {entry.action === 'SELECTED' ? ' selected this chart' : ' unselected this chart'}
          </span>
        </span>
      </div>
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        {format(new Date(entry.timestamp), 'PP p')}
        <ListChecks className="size-3" />
      </span>
    </div>
  );
}
