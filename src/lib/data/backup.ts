import { MAX_WINNERS, type AwardsBackup, type SiteSettings, type Winner } from './types';

/**
 * JSON 백업 검증. supabase/migrations 의 restore_awards() 와 같은 규칙입니다.
 * 데이터 삭제 전에 검사해서, 잘못된 파일로 기존 데이터가 지워지지 않게 합니다.
 */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const TEXT_FIELDS = ['name', 'dept', 'topic', 'as_is', 'actions', 'to_be', 'reflection'] as const;
const LIMITS: Record<string, number> = {
  name: 50,
  dept: 100,
  position: 50,
  topic: 200,
  as_is: 4000,
  actions: 4000,
  to_be: 4000,
  reflection: 4000,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBackup(payload: unknown): { settings: SiteSettings; winners: Omit<Winner, 'created_at'>[] } {
  if (!isObj(payload)) throw new BackupValidationError('백업 파일 형식이 올바르지 않습니다.');

  const rawWinners = payload.winners;
  if (rawWinners === undefined) throw new BackupValidationError('winners 항목이 없습니다.');
  if (!Array.isArray(rawWinners)) throw new BackupValidationError('winners 항목은 배열이어야 합니다.');
  if (rawWinners.length > MAX_WINNERS)
    throw new BackupValidationError(`우수자는 최대 ${MAX_WINNERS}명까지 가능합니다. (현재 ${rawWinners.length}명)`);

  const rawSettings = payload.settings;
  if (rawSettings === undefined) throw new BackupValidationError('settings 항목이 없습니다.');
  if (!isObj(rawSettings)) throw new BackupValidationError('settings 항목은 객체여야 합니다.');

  const ids = new Set<string>();
  const winners = rawWinners.map((w, i) => {
    const n = i + 1;
    if (!isObj(w)) throw new BackupValidationError(`${n}번째 우수자 데이터가 올바르지 않습니다.`);
    for (const f of TEXT_FIELDS) {
      if (typeof w[f] !== 'string') throw new BackupValidationError(`${n}번째 우수자의 ${f} 값이 없습니다.`);
      if ((w[f] as string).length > LIMITS[f])
        throw new BackupValidationError(`${n}번째 우수자의 ${f} 값이 너무 깁니다.`);
    }
    if ((w.name as string).trim() === '') throw new BackupValidationError(`${n}번째 우수자의 이름이 비어 있습니다.`);
    if (w.position != null && typeof w.position !== 'string')
      throw new BackupValidationError(`${n}번째 우수자의 직급 형식이 올바르지 않습니다.`);
    if (w.photo_url != null && typeof w.photo_url !== 'string')
      throw new BackupValidationError(`${n}번째 우수자의 사진 주소 형식이 올바르지 않습니다.`);
    let id = typeof w.id === 'string' && UUID.test(w.id) ? w.id : crypto.randomUUID();
    if (ids.has(id)) id = crypto.randomUUID();
    ids.add(id);
    return {
      id,
      display_order: Number.isInteger(w.display_order) ? (w.display_order as number) : n,
      name: (w.name as string).trim(),
      dept: w.dept as string,
      position: (w.position as string | null | undefined) || null,
      photo_url: (w.photo_url as string | null | undefined) || null,
      topic: w.topic as string,
      as_is: w.as_is as string,
      actions: w.actions as string,
      to_be: w.to_be as string,
      reflection: w.reflection as string,
      is_revealed: w.is_revealed === true,
    };
  });

  const s = rawSettings;
  const str = (k: string, max: number) => {
    if (typeof s[k] !== 'string') throw new BackupValidationError(`settings.${k} 값이 없습니다.`);
    if ((s[k] as string).length > max) throw new BackupValidationError(`settings.${k} 값이 너무 깁니다.`);
    return s[k] as string;
  };
  const year = s.year;
  if (!Number.isInteger(year) || (year as number) < 2000 || (year as number) > 2100)
    throw new BackupValidationError('settings.year 값이 올바르지 않습니다.');
  const accent = str('accent_color', 9);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new BackupValidationError('settings.accent_color 는 #RRGGBB 형식이어야 합니다.');
  const length = s.intro_length;
  if (length !== 'standard' && length !== 'short')
    throw new BackupValidationError('settings.intro_length 는 standard 또는 short 여야 합니다.');

  // 이전 버전 백업과의 호환: 새 항목은 없으면 기본값, 있으면 검사
  const mode = s.intro_mode ?? 'instant';
  if (mode !== 'instant' && mode !== 'cinematic')
    throw new BackupValidationError('settings.intro_mode 는 instant 또는 cinematic 이어야 합니다.');
  const musicSource = s.music_source ?? 'default';
  if (musicSource !== 'default' && musicSource !== 'upload')
    throw new BackupValidationError('settings.music_source 는 default 또는 upload 여야 합니다.');
  const musicVolume = s.music_volume ?? 0.5;
  if (typeof musicVolume !== 'number' || !(musicVolume >= 0 && musicVolume <= 1))
    throw new BackupValidationError('settings.music_volume 은 0~1 사이 숫자여야 합니다.');

  const settings: SiteSettings = {
    event_title: str('event_title', 120),
    event_subtitle: str('event_subtitle', 200),
    year: year as number,
    intro_line: str('intro_line', 200),
    intro_enabled: s.intro_enabled !== false,
    intro_length: length,
    intro_mode: mode,
    sound_default: s.sound_default !== false,
    accent_color: accent,
    fanfare_url: typeof s.fanfare_url === 'string' && s.fanfare_url ? s.fanfare_url : null,
    bgm_url: typeof s.bgm_url === 'string' && s.bgm_url ? s.bgm_url : null,
    music_source: musicSource,
    music_volume: Math.round(musicVolume * 100) / 100,
  };

  return { settings, winners: winners.sort((a, b) => a.display_order - b.display_order).map((w, i) => ({ ...w, display_order: i + 1 })) };
}

export function buildBackup(settings: SiteSettings, winners: Winner[]): AwardsBackup {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    settings,
    winners: [...winners].sort((a, b) => a.display_order - b.display_order),
  };
}
