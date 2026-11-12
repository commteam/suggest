import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminSession, AudioKind, DataProvider } from './DataProvider';
import { buildBackup, validateBackup } from './backup';
import {
  AccessDeniedError,
  type AdminSettings,
  type PresentationEvent,
  type PublicSettings,
  type PublicWinner,
  type SiteSettings,
  type Winner,
  type WinnerInput,
} from './types';

const PHOTO_BUCKET = 'winner-photos';
const AUDIO_BUCKET = 'site-audio';
const SETTINGS_COLS =
  'event_title,event_subtitle,year,intro_line,intro_enabled,intro_length,intro_mode,sound_default,accent_color,fanfare_url,bgm_url,music_source,music_volume';

interface ErrLike {
  message?: string;
  code?: string;
  hint?: string;
  status?: number;
  statusCode?: string | number;
}

/** Supabase/PostgREST 오류를 한국어로 */
export function translateError(e: unknown): Error {
  const err = (e ?? {}) as ErrLike;
  const msg = err.message ?? '';
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(msg))
    return new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  if (/Invalid login credentials/i.test(msg)) return new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  if (/Email not confirmed/i.test(msg)) return new Error('이메일 인증이 완료되지 않은 계정입니다.');
  if (/JWT expired|PGRST301|PGRST303/i.test(msg) || err.code === 'PGRST301')
    return new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return new Error('파일 용량이 너무 큽니다.');
  if (/mime type .* is not supported|invalid_mime_type/i.test(msg)) return new Error('허용되지 않는 파일 형식입니다.');
  if (err.code === '42501' || /permission denied|row-level security/i.test(msg))
    return new Error('권한이 없습니다. 관리자 계정으로 로그인했는지 확인해 주세요.');
  if (/[가-힣]/.test(msg)) return new Error(msg); // SQL 함수가 보낸 한국어 메시지
  return new Error(msg ? `요청을 처리하지 못했습니다. (${msg})` : '요청을 처리하지 못했습니다.');
}

function ext(type: string, fallback: string) {
  const map: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
  };
  return map[type] ?? fallback;
}

