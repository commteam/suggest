import type { AdminSession, AudioKind, DataProvider } from './DataProvider';
import { buildBackup, validateBackup } from './backup';
import { toPublicWinners } from './mask';
import { DEFAULT_SETTINGS, SEED_WINNERS } from './seedData';
import { safeLocalStorage, safeSessionStorage } from '../safeStorage';
import {
  MAX_WINNERS,
  type AdminSettings,
  type PresentationEvent,
  type PublicSettings,
  type SiteSettings,
  type Winner,
  type WinnerInput,
} from './types';

const DB_KEY = 'awards.demo.db.v1';
const EVENT_KEY = 'awards.demo.event.v1';
const SESSION_KEY = 'awards.demo.admin';
const CHANNEL = 'awards-demo';
export const DEMO_PASSWORD = 'demo1234';
const DEMO_AUDIO_LIMIT = 3 * 1024 * 1024;

interface DemoDb {
  settings: SiteSettings;
  winners: Winner[];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    r.readAsDataURL(blob);
  });
}

/**
 * 데모 모드: 브라우저 localStorage 에 저장합니다.
 * 같은 브라우저의 다른 탭에는 BroadcastChannel(+storage 이벤트)로 발표 신호를 보냅니다.
 */
export class MockProvider implements DataProvider {
  readonly mode = 'demo' as const;
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  private listeners = new Set<(e: PresentationEvent) => void>();
  private authListeners = new Set<() => void>();

  constructor(private storage: Storage = safeLocalStorage()) {
    this.channel?.addEventListener('message', (m) => this.dispatchLocal(m.data as PresentationEvent));
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        // BroadcastChannel 이 없는 환경 대비
        if (!this.channel && e.key === EVENT_KEY && e.newValue) {
          try {
            this.dispatchLocal(JSON.parse(e.newValue).event as PresentationEvent);
          } catch {
            /* ignore */
          }
        }
      });
    }
  }

  // ---------- 저장소 ----------
  private read(): DemoDb {
    try {
      const raw = this.storage.getItem(DB_KEY);
      if (raw) {
        const db = JSON.parse(raw) as DemoDb;
        return { settings: { ...DEFAULT_SETTINGS, ...db.settings }, winners: db.winners ?? [] };
      }
    } catch {
      /* 손상된 데이터는 시드로 대체 */
    }
    return { settings: clone(DEFAULT_SETTINGS), winners: clone(SEED_WINNERS) };
  }

  private write(db: DemoDb) {
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      throw new Error('브라우저 저장 공간이 부족합니다. 사진이나 음원 크기를 줄여 주세요. (데모 모드 제한)');
    }
  }

  private emit(event: PresentationEvent) {
    this.dispatchLocal(event);
    this.channel?.postMessage(event);
    if (!this.channel) {
      try {
        this.storage.setItem(EVENT_KEY, JSON.stringify({ event, t: Date.now() }));
      } catch {
        /* ignore */
      }
    }
  }

  private dispatchLocal(event: PresentationEvent) {
    this.listeners.forEach((l) => l(event));
  }

  /** 데모 데이터 초기화 (관리자 화면에서 사용) */
  resetDemo() {
    this.storage.removeItem(DB_KEY);
    this.emit({ kind: 'refresh' });
  }

  // ---------- 공개 ----------
  async getPublicSettings(): Promise<PublicSettings> {
    return { ...this.read().settings };
  }

  async getPublicWinners() {
    return toPublicWinners(this.read().winners);
  }

  subscribePresentation(cb: (e: PresentationEvent) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // ---------- 인증 ----------
  async getSession(): Promise<AdminSession | null> {
    return safeSessionStorage().getItem(SESSION_KEY) === '1' ? { email: 'demo@local', isAdmin: true } : null;
  }

  async signIn(_email: string, password: string): Promise<AdminSession> {
    if (password !== DEMO_PASSWORD) throw new Error('비밀번호가 올바르지 않습니다. (데모 비밀번호: demo1234)');
    safeSessionStorage().setItem(SESSION_KEY, '1');
    this.authListeners.forEach((l) => l());
    return { email: 'demo@local', isAdmin: true };
  }

  async signOut() {
    safeSessionStorage().removeItem(SESSION_KEY);
    this.authListeners.forEach((l) => l());
  }

  onAuthChange(cb: () => void) {
    this.authListeners.add(cb);
    return () => {
      this.authListeners.delete(cb);
    };
  }

  // ---------- 관리자 ----------
  async listWinners() {
    return [...this.read().winners].sort((a, b) => a.display_order - b.display_order);
  }

  async saveWinner(input: WinnerInput): Promise<Winner> {
    const db = this.read();
    if (!input.name.trim()) throw new Error('이름을 입력해 주세요.');
    const idx = input.id ? db.winners.findIndex((w) => w.id === input.id) : -1;
    let saved: Winner;
    if (idx >= 0) {
      saved = { ...db.winners[idx], ...input, id: db.winners[idx].id };
      db.winners[idx] = saved;
    } else {
      if (db.winners.length >= MAX_WINNERS) throw new Error(`우수자는 최대 ${MAX_WINNERS}명까지 등록할 수 있습니다.`);
      saved = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      db.winners.push(saved);
    }
    this.write(db);
    this.emit({ kind: 'refresh' });
    return saved;
  }

  async deleteWinner(id: string) {
    const db = this.read();
    db.winners = db.winners
      .filter((w) => w.id !== id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((w, i) => ({ ...w, display_order: i + 1 }));
    this.write(db);
    this.emit({ kind: 'refresh' });
  }

  async reorderWinners(ids: string[]) {
    const db = this.read();
    const order = new Map(ids.map((id, i) => [id, i + 1]));
    db.winners = db.winners.map((w) => ({ ...w, display_order: order.get(w.id) ?? w.display_order }));
    this.write(db);
    this.emit({ kind: 'refresh' });
  }

  async uploadPhoto(blob: Blob) {
    return readAsDataUrl(blob);
  }

  async uploadAudio(file: File, _kind: AudioKind) {
    if (file.size > DEMO_AUDIO_LIMIT)
      throw new Error('데모 모드에서는 3MB 이하 음원만 저장할 수 있습니다. (Supabase 모드는 10MB)');
    return readAsDataUrl(file);
  }

  async getAdminSettings(): Promise<AdminSettings> {
    return { ...this.read().settings };
  }

  async updateSettings(patch: Partial<SiteSettings>) {
    const db = this.read();
    db.settings = { ...db.settings, ...patch };
    this.write(db);
    this.emit({ kind: 'refresh' });
    return this.getAdminSettings();
  }

  async setAllRevealed(revealed: boolean) {
    const db = this.read();
    db.winners = db.winners.map((w) => ({ ...w, is_revealed: revealed }));
    this.write(db);
    this.emit({ kind: revealed ? 'reveal_all' : 'hide_all' });
  }

  async revealNext() {
    const db = this.read();
    const next = [...db.winners].sort((a, b) => a.display_order - b.display_order).find((w) => !w.is_revealed);
    if (!next) return null;
    next.is_revealed = true;
    this.write(db);
    this.emit({ kind: 'reveal', winner_id: next.id });
    return next;
  }

  async exportBackup() {
    const db = this.read();
    return buildBackup(db.settings, db.winners);
  }

  async restoreBackup(payload: unknown) {
    const valid = validateBackup(payload); // 실패 시 기존 데이터는 그대로
    const now = new Date().toISOString();
    this.write({ settings: valid.settings, winners: valid.winners.map((w) => ({ ...w, created_at: now })) });
    this.emit({ kind: 'refresh' });
  }
}
