import { Playstyle, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { ReviewsQueryDto } from './dto/reviews-query.dto.js';
import {
  buildBaseWhereFragments,
  buildReviewStatsFragment,
  buildTechTagMatchFragment,
  buildTechTagRankFragment,
  mapRawReviewRow,
  reviewFieldsChanged,
  reviewFieldsEmpty,
} from './reviews.service.js';

const BASE_QUERY: ReviewsQueryDto = {
  playstyle: Playstyle.SINGLE,
  unreviewedOnly: false,
  publiclyReviewableOnly: false,
  techTags: [],
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

  it('adds an EXISTS tag-overlap fragment when techTags is non-empty', () => {
    const fragments = buildBaseWhereFragments('event-1', {
      ...BASE_QUERY,
      techTags: ['BR', 'XO'],
    });
    const texts = fragmentTexts(fragments);
    const tagFragment = texts.find((t) => t.includes('submission_tech_tags'));

    expect(tagFragment).toBeDefined();
    expect(tagFragment).toContain('EXISTS');
    expect(tagFragment).toContain('tech_tags');
    expect(tagFragment).toContain('tt.code');
    expect(fragments).toHaveLength(4);

    const values = fragments.flatMap((f) => f.values);
    expect(values).toContain('BR');
    expect(values).toContain('XO');
  });

  it('does not add a tag fragment when techTags is empty', () => {
    const fragments = buildBaseWhereFragments('event-1', BASE_QUERY);
    const texts = fragmentTexts(fragments);

    expect(texts.some((t) => t.includes('submission_tech_tags'))).toBe(false);
    expect(fragments).toHaveLength(3);
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

  // similarity() can't score a 1-2 character term meaningfully (see SHORT_SEARCH_TERM_LENGTH's
  // comment) - below that length the query falls back to a plain substring ILIKE instead.
  it('uses an OR-joined ILIKE fragment across all 8 searched columns for a 1-character term', () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, search: 'a' });
    const texts = fragmentTexts(fragments);
    const likeFragment = texts.find((t) => t.includes('ILIKE'));

    expect(likeFragment).toBeDefined();
    expect(texts.some((t) => t.includes('similarity'))).toBe(false);
    expect(likeFragment?.match(/ILIKE/g)).toHaveLength(8);
    expect(likeFragment).toContain(' OR ');

    const values = fragments.flatMap((f) => f.values);
    expect(values).toContain('%a%');
  });

  it('still uses similarity for a 3-character term (the ILIKE fallback only applies below that)', () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, search: 'abc' });
    const texts = fragmentTexts(fragments);

    expect(texts.some((t) => t.includes('similarity'))).toBe(true);
    expect(texts.some((t) => t.includes('ILIKE'))).toBe(false);
  });

  it("escapes the short term's own LIKE wildcard characters so they match literally", () => {
    const fragments = buildBaseWhereFragments('event-1', { ...BASE_QUERY, search: '%_' });
    const values = fragments.flatMap((f) => f.values);

    expect(values).toContain('%\\%\\_%');
  });
});

describe('buildReviewStatsFragment', () => {
  it('guards stdev_rating with a CASE that nulls it out below 2 non-null ratings', () => {
    const fragment = buildReviewStatsFragment(Prisma.sql`c.hash`);

    expect(fragment.sql).toContain('CASE WHEN COUNT(rating) < 2 THEN NULL');
    expect(fragment.sql).toContain('STDDEV_POP(rating)');
  });

  it('guards on COUNT(rating), not review_count/COUNT(*), since rating is nullable', () => {
    const fragment = buildReviewStatsFragment(Prisma.sql`c.hash`);
    // review_count itself must stay COUNT(*) (reviews with no rating still count as reviews) -
    // only the stdev guard should key off COUNT(rating).
    expect(fragment.sql).toContain('COUNT(*)');
    expect(fragment.sql).not.toContain('CASE WHEN COUNT(*) < 2');
  });
});