export class SupabaseProvider implements DataProvider {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw error;
    return data as T;
  }

  // ---------- 공개 ----------
  async getPublicSettings(): Promise<PublicSettings> {
    try {
      const s = await this.rpc<(SiteSettings & { access_code_set: boolean }) | null>('get_public_settings');
      if (!s) throw new Error('사이트 설정이 없습니다. 마이그레이션을 실행했는지 확인해 주세요.');
      const { access_code_set, ...rest } = s;
      return { ...rest, music_volume: Number(rest.music_volume ?? 0.5), gate: access_code_set ? 'code' : 'not_ready' };
    } catch (e) {
      throw translateError(e);
    }
  }

  async getPublicWinners(accessCode: string | null): Promise<PublicWinner[]> {
    if (!accessCode) throw new AccessDeniedError('접속 코드가 필요합니다.');
    const { data, error } = await this.sb.rpc('get_public_awards', { code: accessCode });
    if (error) {
      if (/invalid_access_code/.test(error.message)) throw new AccessDeniedError();
      if (/access_not_ready/.test(error.message)) throw new AccessDeniedError('발표 준비 중입니다.');
      throw translateError(error);
    }
    return (data ?? []) as PublicWinner[];
  }

  async verifyAccessCode(code: string) {
    try {
      return await this.rpc<boolean>('verify_access_code', { code });
    } catch (e) {
      throw translateError(e);
    }
  }

  subscribePresentation(cb: (e: PresentationEvent) => void) {
    const channel = this.sb
      .channel(`presentation-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'presentation_events' }, (payload) => {
        const row = payload.new as { kind: PresentationEvent['kind']; winner_id: string | null };
        if (row.kind === 'reveal' && row.winner_id) cb({ kind: 'reveal', winner_id: row.winner_id });
        else if (row.kind === 'reveal_all' || row.kind === 'hide_all' || row.kind === 'refresh') cb({ kind: row.kind });
      })
      .subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }

  // ---------- 인증 ----------
  private async isAdmin(userId: string) {
    // RLS: 본인 행만 읽을 수 있음. 실제 권한은 서버 정책이 강제합니다.
    const { data, error } = await this.sb.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (error) throw translateError(error);
    return !!data;
  }

  async getSession(): Promise<AdminSession | null> {
    const { data, error } = await this.sb.auth.getSession();
    if (error) throw translateError(error);
    const user = data.session?.user;
    if (!user) return null;
    return { email: user.email ?? null, isAdmin: await this.isAdmin(user.id) };
  }

  async signIn(email: string, password: string): Promise<AdminSession> {
    if (!email) throw new Error('이메일을 입력해 주세요.');
    if (!password) throw new Error('비밀번호를 입력해 주세요.');
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw translateError(error);
    return { email: data.user.email ?? null, isAdmin: await this.isAdmin(data.user.id) };
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb();
    });
    return () => data.subscription.unsubscribe();
  }

  // ---------- 관리자 ----------
  async listWinners(): Promise<Winner[]> {
    const { data, error } = await this.sb.from('winners').select('*').order('display_order').order('created_at');
    if (error) throw translateError(error);
    return data as Winner[];
  }

  private storagePath(url: string | null, bucket: string): string | null {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
  }

  private async removeFile(url: string | null, bucket: string) {
    const path = this.storagePath(url, bucket);
    if (path) await this.sb.storage.from(bucket).remove([path]); // 실패해도 데이터에는 영향 없음
  }

  async saveWinner(input: WinnerInput): Promise<Winner> {
    const { id, ...fields } = input;
    if (id) {
      const { data: prev } = await this.sb.from('winners').select('photo_url').eq('id', id).maybeSingle();
      const { data, error } = await this.sb.from('winners').update(fields).eq('id', id).select().single();
      if (error) throw translateError(error);
      if (prev?.photo_url && prev.photo_url !== fields.photo_url) await this.removeFile(prev.photo_url, PHOTO_BUCKET);
      return data as Winner;
    }
    const { data, error } = await this.sb.from('winners').insert(fields).select().single();
    if (error) throw translateError(error);
    return data as Winner;
  }

  async deleteWinner(id: string) {
    const { data, error } = await this.sb.from('winners').delete().eq('id', id).select('photo_url').maybeSingle();
    if (error) throw translateError(error);
    await this.removeFile(data?.photo_url ?? null, PHOTO_BUCKET);
    const rest = await this.listWinners();
    await this.reorderWinners(rest.map((w) => w.id));
  }

  async reorderWinners(idsInOrder: string[]) {
    try {
      await this.rpc('reorder_winners', { ids: idsInOrder });
    } catch (e) {
      throw translateError(e);
    }
  }

  async uploadPhoto(blob: Blob) {
    const path = `${crypto.randomUUID()}.${ext(blob.type, 'webp')}`;
    const { error } = await this.sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/webp', cacheControl: '31536000', upsert: false });
    if (error) throw translateError(error);
    return this.sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async uploadAudio(file: File, kind: AudioKind) {
    const fromName = file.name.split('.').pop()?.toLowerCase() ?? 'mp3';
    const path = `${kind}-${crypto.randomUUID()}.${ext(file.type, fromName)}`;
    const { error } = await this.sb.storage
      .from(AUDIO_BUCKET)
      .upload(path, file, { contentType: file.type || 'audio/mpeg', cacheControl: '31536000', upsert: false });
    if (error) throw translateError(error);
    return this.sb.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async getAdminSettings(): Promise<AdminSettings> {
    const [{ data, error }, pub] = await Promise.all([
      this.sb.from('site_settings').select(SETTINGS_COLS).eq('id', 1).single(),
      this.rpc<{ access_code_set: boolean }>('get_public_settings').catch((e: unknown) => {
        throw translateError(e);
      }),
    ]);
    if (error) throw translateError(error);
    const s = data as unknown as SiteSettings;
    return { ...s, music_volume: Number(s.music_volume), access_code_set: !!pub?.access_code_set };
  }

  async updateSettings(patch: Partial<SiteSettings>) {
    const prev = 'fanfare_url' in patch || 'bgm_url' in patch ? await this.getAdminSettings() : null;
    const { error } = await this.sb.from('site_settings').update(patch).eq('id', 1);
    if (error) throw translateError(error);
    if (prev && 'fanfare_url' in patch && prev.fanfare_url !== patch.fanfare_url) await this.removeFile(prev.fanfare_url, AUDIO_BUCKET);
    if (prev && 'bgm_url' in patch && prev.bgm_url !== patch.bgm_url) await this.removeFile(prev.bgm_url, AUDIO_BUCKET);
    return this.getAdminSettings();
  }

  async setAccessCode(code: string) {
    try {
      await this.rpc('set_access_code', { code });
    } catch (e) {
      throw translateError(e);
    }
  }

  async setAllRevealed(revealed: boolean) {
    try {
      await this.rpc('set_all_revealed', { revealed });
    } catch (e) {
      throw translateError(e);
    }
  }

  async revealNext() {
    try {
      const rows = await this.rpc<Winner[] | null>('reveal_next');
      return rows?.[0] ?? null;
    } catch (e) {
      throw translateError(e);
    }
  }

  async exportBackup() {
    const [settings, winners] = await Promise.all([this.getAdminSettings(), this.listWinners()]);
    const { access_code_set: _a, ...s } = settings;
    return buildBackup(s, winners);
  }

  async restoreBackup(payload: unknown) {
    const valid = validateBackup(payload); // 서버(restore_awards)도 같은 규칙으로 다시 검사
    try {
      await this.rpc('restore_awards', { payload: valid });
    } catch (e) {
      throw translateError(e);
    }
  }
}
