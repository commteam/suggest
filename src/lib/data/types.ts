/** 관리자용 전체 레코드 (DB winners 테이블과 1:1) */
export interface Winner {
  id: string;
  display_order: number;
  name: string;
  dept: string;
  position: string | null;
  photo_url: string | null;
  topic: string;
  as_is: string;
  actions: string;
  to_be: string;
  reflection: string;
  is_revealed: boolean;
  created_at: string;
}

export type WinnerInput = Omit<Winner, 'id' | 'created_at'> & { id?: string };

/** 공개 전: 이름·소속·순서만 */
export interface HiddenWinner {
  id: string;
  display_order: number;
  name: string;
  dept: string;
  is_revealed: false;
}

/** 공개됨: 상세 내용 포함 */
export interface RevealedWinner {
  id: string;
  display_order: number;
  name: string;
  dept: string;
  position: string | null;
  photo_url: string | null;
  topic: string;
  as_is: string;
  actions: string;
  to_be: string;
  reflection: string;
  is_revealed: true;
}

export type PublicWinner = HiddenWinner | RevealedWinner;

export type IntroLength = 'standard' | 'short';
/** 입장 연출: 바로 입장(커튼만 열림) / 시네마틱 오프닝(드럼롤·플래시 등) */
export type IntroMode = 'instant' | 'cinematic';
/** 배경음악: 기본 합성 음악 / 업로드한 음악 */
export type MusicSourceSetting = 'default' | 'upload';

export interface SiteSettings {
  event_title: string;
  event_subtitle: string;
  year: number;
  intro_line: string;
  intro_enabled: boolean;
  intro_length: IntroLength;
  intro_mode: IntroMode;
  sound_default: boolean;
  accent_color: string;
  fanfare_url: string | null;
  bgm_url: string | null;
  music_source: MusicSourceSetting;
  /** 0~1 */
  music_volume: number;
}

/** 공개 화면에 내려가는 설정 (접속 코드 기능은 제거됨) */
export type PublicSettings = SiteSettings;

/** 관리자 화면 설정 */
export type AdminSettings = SiteSettings;

export type PresentationEvent =
  | { kind: 'reveal'; winner_id: string }
  | { kind: 'reveal_all' }
  | { kind: 'hide_all' }
  | { kind: 'refresh' };

export interface AwardsBackup {
  version: 1;
  exported_at: string;
  settings: SiteSettings;
  winners: Array<Omit<Winner, 'created_at'> & { created_at?: string }>;
}

export const MAX_WINNERS = 10;
export const RECOMMENDED_STORY_LENGTH = 400;
