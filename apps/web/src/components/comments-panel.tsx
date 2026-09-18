import { useMemo } from 'react';
import { CommentCard } from '@/components/comment-card';
import { CommentComposer } from '@/components/comment-composer';
import { Loading } from '@/components/loading';
import { ReviewRevisionCard } from '@/components/review-revision-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useComments, type SubmissionComment } from '@/hooks/use-comments';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import type { ReviewRevisionEntry } from '@/hooks/use-submission-detail';

type CommentSortOrder = 'newest' | 'oldest';

// One shared key (not per-submission) - the preference is global across every comments list,
// not scoped to a particular submission the way Reviews table sort is scoped per event slug.
const COMMENTS_SORT_STORAGE_KEY = 'itl-comments-sort';

type FeedItem =
  | { kind: 'comment'; timestamp: string; comment: SubmissionComment }
  | { kind: 'revision'; timestamp: string; entry: ReviewRevisionEntry };

export function CommentsPanel({
  slug,
  fileId,
  reviewRevisions,
}: {
  slug: string;
  fileId: string;
  reviewRevisions: ReviewRevisionEntry[];
}) {
  const auth = useAuth();
  const result = useComments(slug, fileId);
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : null;
  const [sortOrder, setSortOrder] = useLocalStorageState<CommentSortOrder>(
    COMMENTS_SORT_STORAGE_KEY,
    'newest',
  );

  // Each revision entry's chain predecessor (for diffing "updated" cards against), grouped by
  // reviewId and keyed by the following entry's own id - see reviews.service.ts's
  // buildReviewRevisionEntries, which already emits each review's entries in chain order.
  const previousByEntryId = useMemo(() => {
    const map = new Map<string, ReviewRevisionEntry>();
    const byReview = new Map<string, ReviewRevisionEntry[]>();
    for (const entry of reviewRevisions) {
      const chain = byReview.get(entry.reviewId) ?? [];
      chain.push(entry);
      byReview.set(entry.reviewId, chain);
    }
    for (const chain of byReview.values()) {
      for (let i = 1; i < chain.length; i++) map.set(chain[i].id, chain[i - 1]);
    }
    return map;
  }, [reviewRevisions]);

  // Merges comments and review-revision entries into one chronologically sorted feed, sharing
  // the same Newest/Oldest control. Comments sort by createdAt (not updatedAt) to match today's
  // behavior exactly - an edited comment doesn't jump position; the card's *displayed* timestamp
  // stays updatedAt. Revision entries have a single fixed timestamp per historical state.
  const feedItems = useMemo(() => {
    if (result.status !== 'loaded') return [];
    const items: FeedItem[] = [
      ...result.comments.map((comment): FeedItem => ({
        kind: 'comment',
        timestamp: comment.createdAt,
        comment,
      })),
      ...reviewRevisions.map((entry): FeedItem => ({
        kind: 'revision',
        timestamp: entry.timestamp,
        entry,
      })),
    ];
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sortOrder === 'newest' ? items.reverse() : items;
  }, [result, reviewRevisions, sortOrder]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">
        Comments{result.status === 'loaded' ? ` (${result.comments.length})` : ''}
      </h2>

      <CommentComposer onSubmit={result.createComment} />

      {result.status === 'loading' && <Loading message="Loading comments…" />}
      {result.status === 'error' && (
        <p className="text-destructive text-sm">Couldn't load comments.</p>
      )}
      {result.status === 'loaded' && (
        <div className="flex flex-col gap-2">
          {feedItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No comments yet.</p>
          ) : (
            <>
              <div className="flex justify-start">
                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as CommentSortOrder)}
                >
                  <SelectTrigger className="text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {feedItems.map((item) =>
                item.kind === 'comment' ? (
                  <CommentCard
                    key={item.comment.id}
                    comment={item.comment}
                    eventSlug={slug}
                    currentUserId={currentUserId}
                    onEdit={result.updateComment}
                    onDelete={result.deleteComment}
                    onToggleReaction={result.toggleReaction}
                  />
                ) : (
                  <ReviewRevisionCard
                    key={item.entry.id}
                    entry={item.entry}
                    previous={previousByEntryId.get(item.entry.id)}
                    eventSlug={slug}
                  />
                ),
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
