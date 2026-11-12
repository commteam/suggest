import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, auth: {}, from: vi.fn(), storage: {}, channel: vi.fn() }),
}));

const { SupabaseProvider, translateError } = await import('./SupabaseProvider');

describe('SupabaseProvider', () => {
  beforeEach(() => rpc.mockReset());

  it('공개 우수자 목록은 접속 코드 없이 요청', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'a', display_order: 1, name: 'n', dept: 'd', is_revealed: false }], error: null });
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    const list = await p.getPublicWinners();
    expect(rpc).toHaveBeenCalledWith('get_public_awards');
    expect(list).toHaveLength(1);
  });

  it('마이그레이션 9 이전 서버면 안내 메시지', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_access_code', code: '28P01' } });
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    await expect(p.getPublicWinners()).rejects.toThrow('20260101000009_remove_access_code.sql');
  });

  it('공개 설정: 예전 서버의 access_code_set 은 버림', async () => {
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    rpc.mockResolvedValueOnce({ data: { event_title: 't', music_volume: '0.4', access_code_set: true }, error: null });
    const s = await p.getPublicSettings();
    expect(s).not.toHaveProperty('access_code_set');
    expect(s).not.toHaveProperty('gate');
    expect(s.music_volume).toBe(0.4);
  });

  it('복원은 클라이언트 검증 실패 시 서버를 호출하지 않음', async () => {
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    await expect(p.restoreBackup({ winners: 'bad' })).rejects.toThrow('배열');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('translateError', () => {
  it.each([
    [{ message: 'Failed to fetch' }, '서버에 연결할 수 없습니다'],
    [{ message: 'Invalid login credentials' }, '이메일 또는 비밀번호'],
    [{ message: 'permission denied for table winners', code: '42501' }, '권한이 없습니다'],
    [{ message: '우수자는 최대 10명까지 등록할 수 있습니다.' }, '최대 10명'],
    [{ message: 'The object exceeded the maximum allowed size' }, '용량'],
  ])('%o', (input, expected) => {
    expect(translateError(input).message).toContain(expected);
  });
});
