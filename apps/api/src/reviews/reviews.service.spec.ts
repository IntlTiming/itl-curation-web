import { Playstyle } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { ReviewsQueryDto } from './dto/reviews-query.dto.js';
import { buildBaseWhereFragments, mapRawReviewRow } from './reviews.service.js';

const BASE_QUERY: ReviewsQueryDto = {
  playstyle: Playstyle.SINGLE,
  unreviewedOnly: false,
  publiclyReviewableOnly: false,
};

function fragmentTexts(fragments: ReturnType<typeof buildBaseWhereFragments>): string[] {
  return fragments.map((fragment) => fragment.sql);
}

describe('buildBaseWhereFragments', () => {
  it('always includes eventId, playstyle, and isIgnored=false fragments', () => {
    const fragments = buildBaseWhereFragments('event-1', BASE_QUERY);
    const texts = fragmentTexts(fragments);

    expect(texts.some((t) => t.includes('"eventId"'))).toBe(true);
    expect(texts.some((t) => t.includes('c.playstyle'))).toBe(true);
    expect(texts.some((t) => t.includes('"isIgnored"'))).toBe(true);
    expect(texts.some((t) => t.includes('NOT EXISTS'))).toBe(false);
    expect(texts.some((t) => t.includes('similarity'))).toBe(false);
    expect(fragments).toHaveLength(3);
  });

  it('adds a NOT EXISTS fragment keyed on chart hash when unreviewedOnly is true', () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, unreviewedOnly: true });
    const texts = fragmentTexts(fragments);
    const notExistsFragment = texts.find((t) => t.includes('NOT EXISTS'));

    expect(notExistsFragment).toBeDefined();
    expect(notExistsFragment).toContain('"chartHash"');
    expect(notExistsFragment).toContain('c.hash');
    expect(notExistsFragment).not.toContain('fileId');
  });

  it('adds a consentToPublicReview=CONSENTS fragment when publiclyReviewableOnly is true', () => {
    const fragments = buildBaseWhereFragments('event-1', {
      ...BASE_QUERY,
      publiclyReviewableOnly: true,
    });
    const texts = fragmentTexts(fragments);
    const consentFragment = texts.find((t) => t.includes('consentToPublicReview'));

    expect(consentFragment).toBeDefined();
    expect(consentFragment).toContain('CONSENTS');
    expect(fragments).toHaveLength(4);
  });

  it('adds an OR-joined similarity fragment across all 8 searched columns when a search term is present', () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, search: '  mirror  ' });
    const texts = fragmentTexts(fragments);
    const similarityFragment = texts.find((t) => t.includes('similarity'));

    expect(similarityFragment).toBeDefined();
    expect(similarityFragment?.match(/similarity\(/g)).toHaveLength(8);
    expect(similarityFragment).toContain(' OR ');

    const values = fragments.flatMap((f) => f.values);
    // The search term is trimmed before being used as a query parameter.
    expect(values).toContain('mirror');
    expect(values).not.toContain('  mirror  ');
  });

  it('does not add a search fragment for a blank/whitespace-only search term', () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, search: '   ' });
    const texts = fragmentTexts(fragments);

    expect(texts.some((t) => t.includes('similarity'))).toBe(false);
    expect(fragments).toHaveLength(3);
  });
});

describe('mapRawReviewRow', () => {
  it('nests chart fields under a chart object and converts the bigint counts to numbers', () => {
    const row = mapRawReviewRow({
      fileId: 'file-1',
      submitter: 'lemone',
      stepartist: 'Lilly',
      pack: 'Single',
      cmodPreference: 'NO_CMOD',
      consentToPublicReview: 'CONSENTS',
      isIgnored: false,
      hash: 'abc123',
      title: 'MIRROR',
      titleRomaji: '',
      subtitle: '',
      subtitleRomaji: '',
      artist: 'Ado',
      artistRomaji: '',
      playstyle: 'DOUBLE',
      difficulty: 'CHALLENGE',
      meter: 13,
      hasSignificantTimingChanges: true,
      reviewCount: 3n,
      avgRating: 200,
      minRating: 150,
      maxRating: 200,
      stdevRating: 25.0,
    });

    expect(row).toEqual({
      fileId: 'file-1',
      submitter: 'lemone',
      stepartist: 'Lilly',
      pack: 'Single',
      cmodPreference: 'NO_CMOD',
      consentToPublicReview: 'CONSENTS',
      isIgnored: false,
      chart: {
        hash: 'abc123',
        title: 'MIRROR',
        titleRomaji: '',
        subtitle: '',
        subtitleRomaji: '',
        artist: 'Ado',
        artistRomaji: '',
        playstyle: 'DOUBLE',
        difficulty: 'CHALLENGE',
        meter: 13,
        hasSignificantTimingChanges: true,
      },
      reviewCount: 3,
      avgRating: 2,
      minRating: 1.5,
      maxRating: 2,
      stdevRating: 0.25,
    });
    expect(typeof row.reviewCount).toBe('number');
    expect(typeof row.avgRating).toBe('number');
  });

  it('leaves avg/min/max/stdev rating null when no active review carries a rating', () => {
    const row = mapRawReviewRow({
      fileId: 'file-1',
      submitter: 'lemone',
      stepartist: 'Lilly',
      pack: 'Single',
      cmodPreference: 'NO_CMOD',
      consentToPublicReview: null,
      isIgnored: false,
      hash: 'abc123',
      title: 'MIRROR',
      titleRomaji: '',
      subtitle: '',
      subtitleRomaji: '',
      artist: 'Ado',
      artistRomaji: '',
      playstyle: 'DOUBLE',
      difficulty: 'CHALLENGE',
      meter: 13,
      hasSignificantTimingChanges: true,
      reviewCount: 1n,
      avgRating: null,
      minRating: null,
      maxRating: null,
      stdevRating: null,
    });

    expect(row.consentToPublicReview).toBeNull();
    expect(row.avgRating).toBeNull();
    expect(row.minRating).toBeNull();
    expect(row.maxRating).toBeNull();
    expect(row.stdevRating).toBeNull();
  });
});
