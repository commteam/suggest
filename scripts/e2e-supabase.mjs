/**
 * Supabase 모드 게이트 검증 (가짜 Supabase 응답으로)
 *   VITE_SUPABASE_URL=https://e2e-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite build --outDir dist-supabase
 *   npx vite preview --outDir dist-supabase --port 4174 &
 *   node scripts/e2e-supabase.mjs
 * 실제 서버의 보안은 supabase/tests/10_security_test.sql 이 검증합니다.
 * 이 스크립트는 클라이언트가 코드 없이 데이터를 요청하지 않는지, 게이트 UI 가 맞게 동작하는지 확인합니다.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4174';

const server = { codeSet: false, code: 'award2026', calls: [] };
const settings = () => ({
  event_title: '2026 SUGGESTION AWARDS',
  event_subtitle: '사내 제안제도 수행 우수자 발표',
  year: 2026,
  intro_line: '2026 제안제도 우수 수행자를 소개합니다',
  intro_enabled: true,
  intro_length: 'short',
  sound_default: false,
  accent_color: '#d9b45a',
  fanfare_url: null,
  bgm_url: null,
  access_code_set: server.codeSet,
});
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
    const body = route.request().postDataJSON() ?? {};
    server.calls.push({ fn, body });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (fn === 'get_public_settings') return json(200, settings());
    if (fn === 'verify_access_code') return json(200, server.codeSet && body.code === server.code);
    if (fn === 'get_public_awards') {
      if (!server.codeSet) return json(400, { message: 'access_not_ready', code: 'P0001' });
      if (body.code !== server.code) return json(401, { message: 'invalid_access_code', code: '28P01' });
      return json(200, winners);
    }
    return json(404, { message: 'not mocked' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    // 가짜 서버가 401/400 을 돌려주는 것은 의도된 동작
    if (m.type() === 'error' && !/status of 40[01]/.test(t)) problems.push('console: ' + t);
  });

  // 1) 코드 미설정 → 준비 중
  await page.goto(BASE + '/');
  await page.getByText('발표 준비 중입니다').waitFor();
  assert(!(await page.getByRole('button', { name: '입장하기' }).isVisible()), '준비 중에는 입장 버튼 없음');
  assert(!(await page.getByText('데모 모드').isVisible()), 'Supabase 모드에는 데모 배지 없음');
  assert(!server.calls.some((c) => c.fn === 'get_public_awards'), '준비 중에는 우수자 요청 안 함');
  await page.screenshot({ path: 'docs/screenshots/sb-not-ready.png' });

  // 2) 코드 설정됨 → 입력 필요
  server.codeSet = true;
  await page.getByRole('button', { name: '다시 확인' }).click();
  const input = page.getByLabel('접속 코드');
  await input.waitFor();
  assert(!server.calls.some((c) => c.fn === 'get_public_awards'), '코드 입력 전에는 우수자 요청 안 함');
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.getByText('접속 코드를 입력해 주세요').waitFor();
  await input.fill('wrong-code');
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.getByText('접속 코드가 올바르지 않습니다').waitFor();
  await page.screenshot({ path: 'docs/screenshots/sb-wrong-code.png' });
  assert(!server.calls.some((c) => c.fn === 'get_public_awards'), '틀린 코드로는 우수자 요청 안 함');

  // 3) 맞는 코드 → 오프닝 → 갤러리
  await input.fill('award2026');
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.getByRole('button', { name: '오프닝 다시 보기' }).waitFor({ timeout: 12000 });
  const awardCalls = server.calls.filter((c) => c.fn === 'get_public_awards');
  assert(awardCalls.length > 0 && awardCalls.every((c) => c.body.code === 'award2026'), '맞는 코드로만 우수자 요청');
  await page.locator('[data-frame-id] button').first().click();
  await page.getByRole('dialog').getByText('도장 라인 지그 교체 시간 단축', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'docs/screenshots/sb-gallery.png' });

  // 4) 새로고침 → 저장된 코드로 바로 갤러리
  await page.reload();
  await page.getByRole('heading', { name: '명예의 전당' }).waitFor();
  assert(!(await page.getByLabel('접속 코드').isVisible()), '새로고침 후 코드 재입력 불필요');

  // 5) 관리자가 코드 변경 → 기존 코드 거부 → 게이트로 복귀
  server.code = 'changed-2026';
  await page.reload();
  await page.getByText('접속 코드가 변경되었습니다').waitFor();
  await page.screenshot({ path: 'docs/screenshots/sb-code-changed.png' });
  await page.getByLabel('접속 코드').fill('changed-2026');
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('heading', { name: '명예의 전당' }).waitFor();

  // 6) 관리자 로그인 화면 (이메일 필드 존재)
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
console.log('Supabase 모드 게이트 검증 통과');
