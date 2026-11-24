import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectionExcludedCountQuery,
  buildSelectionSummaryQuery,
  IS_SELECTED_FRAGMENT,
  mapSelectionSummaryRow,
  SelectionsService,
} from './selections.service.js';

const USER = {
  id: 'user-1',
  discordId: 'd-1',
  discordUsername: 'lemone',
  discordAvatarHash: null,
  displayName: null,
  isGlobalAdmin: false,
  createdAt: new Date(),
  lastLoginAt: null,
};

function makeService(existing: unknown) {
  const tx = {
    submissionSelection: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({
        submissionId: 'file-1',
        selectedById: 'user-1',
        selectedAt: new Date('2026-11-24T00:00:00Z'),
        selectedBy: USER,
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
    submissionSelectionLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    submission: { findUnique: vi.fn().mockResolvedValue({ eventId: 'event-1' }) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new SelectionsService(prisma as any), prisma, tx };
}

describe('SelectionsService.setSelected', () => {
  it('creates the selection and logs SELECTED when not yet selected', async () => {
    const { service, tx } = makeService(null);
    const result = await service.setSelected('event-1', 'file-1', 'user-1', true);

    expect(result.selected).toBe(true);
    expect(result.selectedBy?.displayName).toBe('lemone');
    expect(tx.submissionSelection.create).toHaveBeenCalledOnce();
    expect(tx.submissionSelectionLog.create).toHaveBeenCalledWith({
      data: { submissionId: 'file-1', userId: 'user-1', action: 'SELECTED' },
    });
  });

  it('deletes the selection and logs UNSELECTED when currently selected', async () => {
    const { service, tx } = makeService({
      submissionId: 'file-1',
      selectedAt: new Date(),
      selectedBy: USER,
    });
    const result = await service.setSelected('event-1', 'file-1', 'user-2', false);

    expect(result).toEqual({ selected: false, selectedAt: null, selectedBy: null });
    expect(tx.submissionSelection.delete).toHaveBeenCalledOnce();
    expect(tx.submissionSelectionLog.create).toHaveBeenCalledWith({
      data: { submissionId: 'file-1', userId: 'user-2', action: 'UNSELECTED' },
    });
  });

  it('writes nothing when already in the requested state', async () => {
    const selected = makeService({
      submissionId: 'file-1',
      selectedAt: new Date(),
      selectedBy: USER,
    });
    await selected.service.setSelected('event-1', 'file-1', 'user-1', true);
    expect(selected.tx.submissionSelection.create).not.toHaveBeenCalled();
    expect(selected.tx.submissionSelectionLog.create).not.toHaveBeenCalled();

    const unselected = makeService(null);
    await unselected.service.setSelected('event-1', 'file-1', 'user-1', false);
    expect(unselected.tx.submissionSelection.delete).not.toHaveBeenCalled();
    expect(unselected.tx.submissionSelectionLog.create).not.toHaveBeenCalled();
  });

  it('rejects a submission from another event', async () => {
    const { service, prisma } = makeService(null);
    prisma.submission.findUnique.mockResolvedValue({ eventId: 'other-event' });
    await expect(service.setSelected('event-1', 'file-1', 'user-1', true)).rejects.toThrow(
      'No submission',
    );
  });
});

describe('selection queries', () => {
  it('IS_SELECTED_FRAGMENT matches by fileId, not chart hash', () => {
    expect(IS_SELECTED_FRAGMENT.sql).toContain('ss."submissionId" = s."fileId"');
    expect(IS_SELECTED_FRAGMENT.sql).not.toContain('hash');
  });

  it('summary groups selected, non-ignored charts by parsed playstyle, meter and derivedFocus', () => {
    const query = buildSelectionSummaryQuery('event-1');
    expect(query.sql).toContain('JOIN submission_selections');
    expect(query.sql).toContain('NOT s."isIgnored"');
    expect(query.sql).toContain('GROUP BY c.playstyle, c.meter, s."derivedFocus"');
    expect(query.values).toEqual(['event-1']);
  });

  it('excluded count covers ignored or chartless selections', () => {
    const query = buildSelectionExcludedCountQuery('event-1');
    expect(query.sql).toContain('LEFT JOIN charts');
    expect(query.sql).toContain('s."isIgnored" OR c.id IS NULL');
  });

  it('maps bigint counts to numbers', () => {
    expect(
      mapSelectionSummaryRow({
        playstyle: 'SINGLE',
        meter: 10,
        derivedFocus: 'No Tech',
        count: 3n,
      }),
    ).toEqual({ playstyle: 'SINGLE', meter: 10, derivedFocus: 'No Tech', count: 3 });
  });
});
