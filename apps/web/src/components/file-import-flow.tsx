import { cn } from 'cn';
import { CircleCheck, FileJson, UploadCloud, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { formatTimestamp } from '@/components/submission-row';
import { Button } from '@/components/ui/button';
import type { useFileImport } from '@/hooks/use-file-import';

export function formatValue(field: string, value: unknown): string {
  if (field === 'submittedAt' && typeof value === 'string') return formatTimestamp(value);
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// Mirrors the conventional diff coloring (added/modified/removed) so the three kinds of
// change read at a glance, consistently across the summary, table, and result badges.
export const CHANGE_KIND_CLASS = {
  insert:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  update: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  ignore: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
} as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Dropzone({
  fileName,
  disabled,
  selectedFile,
  onSelect,
  onClear,
}: {
  fileName: string;
  disabled: boolean;
  selectedFile: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled,
    multiple: false,
    accept: { 'application/json': ['.json'] },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) onSelect(acceptedFiles[0]);
    },
  });

  if (selectedFile) {
    return (
      <div
        {...getRootProps()}
        className={cn(
          'border-primary/50 bg-primary/5 flex items-center gap-3 rounded-md border-2 p-4 text-sm transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          isDragActive && 'border-primary bg-primary/10',
        )}
      >
        <input {...getInputProps()} />
        <FileJson className="text-primary size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{selectedFile.name}</span>
          </p>
          <p className="text-muted-foreground">
            {formatFileSize(selectedFile.size)} ·{' '}
            {isDragActive ? 'Drop to replace' : 'Click or drop to replace'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <X />
          <span className="sr-only">Remove file</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md border border-dashed p-8 text-center text-sm transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        isDragActive ? 'border-primary bg-muted/50' : 'border-input hover:bg-muted/30',
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud className="text-muted-foreground size-6" />
      <p className="text-muted-foreground">
        {isDragActive ? `Drop ${fileName} here` : `Drag & drop ${fileName}, or click to browse`}
      </p>
    </div>
  );
}

type FileImport<Preview, ApplyResult> = ReturnType<
  typeof useFileImport<Preview & { ok: true }, ApplyResult>
>;

// Renders every phase of the pick -> preview -> apply flow except the two that are specific to
// what's being imported: the preview itself and the applied result.
export function FileImportFlow<Preview extends { ok: true }, ApplyResult>({
  fileName,
  importer,
  renderPreview,
  renderApplied,
}: {
  fileName: string;
  importer: FileImport<Preview, ApplyResult>;
  renderPreview: (preview: Preview, onConfirm: () => void, onReset: () => void) => ReactNode;
  renderApplied: (result: ApplyResult) => ReactNode;
}) {
  const { state, pendingFile, setPendingFile, preview, apply, reset } = importer;

  if (state.phase === 'picking' || state.phase === 'previewing') {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          fileName={fileName}
          disabled={state.phase === 'previewing'}
          selectedFile={pendingFile}
          onSelect={setPendingFile}
          onClear={() => setPendingFile(null)}
        />
        <div>
          <Button disabled={!pendingFile || state.phase === 'previewing'} onClick={preview}>
            {state.phase === 'previewing' ? 'Previewing…' : 'Preview'}
          </Button>
        </div>
      </div>
    );
  }

  if (state.phase === 'preview-error' || state.phase === 'apply-error') {
    return (
      <div className="flex flex-col gap-3">
        <div className="border-destructive/50 rounded-md border p-4">
          <ul className="list-disc space-y-1 pl-4">
            {state.errors.map((error, i) => (
              <li key={i} className="text-destructive text-sm">
                {error}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Button variant="outline" onClick={reset}>
            Choose a different file
          </Button>
        </div>
      </div>
    );
  }

  if (state.phase === 'applying') {
    return <p className="text-muted-foreground text-sm">Applying import…</p>;
  }

  if (state.phase === 'applied') {
    return (
      <div className="flex flex-col gap-4">
        {renderApplied(state.result)}
        <div>
          <Button onClick={reset}>Run another import</Button>
        </div>
      </div>
    );
  }

  const { file } = state;
  return renderPreview(state.preview, () => apply(file), reset);
}
