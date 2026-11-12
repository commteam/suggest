import { describe, expect, it } from 'vitest';
import { toPublicWinner, toPublicWinners } from './mask';
import { SEED_WINNERS } from './seedData';
import type { Winner } from './types';

const base: Winner = { ...SEED_WINNERS[0], photo_url: 'https://example.com/p.webp' };

describe('공개 전 데이터 마스킹', () => {
  it('공개 전이면 이름·소속·순서만 남기고 나머지 키는 아예 없음', () => {
    const hidden = toPublicWinner({ ...base, is_revealed: false });
    expect(Object.keys(hidden).sort()).toEqual(['dept', 'display_order', 'id', 'is_revealed', 'name']);
    const json = JSON.stringify(hidden);
    expect(json).not.toContain(base.topic);
    expect(json).not.toContain('example.com');
    expect(json).not.toContain(base.reflection);
  });

  it('공개되면 상세 내용 포함', () => {
    const shown = toPublicWinner({ ...base, is_revealed: true });
    expect(shown.is_revealed).toBe(true);
    if (shown.is_revealed) {
      expect(shown.topic).toBe(base.topic);
      expect(shown.photo_url).toBe(base.photo_url);
    }
    expect(shown).not.toHaveProperty('created_at');
  });

  it('순서대로 정렬', () => {
    const list = toPublicWinners([
      { ...base, id: 'b', display_order: 2 },
      { ...base, id: 'a', display_order: 1 },
    ]);
    expect(list.map((w) => w.id)).toEqual(['a', 'b']);
  });
});
