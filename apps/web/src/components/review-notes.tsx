import Markdown from 'react-markdown';

// Single shared renderer for Review.notes wherever it's displayed (submission details page,
// and anywhere else in the future) - raw HTML passthrough is deliberately never enabled
// (no rehype-raw), since notes are reviewer-submitted text and this keeps them from ever
// becoming an XSS vector.
//
// No typography plugin is installed in this repo, so headings/lists/emphasis are styled here
// via arbitrary-variant utilities on the wrapper instead - consistent with the rest of the
// codebase's utility-first styling.
export function ReviewNotes({ markdown }: { markdown: string | null }) {
  if (!markdown) return <span className="text-muted-foreground text-xs">No notes</span>;
  return (
    <div className="[&_blockquote]:text-muted-foreground [&_code]:bg-muted text-xs [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_em]:italic [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-1.5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown>{markdown}</Markdown>
    </div>
  );
}
