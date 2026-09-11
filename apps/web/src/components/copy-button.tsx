import { cn } from 'cn';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

// Click to copy `value` to the clipboard; renders `children` as the visible label (callers
// decide whether that's the full value or a truncated form) with a copy/check icon that
// flashes to confirm the copy.
export function CopyButton({
  value,
  title,
  className,
  children,
}: {
  value: string;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        'hover:bg-muted inline-flex items-center gap-1 rounded font-mono text-xs',
        className,
      )}
    >
      {children}
      {copied ? <Check className="size-3 shrink-0" /> : <Copy className="size-3 shrink-0" />}
    </button>
  );
}
