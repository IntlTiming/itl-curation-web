import { diffLines, diffWordsWithSpace } from 'diff';
import type { ReviewRevisionEntryContent } from '@/hooks/use-submission-detail';

export type ReviewRevisionFieldChange<T> = { before: T; after: T };

export type ReviewRevisionBasicCheckChange =
  | { kind: 'added'; check: ReviewRevisionEntryContent['basicChecks'][number] }
  | { kind: 'removed'; check: ReviewRevisionEntryContent['basicChecks'][number] };

export type ReviewRevisionNotesDiffSegment = { text: string; changed: boolean };

export type ReviewRevisionNotesDiffLine =
  | { kind: 'unchanged'; text: string }
  | { kind: 'removed' | 'added'; segments: ReviewRevisionNotesDiffSegment[] };

export type ReviewRevisionDiff = {
  rating: ReviewRevisionFieldChange<number | null> | null;
  passing: ReviewRevisionFieldChange<number | null> | null;
  scoring: ReviewRevisionFieldChange<number | null> | null;
  notes: ReviewRevisionNotesDiffLine[] | null;
  basicChecks: ReviewRevisionBasicCheckChange[];
};

// split('\n') on a value ending in '\n' leaves a trailing '' entry - drop it so a hunk doesn't
// grow a phantom blank line.
function splitIntoLines(value: string): string[] {
  const lines = value.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// Word-level diff of one paired old/new line, filtered down to just `kind`'s side: 'removed'
// keeps the shared words plus what only `oldLine` had, 'added' keeps the shared words plus what
// only `newLine` had. Shared words render unmarked (`changed: false`) so only the actual edit is
// highlighted, not the whole line.
function wordSegments(
  oldLine: string,
  newLine: string,
  kind: 'removed' | 'added',
): ReviewRevisionNotesDiffSegment[] {
  const segments: ReviewRevisionNotesDiffSegment[] = [];
  for (const part of diffWordsWithSpace(oldLine, newLine)) {
    if (kind === 'removed' && part.added) continue;
    if (kind === 'added' && part.removed) continue;
    if (part.value === '') continue;
    segments.push({ text: part.value, changed: !!(part.added || part.removed) });
  }
  return segments;
}

// Line-level diff first (git-like structure), then for a straightforward "replaced these N
// lines with N new lines" block, a word-level diff within each paired line so only the actually
// edited words are highlighted instead of the whole line. Falls back to whole-line coloring
// when a block's added/removed line counts don't match 1:1 - pairing mismatched counts would
// need a similarity heuristic that isn't worth the complexity for review notes.
function toNotesDiffLines(before: string, after: string): ReviewRevisionNotesDiffLine[] {
  const result: ReviewRevisionNotesDiffLine[] = [];
  const parts = diffLines(before, after);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.removed && parts[i + 1]?.added) {
      const oldLines = splitIntoLines(part.value);
      const newLines = splitIntoLines(parts[i + 1].value);
      if (oldLines.length === newLines.length) {
        for (let j = 0; j < oldLines.length; j++) {
          result.push({
            kind: 'removed',
            segments: wordSegments(oldLines[j], newLines[j], 'removed'),
          });
        }
        for (let j = 0; j < oldLines.length; j++) {
          result.push({ kind: 'added', segments: wordSegments(oldLines[j], newLines[j], 'added') });
        }
        i++; // the paired 'added' part is consumed too
        continue;
      }
    }

    if (part.added || part.removed) {
      const kind = part.added ? 'added' : 'removed';
      for (const text of splitIntoLines(part.value)) {
        result.push({ kind, segments: [{ text, changed: true }] });
      }
    } else {
      for (const text of splitIntoLines(part.value)) result.push({ kind: 'unchanged', text });
    }
  }

  return result;
}

// Field-by-field comparison between two consecutive states of the same review's content - null
// on a scalar field means "unchanged, don't render a line for it". Basic checks are diffed by
// id+note together: a check whose note merely changed is reported as removed+added, since the
// always-visible note on each rendered badge (see BasicCheckList) already conveys the new text.
// Notes are diffed line-by-line on the raw markdown source (not the rendered output) - see
// review-revision-diff's design discussion for why a rendered-HTML diff isn't used here.
export function diffReviewRevisionContent(
  before: ReviewRevisionEntryContent,
  after: ReviewRevisionEntryContent,
): ReviewRevisionDiff {
  const key = (c: { id: string; note: string | null }) => `${c.id}:${c.note ?? ''}`;
  const beforeKeys = new Set(before.basicChecks.map(key));
  const afterKeys = new Set(after.basicChecks.map(key));

  return {
    rating: before.rating === after.rating ? null : { before: before.rating, after: after.rating },
    passing:
      before.passing === after.passing ? null : { before: before.passing, after: after.passing },
    scoring:
      before.scoring === after.scoring ? null : { before: before.scoring, after: after.scoring },
    notes:
      before.notes === after.notes ? null : toNotesDiffLines(before.notes ?? '', after.notes ?? ''),
    basicChecks: [
      ...before.basicChecks
        .filter((c) => !afterKeys.has(key(c)))
        .map((check) => ({ kind: 'removed' as const, check })),
      ...after.basicChecks
        .filter((c) => !beforeKeys.has(key(c)))
        .map((check) => ({ kind: 'added' as const, check })),
    ],
  };
}
