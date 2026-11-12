import { describe, expect, it } from 'vitest';
import { BackupValidationError, buildBackup, validateBackup } from './backup';
import { DEFAULT_SETTINGS, SEED_WINNERS } from './seedData';

const good = () => JSON.parse(JSON.stringify(buildBackup(DEFAULT_SETTINGS, SEED_WINNERS)));

describe('validateBackup (restore_awards 와 같은 규칙)', () => {
  it('정상 백업은 통과하고 순서를 1..N 으로 정규화', () => {
    const p = good();
    p.winners[0].display_order = 9;
    const v = validateBackup(p);
    expect(v.winners).toHaveLength(5);
    expect(v.winners.map((w) => w.display_order)).toEqual([1, 2, 3, 4, 5]);
    expect(v.winners.at(-1)?.name).toBe(SEED_WINNERS[0].name);
    expect(v.settings.accent_color).toBe('#d9b45a');
  });

  it.each([
    ['객체가 아님', [], '형식'],
    ['winners 없음', { settings: DEFAULT_SETTINGS }, 'winners 항목이 없습니다'],
    ['winners 가 배열 아님', { winners: {}, settings: DEFAULT_SETTINGS }, '배열'],
    ['settings 없음', { winners: [] }, 'settings 항목이 없습니다'],
    ['settings 가 객체 아님', { winners: [], settings: [] }, 'settings 항목은 객체'],
  ])('%s → 오류', (_, payload, msg) => {
    expect(() => validateBackup(payload)).toThrow(BackupValidationError);
    expect(() => validateBackup(payload)).toThrow(msg);
  });

  it('10명 초과 → 오류', () => {
    const p = good();
    p.winners = Array.from({ length: 11 }, (_, i) => ({ ...SEED_WINNERS[0], id: undefined, name: `n${i}` }));
    expect(() => validateBackup(p)).toThrow('최대 10명');
  });

  it('필수 텍스트 누락 → 오류', () => {
    const p = good();
    delete p.winners[2].topic;
    expect(() => validateBackup(p)).toThrow('3번째 우수자의 topic');
  });

  it('빈 이름 → 오류', () => {
    const p = good();
    p.winners[0].name = '  ';
    expect(() => validateBackup(p)).toThrow('이름이 비어');
  });

  it('잘못된 색상/연도/길이 → 오류', () => {
    const a = good();
    a.settings.accent_color = 'red';
    expect(() => validateBackup(a)).toThrow('accent_color');
    const b = good();
    b.settings.year = 1999;
    expect(() => validateBackup(b)).toThrow('year');
    const c = good();
    c.settings.intro_length = 'long';
    expect(() => validateBackup(c)).toThrow('intro_length');
  });

  it('잘못된/중복 id 는 새 UUID 로 교체', () => {
    const p = good();
    p.winners[0].id = 'not-a-uuid';
    p.winners[1].id = p.winners[2].id;
    const ids = validateBackup(p).winners.map((w) => w.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  });

  it('빈 우수자 목록은 허용 (전체 비우기)', () => {
    const p = good();
    p.winners = [];
    expect(validateBackup(p).winners).toEqual([]);
  });
});
