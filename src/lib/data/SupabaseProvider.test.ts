import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedError } from './types';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, auth: {}, from: vi.fn(), storage: {}, channel: vi.fn() }),
}));

const { SupabaseProvider, translateError } = await import('./SupabaseProvider');

describe('SupabaseProvider', () => {
  beforeEach(() => rpc.mockReset());

  it('접속 코드 없이는 서버에 묻지도 않고 거부', async () => {
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    await expect(p.getPublicWinners(null)).rejects.toBeInstanceOf(AccessDeniedError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('잘못된 코드 → AccessDeniedError', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_access_code', code: '28P01' } });
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    await expect(p.getPublicWinners('nope')).rejects.toBeInstanceOf(AccessDeniedError);
    expect(rpc).toHaveBeenCalledWith('get_public_awards', { code: 'nope' });
  });

  it('공개 설정: 코드 미설정이면 not_ready, 설정되면 code', async () => {
    const p = new SupabaseProvider('https://x.supabase.co', 'anon');
    rpc.mockResolvedValueOnce({ data: { event_title: 't', access_code_set: false }, error: null });
    expect((await p.getPublicSettings()).gate).toBe('not_ready');
    rpc.mockResolvedValueOnce({ data: { event_title: 't', access_code_set: true }, error: null });
    const s = await p.getPublicSettings();
    expect(s.gate).toBe('code');
    expect(s).not.toHaveProperty('access_code_set');
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
