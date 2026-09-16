import { describe, expect, it } from 'vitest';
import {
  buildDerivedFocusBreakdownQuery,
  buildFocusBreakdownQuery,
  buildMeterCoverageQuery,
  mapCategoryCountRow,
  mapMeterCoverageRow,
} from './overview.service.js';

describe('buildMeterCoverageQuery', () => {
  it('groups reviewable submissions by chart playstyle and meter, excluding ignored/errored ones', () => {
    const query = buildMeterCoverageQuery('event-1');
    expect(query.sql).toContain('GROUP BY c.playstyle, c.meter');
    expect(query.sql).toContain('"isIgnored"');
    expect(query.sql).toContain('"processingError"');
    expect(query.values).toEqual(['event-1']);
  });

  it('counts reviewed via an EXISTS with no chartHash filter, so a stale-only review still counts', () => {
    const query = buildMeterCoverageQuery('event-1');
    expect(query.sql).toContain('"reviewedCount"');
    expect(query.sql).toContain(
      'EXISTS (SELECT 1 FROM reviews r WHERE r."submissionId" = s."fileId")',
    );
    expect(query.sql).not.toContain('chartHash');
  });
});

describe('buildFocusBreakdownQuery / buildDerivedFocusBreakdownQuery', () => {
  it('groups by playstyle, meter, and the raw focus value', () => {
    const query = buildFocusBreakdownQuery('event-1');
    expect(query.sql).toContain('s.focus AS category');
    expect(query.sql).toContain('GROUP BY c.playstyle, c.meter, s.focus');
    expect(query.values).toEqual(['event-1']);
  });

  it('groups by playstyle, meter, and the derivedFocus bucket', () => {
    const query = buildDerivedFocusBreakdownQuery('event-1');
    expect(query.sql).toContain('s."derivedFocus" AS category');
    expect(query.sql).toContain('GROUP BY c.playstyle, c.meter, s."derivedFocus"');
  });

  it('scopes both queries to the same reviewable population as the coverage query', () => {
    for (const query of [
      buildFocusBreakdownQuery('event-1'),
      buildDerivedFocusBreakdownQuery('event-1'),
    ]) {
      expect(query.sql).toContain('"isIgnored"');
      expect(query.sql).toContain('"processingError"');
    }
  });
});

describe('mapMeterCoverageRow', () => {
  it('converts bigint counts to numbers', () => {
    const mapped = mapMeterCoverageRow({
      playstyle: 'SINGLE',
      meter: 13,
      reviewableCount: 10n,
      reviewedCount: 4n,
    });
    expect(mapped).toEqual({
      playstyle: 'SINGLE',
      meter: 13,
      reviewableCount: 10,
      reviewedCount: 4,
    });
  });
});

describe('mapCategoryCountRow', () => {
  it('converts the bigint count to a number', () => {
    const mapped = mapCategoryCountRow({
      playstyle: 'DOUBLE',
      meter: 20,
      category: 'No Tech',
      count: 7n,
    });
    expect(mapped).toEqual({ playstyle: 'DOUBLE', meter: 20, category: 'No Tech', count: 7 });
  });
});