describe('buildTechTagMatchFragment', () => {
  it('counts overlap against the selected codes and the total claimed count separately', () => {
    const fragment = buildTechTagMatchFragment(['BR', 'XO']);

    expect(fragment.sql).toContain('FILTER (WHERE tt.code IN');
    expect(fragment.sql).toContain('submission_tech_tags');
    expect(fragment.sql).toContain('"techTagId"');
    expect(fragment.sql).toContain('"submissionId"');
    expect(fragment.values).toContain('BR');
    expect(fragment.values).toContain('XO');
  });
});

describe('buildTechTagRankFragment', () => {
  it('ranks an exact tag-set match (overlap = claimed = selected count) into tier 0', () => {
    const fragment = buildTechTagRankFragment(['BR', 'XO']);

    expect(fragment.sql).toContain('tag_match.overlap_count = tag_match.claimed_count');
    expect(fragment.values).toContain(2);
  });

  it('orders by overlap_count descending as the tiebreak after the exact-match tier', () => {
    const fragment = buildTechTagRankFragment(['BR']);

    expect(fragment.sql).toContain('tag_match.overlap_count DESC');
  });

  it('orders by extra-tag count ascending as the final tiebreak', () => {
    const fragment = buildTechTagRankFragment(['BR']);

    expect(fragment.sql).toContain('(tag_match.claimed_count - tag_match.overlap_count) ASC');
  });
});

describe('mapRawReviewRow', () => {
  it('nests chart fields under a chart object and converts the bigint counts to numbers', () => {
    const row = mapRawReviewRow(
      {
        fileId: 'file-1',
        submitter: 'lemone',
        stepartist: 'Lilly',
        pack: 'Single',
        cmodPreference: 'NO_CMOD',
        consentToPublicReview: 'CONSENTS',
        isIgnored: false,
        techTags: ['Brackets (includes Bracket Taps)', 'Crossovers'],
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
        hasOwnReview: true,
        commentCount: 2n,
        lastActivity: new Date('2026-02-01T00:00:00Z'),
      },
      [{ id: 'bcr-1', code: 'BEAT_0', label: 'Beat 0', level: 'WARNING' }],
    );

    expect(row).toEqual({
      fileId: 'file-1',
      submitter: 'lemone',
      stepartist: 'Lilly',
      pack: 'Single',
      cmodPreference: 'NO_CMOD',
      consentToPublicReview: 'CONSENTS',
      isIgnored: false,
      techTags: ['Brackets (includes Bracket Taps)', 'Crossovers'],
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
      hasOwnReview: true,
      commentCount: 2,
      lastActivity: new Date('2026-02-01T00:00:00Z'),
      basicChecks: [{ id: 'bcr-1', code: 'BEAT_0', label: 'Beat 0', level: 'WARNING' }],
      hasWarning: true,
      hasDisqualification: false,
    });
    expect(typeof row.reviewCount).toBe('number');
    expect(typeof row.avgRating).toBe('number');
    expect(typeof row.commentCount).toBe('number');
  });

  it('leaves avg/min/max/stdev rating null when no active review carries a rating', () => {
    const row = mapRawReviewRow(
      {
        fileId: 'file-1',
        submitter: 'lemone',
        stepartist: 'Lilly',
        pack: 'Single',
        cmodPreference: 'NO_CMOD',
        consentToPublicReview: null,
        isIgnored: false,
        techTags: [],
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
        hasOwnReview: false,
        commentCount: 0n,
        lastActivity: null,
      },
      [],
    );

    expect(row.consentToPublicReview).toBeNull();
    expect(row.hasOwnReview).toBe(false);
    expect(row.avgRating).toBeNull();
    expect(row.minRating).toBeNull();
    expect(row.maxRating).toBeNull();
    expect(row.stdevRating).toBeNull();
    expect(row.commentCount).toBe(0);
    expect(row.lastActivity).toBeNull();
    expect(row.basicChecks).toEqual([]);
    expect(row.hasWarning).toBe(false);
    expect(row.hasDisqualification).toBe(false);
  });

  it('derives hasWarning/hasDisqualification independently, and DISQUALIFIED wins visually when both are present', () => {
    const base = {
      fileId: 'file-1',
      submitter: 'lemone',
      stepartist: 'Lilly',
      pack: 'Single',
      cmodPreference: 'NO_CMOD' as const,
      consentToPublicReview: null,
      isIgnored: false,
      techTags: [],
      hash: 'abc123',
      title: 'MIRROR',
      titleRomaji: '',
      subtitle: '',
      subtitleRomaji: '',
      artist: 'Ado',
      artistRomaji: '',
      playstyle: 'DOUBLE' as const,
      difficulty: 'CHALLENGE' as const,
      meter: 13,
      hasSignificantTimingChanges: true,
      reviewCount: 2n,
      avgRating: null,
      minRating: null,
      maxRating: null,
      stdevRating: null,
      hasOwnReview: false,
      commentCount: 0n,
      lastActivity: null,
    };

    const row = mapRawReviewRow(base, [
      { id: 'bcr-1', code: 'BEAT_0', label: 'Beat 0', level: 'WARNING' },
      { id: 'bcr-2', code: 'PROFANITY', label: 'Profanity', level: 'DISQUALIFIED' },
    ]);

    expect(row.hasWarning).toBe(true);
    expect(row.hasDisqualification).toBe(true);
  });
});

