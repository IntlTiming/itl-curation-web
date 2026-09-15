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
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ChartDetail } from '@/components/chart-detail';
import { Loading } from '@/components/loading';
import { CmoddabilityIndicator, PublicConsentIndicator } from '@/components/reviews-table';
import { SubmissionDetail } from '@/components/submission-detail';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useBasicCheckReasons, type BasicCheckReason } from '@/hooks/use-basic-check-reasons';
import { useSubmissionDetail } from '@/hooks/use-submission-detail';

const RATING_OPTIONS = [0, 1, 1.5, 2, 2.5, 3];
const PASSING_OPTIONS = [1, 2, 3, 4, 5];
const SCORING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NONE_VALUE = '__none__';

// Mirrors the @MaxLength() decorators on UpsertReviewDto (apps/api/src/reviews/dto/upsert-review.dto.ts)
// - no shared package between frontend/backend here, same as the rest of this codebase's boundary
// types (e.g. submission-detail.tsx's TECH_TAG_CODE). Kept high enough that no real reviewer should
// ever hit it; it exists only so the API's hard limit doesn't surface as a raw request failure.
const NOTES_MAX_LENGTH = 20000;
const BASIC_CHECK_NOTE_MAX_LENGTH = 2000;

function lengthLimitError(value: string, max: number): string | null {
  return value.length > max ? `Exceeded length limit (${max} characters)` : null;
}

type BasicCheckFormValue = { checked: boolean; note: string };

type FormState = {
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  basicChecks: Record<string, BasicCheckFormValue>;
  notes: string;
};

function buildFormState(
  reasons: BasicCheckReason[],
  ownReview:
    | {
        rating: number | null;
        passing: number | null;
        scoring: number | null;
        notes: string | null;
        basicChecks: { id: string; note: string | null }[];
      }
    | undefined,
): FormState {
  const basicChecks: Record<string, BasicCheckFormValue> = {};
  for (const reason of reasons) {
    const match = ownReview?.basicChecks.find((c) => c.id === reason.id);
    basicChecks[reason.id] = { checked: match !== undefined, note: match?.note ?? '' };
  }
  return {
    rating: ownReview?.rating ?? null,
    passing: ownReview?.passing ?? null,
    scoring: ownReview?.scoring ?? null,
    basicChecks,
    notes: ownReview?.notes ?? '',
  };
}

