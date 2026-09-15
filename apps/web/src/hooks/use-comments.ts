import { useCallback, useEffect, useState } from 'react';

export type CommentReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  // Display names of everyone who reacted with this emoji, for a hover tooltip - "You" always
  // leads the list when the current user is among them.
  reactedBy: string[];
};

export type SubmissionComment = {
  id: string;
  submissionId: string;
  author: {
    id: string;
    displayName: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  body: string;
  createdAt: string;
  updatedAt: string;
  // True when this comment's chartHash snapshot no longer matches the chart's current hash -
  // unlike Review's isStale, this is never combined with an isFromDifferentSubmission concept,
  // since comments never cross-match submissions (see prisma/schema.prisma's Comment model).
  isStale: boolean;
  // No edit-history is kept - just a flag derived server-side from createdAt/updatedAt.
  isEdited: boolean;
  reactions: CommentReaction[];
};

export type CommentsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; comments: SubmissionComment[] };

function commentsUrl(slug: string, fileId: string): string {
  return `/api/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(fileId)}/comments`;
}

export function useComments(slug: string, fileId: string) {
  const [state, setState] = useState<CommentsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    fetch(commentsUrl(slug, fileId))
      .then((res) => (res.ok ? (res.json() as Promise<SubmissionComment[]>) : Promise.reject()))
      .then((comments) => setState({ status: 'loaded', comments }))
      .catch(() => setState({ status: 'error' }));
  }, [slug, fileId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createComment(body: string): Promise<void> {
    const res = await fetch(commentsUrl(slug, fileId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.message ?? 'Failed to post comment');
    }
    refetch();
  }

  async function updateComment(commentId: string, body: string): Promise<void> {
    const res = await fetch(`${commentsUrl(slug, fileId)}/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.message ?? 'Failed to update comment');
    }
    refetch();
  }

  async function deleteComment(commentId: string): Promise<void> {
    const res = await fetch(`${commentsUrl(slug, fileId)}/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.message ?? 'Failed to delete comment');
    }
    refetch();
  }

  // Patches only the affected comment's reactions from the response, rather than a full
  // refetch - keeps any other comment's in-progress edit/composer state untouched.
  async function toggleReaction(commentId: string, emoji: string): Promise<void> {
    const res = await fetch(
      `${commentsUrl(slug, fileId)}/${encodeURIComponent(commentId)}/reactions/toggle`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      },
    );
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.message ?? 'Failed to react to comment');
    }
    const { reactions } = (await res.json()) as { reactions: CommentReaction[] };
    setState((prev) =>
      prev.status === 'loaded'
        ? {
            ...prev,
            comments: prev.comments.map((comment) =>
              comment.id === commentId ? { ...comment, reactions } : comment,
            ),
          }
        : prev,
    );
  }

  return { ...state, refetch, createComment, updateComment, deleteComment, toggleReaction };
}
