/**
 * Supabase 모드 공개 화면 검증 (가짜 Supabase 응답으로)
 *   VITE_SUPABASE_URL=https://e2e-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite build --outDir dist-supabase
 *   npx vite preview --outDir dist-supabase --port 4174 &
 *   node scripts/e2e-supabase.mjs
 * 실제 서버의 마스킹·권한은 supabase/tests/10_security_test.sql 이 검증합니다.
 * 이 스크립트는 접속 코드 없이 바로 입장되는지, 공개 전 인물이 잠긴 채로 보이는지, 화면이 서버 데이터를 맞게 쓰는지 확인합니다.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4174';

const calls = [];
const settings = {
  event_title: '2026 SUGGESTION AWARDS',
  event_subtitle: '사내 제안제도 수행 우수자 발표',
  year: 2026,
  intro_line: '2026 제안제도 우수 수행자를 소개합니다',
  intro_enabled: true,
  intro_length: 'short',
  intro_mode: 'instant',
  sound_default: false,
  accent_color: '#d9b45a',
  fanfare_url: null,
  bgm_url: null,
  music_source: 'default',
  music_volume: 0.5,
};
// 서버(get_public_awards)가 내려주는 형태: 공개 전 인물은 이름·소속·순서만
const winners = [
  { id: 'a', display_order: 1, name: '김하늘', dept: '생산기술팀', position: '책임', photo_url: null, topic: '도장 라인 지그 교체 시간 단축', as_is: 'a', actions: 'b', to_be: 'c', reflection: 'd', is_revealed: true },
  { id: 'b', display_order: 2, name: '이도윤', dept: '품질보증팀', is_revealed: false },
];

const problems = [];
const assert = (c, m) => {
  if (!c) throw new Error('검증 실패: ' + m);
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.routeWebSocket(/realtime/, (ws) => ws.onMessage(() => {}));
  await ctx.route('**/rest/v1/rpc/**', async (route) => {
    const fn = route.request().url().split('/rpc/')[1].split('?')[0];
    calls.push({ fn, body: route.request().postDataJSON() ?? {} });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (fn === 'get_public_settings') return json(200, settings);
    if (fn === 'get_public_awards') return json(200, winners);
    return json(404, { message: 'not mocked' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));

  // 1) 주소로 들어오면 바로 첫 화면(입장하기) — 접속 코드 입력·준비 중 잠금 없음
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: '입장하기' }).waitFor();
  assert((await page.locator('input').count()) === 0, '첫 화면에 입력칸(접속 코드) 없음');
  assert(!(await page.getByText(/접속 코드|준비 중/).count()), '접속 코드·준비 중 문구 없음');
  assert(!(await page.getByText('데모 모드').isVisible()), 'Supabase 모드에는 데모 배지 없음');
  await page.screenshot({ path: 'docs/screenshots/sb-gate.png' });

  // 2) 서버 요청은 코드 없이
  const awardCalls = calls.filter((c) => c.fn === 'get_public_awards');
  assert(awardCalls.length > 0, '우수자 목록 요청');
  assert(awardCalls.every((c) => !('code' in c.body)), '코드를 보내지 않음');
  assert(!calls.some((c) => c.fn === 'verify_access_code'), 'verify_access_code 호출 없음');

  // 3) 입장 → 갤러리 → 공개된 사람 상세
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 4000 });
  await page.locator('[data-frame-id="a"] button').click();
  await page.getByRole('dialog').getByText('도장 라인 지그 교체 시간 단축', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  // 4) 공개 전 인물은 잠김(발표 전 안내만)
  await page.locator('[data-frame-id="b"] button').click();
  await page.getByText('발표 전입니다').waitFor();
  assert(!(await page.getByRole('dialog').isVisible()), '공개 전 인물은 상세가 열리지 않음');
  await page.screenshot({ path: 'docs/screenshots/sb-gallery.png' });

  // 5) 새로고침해도 바로 첫 화면
  await page.reload();
  await page.getByRole('button', { name: '입장하기' }).waitFor();

  // 6) 관리자 로그인 화면 (이메일 필드, 접속 코드 설정 없음)
  await page.goto(BASE + '/admin');
  await page.waitForURL('**/admin/login');
  assert(await page.getByLabel('이메일').isVisible(), 'Supabase 모드 로그인은 이메일 입력');
} catch (e) {
  problems.push('중단: ' + e.message);
} finally {
  await browser.close();
}
if (problems.length) {
  console.log('문제:\n  - ' + [...new Set(problems)].join('\n  - '));
  process.exit(1);
}
console.log('Supabase 모드 공개 화면 검증 통과 (접속 코드 없이 바로 입장)');