function formsEqual(a: FormState, b: FormState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Owns the Tiptap editor instance so useEditor is only ever called once initial content is
// known - a fresh mount per review-modal open (the parent unmounts the whole modal on close),
// so there's no need to imperatively re-sync content after the fact.
function NotesEditor({
  initialMarkdown,
  onChange,
  error,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  error?: string | null;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class:
          'prose-sm min-h-24 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
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

function BasicCheckRow({
  reason,
  value,
  onChange,
  error,
}: {
  reason: BasicCheckReason;
  value: BasicCheckFormValue;
  onChange: (next: BasicCheckFormValue) => void;
  error?: string | null;
}) {
  const checkboxId = useId();
  const noteId = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={value.checked}
          onCheckedChange={(checked) => onChange({ ...value, checked: checked === true })}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={checkboxId}>{reason.label}</Label>
          </TooltipTrigger>
          <TooltipContent side="right">{reason.description}</TooltipContent>
        </Tooltip>
      </div>
      {value.checked && (
        <div className="ml-6 grid w-auto gap-1">
          <Input
            id={noteId}
            placeholder="Optional detail (e.g. where this occurred)…"
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            aria-invalid={!!error}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function ReviewModal({
  eventSlug,
  fileId,
  onClose,
  onSaved,
}: {
  eventSlug: string;
  fileId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const detail = useSubmissionDetail(eventSlug, fileId);
  const reasonsResult = useBasicCheckReasons(eventSlug);

  const [form, setForm] = useState<FormState | null>(null);
  const [initialForm, setInitialForm] = useState<FormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesLengthError, setNotesLengthError] = useState<string | null>(null);
  const [basicCheckNoteLengthErrors, setBasicCheckNoteLengthErrors] = useState<
    Record<string, string>
  >({});

  const currentUserId = auth.status === 'authenticated' ? auth.user.id : null;

  useEffect(() => {
    if (form !== null) return;
    if (detail.status !== 'loaded' || reasonsResult.status !== 'loaded' || !currentUserId) return;
    const ownReview = detail.reviews.find(
      (r) => r.submissionId === fileId && r.reviewer.id === currentUserId,
    );
    const initial = buildFormState(reasonsResult.reasons, ownReview);
    setForm(initial);
    setInitialForm(initial);
    setIsEditing(ownReview !== undefined);
  }, [form, detail, reasonsResult, currentUserId, fileId]);

  const isDirty = form !== null && initialForm !== null && !formsEqual(form, initialForm);

  const missingFields: string[] = [];
  if (form?.rating == null) missingFields.push('a rating');
  if (!form?.notes.trim()) missingFields.push('notes');
  const validationMessage = missingFields.length
    ? `Add ${missingFields.join(' and ')} to submit`
    : null;

  function requestClose() {
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    const nextNotesError = lengthLimitError(form.notes, NOTES_MAX_LENGTH);
    const nextBasicCheckErrors: Record<string, string> = {};
    for (const [reasonId, value] of Object.entries(form.basicChecks)) {
      if (!value.checked) continue;
      const noteError = lengthLimitError(value.note, BASIC_CHECK_NOTE_MAX_LENGTH);
      if (noteError) nextBasicCheckErrors[reasonId] = noteError;
    }
    setNotesLengthError(nextNotesError);
    setBasicCheckNoteLengthErrors(nextBasicCheckErrors);
    if (nextNotesError || Object.keys(nextBasicCheckErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(eventSlug)}/reviews/${encodeURIComponent(fileId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: form.rating,
            passing: form.passing,
            scoring: form.scoring,
            notes: form.notes.trim() || null,
            basicChecks: Object.entries(form.basicChecks)
              .filter(([, v]) => v.checked)
              .map(([basicCheckReasonId, v]) => ({
                basicCheckReasonId,
                note: v.note.trim() || undefined,
              })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'Failed to save review');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSubmitting(false);
    }
  }

  const disqualifiedReasons =
    reasonsResult.status === 'loaded'
      ? reasonsResult.reasons.filter((r) => r.level === 'DISQUALIFIED')
      : [];
  const warningReasons =
    reasonsResult.status === 'loaded'
      ? reasonsResult.reasons.filter((r) => r.level === 'WARNING')
      : [];

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && requestClose()}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              {detail.status === 'loaded'
                ? `Review: ${detail.submission.chart?.titleRomaji || detail.submission.chart?.title || detail.submission.fileId}`
                : 'Review'}
              {detail.status === 'loaded' && detail.submission.chart && (
                <>
                  <CmoddabilityIndicator
                    chart={detail.submission.chart}
                    cmodPreference={detail.submission.cmodPreference}
                  />
                  <PublicConsentIndicator
                    submitter={detail.submission.submitter}
                    consentToPublicReview={detail.submission.consentToPublicReview}
                  />
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {(detail.status === 'loading' || reasonsResult.status === 'loading' || form === null) && (
            <Loading message="Loading submission…" />
          )}
          {detail.status === 'error' && (
            <p className="text-destructive text-sm">
              {detail.notFound ? 'Submission not found.' : "Couldn't load submission."}
            </p>
          )}

          {detail.status === 'loaded' && reasonsResult.status === 'loaded' && form && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="rounded-md border p-3">
                <SubmissionDetail
                  submission={detail.submission}
                  fileId={detail.submission.fileId}
                />
                {detail.submission.chart && <ChartDetail chart={detail.submission.chart} />}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label>Rating</Label>
                  <Select
                    value={form.rating === null ? NONE_VALUE : String(form.rating)}
                    onValueChange={(v) =>
                      setForm({ ...form, rating: v === NONE_VALUE ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {RATING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value.toFixed(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Passing</Label>
                  <Select
                    value={form.passing === null ? NONE_VALUE : String(form.passing)}
                    onValueChange={(v) =>
                      setForm({ ...form, passing: v === NONE_VALUE ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {PASSING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Scoring</Label>
                  <Select
                    value={form.scoring === null ? NONE_VALUE : String(form.scoring)}
                    onValueChange={(v) =>
                      setForm({ ...form, scoring: v === NONE_VALUE ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {SCORING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3">
                <Label>Basic Checks</Label>
                <div className="grid items-start gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <p className="text-muted-foreground text-xs font-medium">Disqualifying</p>
                    {disqualifiedReasons.map((reason) => (
                      <BasicCheckRow
                        key={reason.id}
                        reason={reason}
                        value={form.basicChecks[reason.id] ?? { checked: false, note: '' }}
                        error={basicCheckNoteLengthErrors[reason.id]}
                        onChange={(next) => {
                          setForm({
                            ...form,
                            basicChecks: { ...form.basicChecks, [reason.id]: next },
                          });
                          setBasicCheckNoteLengthErrors((prev) => {
                            if (!(reason.id in prev)) return prev;
                            const { [reason.id]: _removed, ...rest } = prev;
                            return rest;
                          });
                        }}
                      />
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <p className="text-muted-foreground text-xs font-medium">Warning</p>
                    {warningReasons.map((reason) => (
                      <BasicCheckRow
                        key={reason.id}
                        reason={reason}
                        value={form.basicChecks[reason.id] ?? { checked: false, note: '' }}
                        error={basicCheckNoteLengthErrors[reason.id]}
                        onChange={(next) => {
                          setForm({
                            ...form,
                            basicChecks: { ...form.basicChecks, [reason.id]: next },
                          });
                          setBasicCheckNoteLengthErrors((prev) => {
                            if (!(reason.id in prev)) return prev;
                            const { [reason.id]: _removed, ...rest } = prev;
                            return rest;
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <NotesEditor
                  initialMarkdown={initialForm?.notes ?? ''}
                  error={notesLengthError}
                  onChange={(notes) => {
                    setForm((prev) => (prev ? { ...prev, notes } : prev));
                    setNotesLengthError(null);
                  }}
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={requestClose}>
                  Cancel
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button type="submit" disabled={submitting || !!validationMessage}>
                        {submitting
                          ? 'Submitting…'
                          : isEditing
                            ? 'Submit revision'
                            : 'Submit review'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {validationMessage && <TooltipContent>{validationMessage}</TooltipContent>}
                </Tooltip>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this review. Closing now will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
