import { cn } from 'cn';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CommentReaction } from '@/hooks/use-comments';

// "Alice" | "Alice and Bob" | "Alice, Bob, and Carol" - "You" (if present) is always first in
// the input list already, see MappedReaction.reactedBy on the backend.
function formatReactorNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// Renders one pill per reaction group (always including the default thumbs-up pill even at
// zero count, per DEFAULT_REACTION_EMOJI on the backend - see comments.service.ts), plus a
// trailing "+" that opens a full emoji picker for reacting with anything else. Clicking any
// pill (including the default one) or picking from the popover both toggle that emoji for the
// current user.
export function CommentReactions({
  reactions,
  onToggle,
}: {
  reactions: CommentReaction[];
  onToggle: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const pill = (
          <Button
            key={reaction.emoji}
            type="button"
            variant="outline"
            size="xs"
            aria-pressed={reaction.reactedByMe}
            className={cn(
              reaction.reactedByMe &&
                'border-primary bg-primary/15 text-primary hover:bg-primary/20 dark:bg-primary/25',
            )}
            onClick={() => onToggle(reaction.emoji)}
          >
            <span>{reaction.emoji}</span>
            {reaction.count > 0 && <span>{reaction.count}</span>}
          </Button>
        );

        if (reaction.reactedBy.length === 0) return pill;

        return (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>{pill}</TooltipTrigger>
            <TooltipContent>
              {formatReactorNames(reaction.reactedBy)} reacted with {reaction.emoji}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Add reaction">
            <Plus />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <EmojiPicker
            width={320}
            height={380}
            onEmojiClick={(data: EmojiClickData) => {
              onToggle(data.emoji);
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
