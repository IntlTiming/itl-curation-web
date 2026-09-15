import { useState, type FormEvent } from 'react';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Button } from '@/components/ui/button';

// Mirrors CreateCommentDto/UpdateCommentDto's @MaxLength() decorators
// (apps/api/src/comments/dto/) - no shared package between frontend/backend here, same
// convention as review-modal.tsx's NOTES_MAX_LENGTH.
const COMMENT_BODY_MAX_LENGTH = 20000;

function lengthLimitError(value: string, max: number): string | null {
  return value.length > max ? `Exceeded length limit (${max} characters)` : null;
}

// An always-visible inline composer, not a modal - unlike ReviewModal's multi-field form, a
// comment is just one markdown field, so a dialog would be overkill for this flat-feed UI.
export function CommentComposer({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  // Bumped after a successful post to force a fresh MarkdownEditor/Tiptap instance - simplest
  // way to clear the editor's content, since Tiptap doesn't expose imperative content resets.
  const [editorKey, setEditorKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);

  async function submitComment() {
    const trimmed = body.trim();
    if (!trimmed) return;

    const nextLengthError = lengthLimitError(trimmed, COMMENT_BODY_MAX_LENGTH);
    setLengthError(nextLengthError);
    if (nextLengthError) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setBody('');
      setEditorKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitComment();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <MarkdownEditor
        key={editorKey}
        initialMarkdown=""
        error={lengthError}
        onChange={(value) => {
          setBody(value);
          setLengthError(null);
        }}
        onSubmit={submitComment}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={submitting || !body.trim()} className="self-end">
        {submitting ? 'Posting…' : 'Post comment'}
      </Button>
    </form>
  );
}
