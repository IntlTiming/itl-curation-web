import { cn } from 'cn';
import { format } from 'date-fns';
import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { BasicCheckList } from '@/components/basic-check-list';
import { GradientBadge } from '@/components/gradient-badge';
import { MarkdownContent } from '@/components/markdown-content';
import { RatingCell } from '@/components/reviews-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  ReviewRevisionEntry,
  ReviewRevisionEntryContent,
} from '@/hooks/use-submission-detail';
import { discordAvatarUrl } from '@/lib/discord-avatar';
import { PASSING_GRADIENT, SCORING_GRADIENT, type GradientRange } from '@/lib/gradient-color';
import {
  diffReviewRevisionContent,
  type ReviewRevisionNotesDiffLine,
} from '@/lib/review-revision-diff';

// Passing/Scoring are plain integer scores (not decimal-formatted like Rating) - matches
// ReviewCard's inline rendering of review.passing/review.scoring exactly.
function ScoreValue({ value, gradient }: { value: number | null; gradient: GradientRange }) {
  if (value == null) return <>—</>;
  return (
    <GradientBadge value={value} {...gradient}>
      {value}
    </GradientBadge>
  );
}

// Git-style line diff of the raw markdown source (not the rendered output) - a word-level diff
// on rendered HTML would produce broken/mismatched markup whenever formatting shifts, and a
// rendered-markdown diff loses the git-like line-level clarity the notes diff is meant to give.
// Within a removed/added line, only the words that actually changed (segment.changed) get the
// stronger highlight - words shared with the paired line on the other side render plain, so a
// one-word edit doesn't paint the entire line.
function NotesDiff({ lines }: { lines: ReviewRevisionNotesDiffLine[] }) {
  return (
    <div className="overflow-x-auto rounded border font-mono text-xs">
      {lines.map((line, i) => {
        if (line.kind === 'unchanged') {
          return (
            <div key={i} className="flex gap-2 px-2 py-0.5 whitespace-pre-wrap">
              <span className="text-muted-foreground shrink-0 select-none"> </span>
              <span>{line.text}</span>
            </div>
          );
        }
        const removed = line.kind === 'removed';
        return (
          <div
            key={i}
            className={cn(
              'flex gap-2 px-2 py-0.5 whitespace-pre-wrap',
              removed ? 'bg-red-500/10' : 'bg-green-500/10',
            )}
          >
            <span className="text-muted-foreground shrink-0 select-none">
              {removed ? '-' : '+'}
            </span>
            <span>
              {line.segments.map((segment, si) => (
                <span
                  key={si}
                  className={cn(
                    segment.changed &&
                      (removed
                        ? 'bg-red-500/40 text-red-900 line-through dark:text-red-200'
                        : 'bg-green-500/40 text-green-900 dark:text-green-200'),
                  )}
                >
                  {segment.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubmittedBody({ content }: { content: ReviewRevisionEntryContent }) {
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Rating:</span>
          <RatingCell value={content.rating} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Passing:</span>
          <ScoreValue value={content.passing} gradient={PASSING_GRADIENT} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Scoring:</span>
          <ScoreValue value={content.scoring} gradient={SCORING_GRADIENT} />
        </span>
      </div>

      <BasicCheckList checks={content.basicChecks} />

      {content.notes && (
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground flex items-center gap-1 text-xs hover:underline"
            >
              <ChevronDown
                className={`size-3 shrink-0 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
              />
              Submitter notes
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <MarkdownContent markdown={content.notes} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function UpdatedBody({
  previous,
  current,
}: {
  previous: ReviewRevisionEntryContent;
  current: ReviewRevisionEntryContent;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const diff = diffReviewRevisionContent(previous, current);
  const nothingChanged =
    !diff.rating && !diff.passing && !diff.scoring && !diff.notes && diff.basicChecks.length === 0;

  if (nothingChanged) return null;

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {diff.rating && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Rating:</span>
          <RatingCell value={diff.rating.before} />→
          <RatingCell value={diff.rating.after} />
        </span>
      )}
      {diff.passing && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Passing:</span>
          <ScoreValue value={diff.passing.before} gradient={PASSING_GRADIENT} />→
          <ScoreValue value={diff.passing.after} gradient={PASSING_GRADIENT} />
        </span>
      )}
      {diff.scoring && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Scoring:</span>
          <ScoreValue value={diff.scoring.before} gradient={SCORING_GRADIENT} />→
          <ScoreValue value={diff.scoring.after} gradient={SCORING_GRADIENT} />
        </span>
      )}
      {diff.basicChecks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Basic checks:</span>
          {diff.basicChecks.map((change, i) => (
            <Badge
              key={`${change.check.id}-${change.kind}-${i}`}
              variant={change.kind === 'removed' ? 'outline' : 'default'}
              className={change.kind === 'removed' ? 'line-through opacity-70' : ''}
            >
              {change.kind === 'added' ? '+ ' : '− '}
              {change.check.label}
            </Badge>
          ))}
        </div>
      )}
      {diff.notes && (
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground flex items-center gap-1 hover:underline"
            >
              <ChevronDown
                className={`size-3 shrink-0 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
              />
              Notes changed
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <NotesDiff lines={diff.notes} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function ReviewRevisionCard({
  entry,
  previous,
  eventSlug,
}: {
  entry: ReviewRevisionEntry;
  previous: ReviewRevisionEntry | undefined;
  eventSlug: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage src={discordAvatarUrl(entry.reviewer)} alt={entry.reviewer.displayName} />
            <AvatarFallback className="text-[10px]">
              {entry.reviewer.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">
            <Link
              to={`/events/${encodeURIComponent(eventSlug)}/user/${encodeURIComponent(entry.reviewer.id)}`}
              className="hover:underline"
            >
              {entry.reviewer.displayName}
            </Link>
            <span className="text-muted-foreground font-normal">
              {entry.kind === 'submitted' ? ' submitted a review' : ' updated their review'}
            </span>
          </span>
          {entry.isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive">Outdated hash</Badge>
              </TooltipTrigger>
              <TooltipContent>
                This revision's recorded chart hash no longer matches the chart's current hash - the
                chart has changed since this revision was written.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          {format(new Date(entry.timestamp), 'PP p')}
          <History className="size-3" />
        </span>
      </div>

      {entry.kind === 'submitted' || !previous ? (
        entry.showDetails && <SubmittedBody content={entry.content} />
      ) : (
        <UpdatedBody previous={previous.content} current={entry.content} />
      )}
    </div>
  );
}