describe('reviewFieldsChanged', () => {
  const BASE = { rating: 150, passing: 3, scoring: 7, notes: 'looks good', basicChecks: [] };

  it('returns false when every field is identical, regardless of key order', () => {
    expect(reviewFieldsChanged(BASE, { ...BASE })).toBe(false);
  });

  it('returns true when a scalar field differs', () => {
    expect(reviewFieldsChanged(BASE, { ...BASE, rating: 200 })).toBe(true);
    expect(reviewFieldsChanged(BASE, { ...BASE, notes: 'changed' })).toBe(true);
  });

  it('is insensitive to basicChecks array order', () => {
    const a = {
      ...BASE,
      basicChecks: [
        { basicCheckReasonId: 'b', note: null },
        { basicCheckReasonId: 'a', note: null },
      ],
    };
    const b = {
      ...BASE,
      basicChecks: [
        { basicCheckReasonId: 'a', note: null },
        { basicCheckReasonId: 'b', note: null },
      ],
    };
    expect(reviewFieldsChanged(a, b)).toBe(false);
  });

  it('returns true when a basicCheck note differs', () => {
    const a = { ...BASE, basicChecks: [{ basicCheckReasonId: 'a', note: 'measure 12' }] };
    const b = { ...BASE, basicChecks: [{ basicCheckReasonId: 'a', note: 'measure 13' }] };
    expect(reviewFieldsChanged(a, b)).toBe(true);
  });

  it('returns true when the basicChecks set has a different size', () => {
    const a = { ...BASE, basicChecks: [{ basicCheckReasonId: 'a', note: null }] };
    const b = { ...BASE, basicChecks: [] };
    expect(reviewFieldsChanged(a, b)).toBe(true);
  });
});

describe('reviewFieldsEmpty', () => {
  it('returns true when every field is null/empty', () => {
    expect(
      reviewFieldsEmpty({
        rating: null,
        passing: null,
        scoring: null,
        notes: null,
        basicChecks: [],
      }),
    ).toBe(true);
  });

  it('returns false when only rating is set', () => {
    expect(
      reviewFieldsEmpty({
        rating: 150,
        passing: null,
        scoring: null,
        notes: null,
        basicChecks: [],
      }),
    ).toBe(false);
  });

  it('returns false when only a basic check is set, even with no note', () => {
    expect(
      reviewFieldsEmpty({
        rating: null,
        passing: null,
        scoring: null,
        notes: null,
        basicChecks: [{ basicCheckReasonId: 'a', note: null }],
      }),
    ).toBe(false);
  });

  it('returns false when only notes is set', () => {
    expect(
      reviewFieldsEmpty({
        rating: null,
        passing: null,
        scoring: null,
        notes: 'hi',
        basicChecks: [],
      }),
    ).toBe(false);
  });
});
