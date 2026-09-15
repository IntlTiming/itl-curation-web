import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';

declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
import { cn } from 'cn';
import { Bold, Italic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

// Owns the Tiptap editor instance so useEditor is only ever called once initial content is
// known - callers that fully unmount on close (e.g. review-modal.tsx) get a fresh mount per
// open, so there's no need to imperatively re-sync content after the fact. Shared between
// review notes and comment bodies - both store/render the same markdown-via-Tiptap convention.
export function MarkdownEditor({
  initialMarkdown,
  onChange,
  onSubmit,
  error,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  // When provided, plain Enter submits instead of inserting a paragraph break (Shift+Enter
  // still inserts one) - the Slack/Discord/GitHub-comment convention, same on Windows and
  // macOS. Opt-in rather than the editor's own default, since review-modal.tsx's notes field
  // is a long-form field where Enter should just keep making paragraphs.
  onSubmit?: () => void;
  error?: string | null;
}) {
  // Read via a ref inside handleKeyDown (captured once at editor creation, below) rather than
  // closed over directly, so a caller passing a new onSubmit identity on every render (e.g.
  // comment-composer.tsx's inline arrow function) doesn't submit a stale callback.
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class:
          'prose-sm min-h-24 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
      },
      handleKeyDown: (_view, event) => {
        const plainEnter =
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey;
        if (plainEnter && onSubmitRef.current) {
          event.preventDefault();
          onSubmitRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
  });

  return (
    <div className="grid gap-1.5">
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Bold"
          aria-pressed={editor?.isActive('bold') ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Italic"
          aria-pressed={editor?.isActive('italic') ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Button>
      </div>
      <div
        className={cn(
          'rounded-md border px-3 py-2 focus-within:ring-3',
          error
            ? 'border-destructive ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40 ring-3'
            : 'border-input focus-within:border-ring focus-within:ring-ring/50',
        )}
      >
        <EditorContent editor={editor} />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
