import type {
  AdminSettings,
  AwardsBackup,
  PresentationEvent,
  PublicSettings,
  PublicWinner,
  SiteSettings,
  Winner,
  WinnerInput,
} from './types';

export type ProviderMode = 'demo' | 'supabase';
export type AudioKind = 'fanfare' | 'bgm';

export interface AdminSession {
  email: string | null;
  isAdmin: boolean;
}

/**
 * 공개 사이트와 관리자 페이지가 사용하는 데이터 접근 계층.
 * MockProvider(localStorage)와 SupabaseProvider 가 같은 계약을 구현하므로
 * UI 는 어느 모드인지 몰라도 됩니다.
 */
export interface DataProvider {
  readonly mode: ProviderMode;

  // ---- 공개 ----
  getPublicSettings(): Promise<PublicSettings>;
  /** 누구나 조회. 공개 전 인물은 이름·소속·순서만 */
  getPublicWinners(): Promise<PublicWinner[]>;
  subscribePresentation(cb: (e: PresentationEvent) => void): () => void;

  // ---- 인증 ----
  getSession(): Promise<AdminSession | null>;
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  // ---- 관리자 ----
  listWinners(): Promise<Winner[]>;
  saveWinner(input: WinnerInput): Promise<Winner>;
  deleteWinner(id: string): Promise<void>;
  reorderWinners(idsInOrder: string[]): Promise<void>;
  uploadPhoto(blob: Blob): Promise<string>;
  uploadAudio(file: File, kind: AudioKind): Promise<string>;
  getAdminSettings(): Promise<AdminSettings>;
  updateSettings(patch: Partial<SiteSettings>): Promise<AdminSettings>;
  setAllRevealed(revealed: boolean): Promise<void>;
  /** 다음 공개 전 인물을 공개하고 그 사람을 반환. 남은 사람이 없으면 null */
  revealNext(): Promise<Winner | null>;
  exportBackup(): Promise<AwardsBackup>;
  restoreBackup(payload: unknown): Promise<void>;
}
