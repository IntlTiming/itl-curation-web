import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REACTION_EMOJI,
  mapCommentForResponse,
  mapCommentReactions,
} from './comments.service.js';

const USER_1 = { displayName: null, discordUsername: 'lemone' };
const USER_2 = { displayName: 'Ado', discordUsername: 'ado-official' };

describe('mapCommentReactions', () => {
  it('always includes the default emoji at count 0 when nobody has reacted', () => {
    const result = mapCommentReactions([], 'user-1');
    expect(result).toEqual([
      { emoji: DEFAULT_REACTION_EMOJI, count: 0, reactedByMe: false, reactedBy: [] },
    ]);
  });

  it('groups reactions by emoji and marks reactedByMe for the current user', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🎉',
          userId: 'user-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_1,
        },
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          user: USER_2,
        },
      ],
      'user-1',
    );

    const party = result.find((r) => r.emoji === '🎉');
    expect(party).toEqual({ emoji: '🎉', count: 2, reactedByMe: true, reactedBy: ['You', 'Ado'] });
  });

  it('sorts the default emoji first even when other emoji were reacted to earlier', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_2,
        },
        {
          emoji: DEFAULT_REACTION_EMOJI,
          userId: 'user-1',
          createdAt: new Date('2026-01-05T00:00:00Z'),
          user: USER_1,
        },
      ],
      'user-1',
    );

    expect(result[0].emoji).toBe(DEFAULT_REACTION_EMOJI);
  });

  it('orders non-default emoji by earliest reaction time', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🚀',
          userId: 'user-1',
          createdAt: new Date('2026-01-05T00:00:00Z'),
          user: USER_1,
        },
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_2,
        },
      ],
      'user-1',
    );

    const nonDefault = result.filter((r) => r.emoji !== DEFAULT_REACTION_EMOJI);
    expect(nonDefault.map((r) => r.emoji)).toEqual(['🎉', '🚀']);
  });

  it('does not mark reactedByMe true for a different user reacting with the same emoji', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_2,
        },
      ],
      'user-1',
    );
    expect(result.find((r) => r.emoji === '🎉')).toEqual({
      emoji: '🎉',
      count: 1,
      reactedByMe: false,
      reactedBy: ['Ado'],
    });
  });

  it('falls back to discordUsername for a reactor with no displayName', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_1,
        },
      ],
      'user-1',
    );
    expect(result.find((r) => r.emoji === '🎉')?.reactedBy).toEqual(['lemone']);
  });

  it('orders other reactors chronologically after "You"', () => {
    const result = mapCommentReactions(
      [
        {
          emoji: '🎉',
          userId: 'user-2',
          createdAt: new Date('2026-01-03T00:00:00Z'),
          user: USER_2,
        },
        {
          emoji: '🎉',
          userId: 'user-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: USER_1,
        },
        {
          emoji: '🎉',
          userId: 'user-3',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          user: { displayName: 'Carol', discordUsername: 'carol' },
        },
      ],
      'user-1',
    );
    expect(result.find((r) => r.emoji === '🎉')?.reactedBy).toEqual(['You', 'Carol', 'Ado']);
  });
});

describe('mapCommentForResponse', () => {
  const BASE_COMMENT = {
    id: 'comment-1',
    submissionId: 'file-1',
    authorId: 'user-1',
    chartHash: 'hash-a',
    body: 'looks good',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    author: {
      id: 'user-1',
      displayName: null,
      discordUsername: 'lemone',
      discordId: 'discord-1',
      discordAvatarHash: null,
    },
    reactions: [],
  };

  it('falls back to discordUsername when displayName is null', () => {
    const result = mapCommentForResponse(BASE_COMMENT, 'hash-a', 'user-1');
    expect(result.author.displayName).toBe('lemone');
  });

  it('is not stale when chartHash matches the current chart hash', () => {
    const result = mapCommentForResponse(BASE_COMMENT, 'hash-a', 'user-1');
    expect(result.isStale).toBe(false);
  });

  it('is stale when chartHash no longer matches the current chart hash', () => {
    const result = mapCommentForResponse(BASE_COMMENT, 'hash-b', 'user-1');
    expect(result.isStale).toBe(true);
  });

  it('is not edited when createdAt and updatedAt are the same instant', () => {
    const result = mapCommentForResponse(BASE_COMMENT, 'hash-a', 'user-1');
    expect(result.isEdited).toBe(false);
  });

  it('is edited when updatedAt is later than createdAt', () => {
    const result = mapCommentForResponse(
      { ...BASE_COMMENT, updatedAt: new Date('2026-01-02T00:00:00Z') },
      'hash-a',
      'user-1',
    );
    expect(result.isEdited).toBe(true);
  });
});
