import { useMemo } from 'react';
import { CommentCard } from '@/components/comment-card';
import { CommentComposer } from '@/components/comment-composer';
import { Loading } from '@/components/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useComments } from '@/hooks/use-comments';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

type CommentSortOrder = 'newest' | 'oldest';

// One shared key (not per-submission) - the preference is global across every comments list,
// not scoped to a particular submission the way Reviews table sort is scoped per event slug.
const COMMENTS_SORT_STORAGE_KEY = 'itl-comments-sort';

export function CommentsPanel({ slug, fileId }: { slug: string; fileId: string }) {
  const auth = useAuth();
  const result = useComments(slug, fileId);
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : null;
  const [sortOrder, setSortOrder] = useLocalStorageState<CommentSortOrder>(
    COMMENTS_SORT_STORAGE_KEY,
    'newest',
  );

  const sortedComments = useMemo(() => {
    if (result.status !== 'loaded') return [];
    return sortOrder === 'newest' ? [...result.comments].reverse() : result.comments;
  }, [result, sortOrder]);

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
          {result.comments.length === 0 ? (
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
              {sortedComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onEdit={result.updateComment}
                  onDelete={result.deleteComment}
                  onToggleReaction={result.toggleReaction}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
