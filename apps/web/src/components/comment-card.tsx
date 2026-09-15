import { format } from 'date-fns';
import { MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { CommentReactions } from '@/components/comment-reactions';
import { MarkdownContent } from '@/components/markdown-content';
import { MarkdownEditor } from '@/components/markdown-editor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SubmissionComment } from '@/hooks/use-comments';
import { discordAvatarUrl } from '@/lib/discord-avatar';

// Mirrors CreateCommentDto/UpdateCommentDto's @MaxLength() - see comment-composer.tsx.
const COMMENT_BODY_MAX_LENGTH = 20000;

function lengthLimitError(value: string, max: number): string | null {
  return value.length > max ? `Exceeded length limit (${max} characters)` : null;
}

// Modeled on submission-detail-page.tsx's ReviewCard but simpler: no rating/passing/scoring/
// basicChecks, and no "Other submission" badge (comments never cross-match submissions the
// way reviews do - see prisma/schema.prisma's Comment model). Edit/delete are inline rather
// than a modal, since a single markdown field doesn't warrant one.
export function CommentCard({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onToggleReaction,
}: {
  comment: SubmissionComment;
  currentUserId: string | null;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwn = comment.author.id === currentUserId;

  async function handleSave() {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    const lengthError = lengthLimitError(trimmed, COMMENT_BODY_MAX_LENGTH);
    setEditError(lengthError);
    if (lengthError) return;

    setSaving(true);
    try {
      await onEdit(comment.id, trimmed);
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save comment');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setActionError(null);
    try {
      await onDelete(comment.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage src={discordAvatarUrl(comment.author)} alt={comment.author.displayName} />
            <AvatarFallback className="text-[10px]">
              {comment.author.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{comment.author.displayName}</span>
          {comment.isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                  Stale
                </Badge>
              </TooltipTrigger>
              <TooltipContent>The chart has changed since this comment was written.</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {format(new Date(comment.updatedAt), 'PP p')}
            {comment.isEdited && ' (edited)'}
          </span>
          {isOwn && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Comment actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditBody(comment.body);
                    setEditError(null);
                    setIsEditing(true);
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeleteOpen(true)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <MarkdownEditor
            initialMarkdown={comment.body}
            error={editError}
            onChange={(value) => {
              setEditBody(value);
              setEditError(null);
            }}
            onSubmit={handleSave}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <MarkdownContent markdown={comment.body} />
      )}

      <CommentReactions
        reactions={comment.reactions}
        onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
      />

      {actionError && <p className="text-destructive text-xs">{actionError}</p>}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
