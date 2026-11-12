/**
 * Microsoft Teams 개인 탭(iframe) 동작 검증
 *   npm run build && npx vite preview --port 4173 &            (데모, vercel.json 과 같은 CSP 헤더)
 *   VITE_SUPABASE_URL=https://e2e-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite build --outDir dist-supabase
 *   npx vite preview --outDir dist-supabase --port 4174 &
 *   node scripts/e2e-teams.mjs
 *
 * Playwright 가 https://teams.microsoft.com/... 와 https://evil.example.com/... 응답을 대신 만들어
 * 실제 Teams 처럼 iframe 으로 앱을 띄웁니다. 가짜 Teams 호스트는 SDK 의 initialize 메시지에 응답합니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DEMO = process.argv[2] ?? 'http://localhost:4173';
const SB = process.argv[3] ?? 'http://localhost:4174';
const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const assert = (c, m) => {
  if (!c) throw new Error('검증 실패: ' + m);
};

/** 가짜 Teams 호스트 페이지: iframe 으로 앱을 띄우고 SDK 메시지에 응답 */
const hostHtml = (src, respond = true) => `<!doctype html><html><head><meta charset="utf-8"><title>Teams host (e2e)</title>
<style>html,body{margin:0;height:100%;background:#1f1f1f}iframe{border:0;width:100%;height:100%}</style></head><body>
<iframe id="app" src="${src}" allow="autoplay; clipboard-write"></iframe>
<script>
  window.__received = [];
  window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (!m.func) return;
    window.__received.push(m.func);
    if (${respond} && m.func === 'initialize') {
      e.source.postMessage({ id: m.id, uuidAsString: m.uuidAsString, args: ['content', 'web', '', '2.0.1'], isPartialResponse: false }, e.origin);
    }
  });
</script></body></html>`;

function watchFrameErrors(page, label) {
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/status of 40[01]/.test(t)) return; // 가짜 서버의 의도된 응답
    problems.push(`[${label}] console: ${t}`);
  });
}

/**
 * 앱을 공개 https 주소처럼 보이게 프록시 (Chromium 은 공개 사이트 안의 localhost iframe 을 막으므로).
 * 응답 헤더(CSP 포함)는 preview 서버의 것을 그대로 전달합니다.
 */
const APP = 'https://awards.e2e.test';
const APP_SB = 'https://awards-sb.e2e.test';
async function proxyApp(ctx) {
  for (const [origin, target] of [
    [APP, DEMO],
    [APP_SB, SB],
  ]) {
    await ctx.route(`${origin}/**`, async (route) => {
      const u = new URL(route.request().url());
      const resp = await route.fetch({ url: target + u.pathname + u.search });
      await route.fulfill({ response: resp });
    });
  }
}

async function hostPage(ctx, origin, src, opts) {
  await proxyApp(ctx);
  // Teams SDK 가 받는 신뢰 도메인 목록 (이 테스트 환경은 외부 인터넷이 막혀 있어 대신 응답)
  await ctx.route('https://res.cdn.office.net/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ validOrigins: ['teams.microsoft.com', '*.teams.microsoft.com', '*.office.com', '*.microsoft365.com', 'teams.cloud.microsoft', '*.cloud.microsoft'] }),
    }),
  );
  await ctx.route(`${origin}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: hostHtml(src, opts?.respond ?? true) }),
  );
  const page = await ctx.newPage();
  return page;
}

const appFrame = (page) => page.frames().find((f) => f !== page.mainFrame());

const browser = await chromium.launch();
try {
  // ---------- 1) 일반 브라우저: Teams SDK 를 내려받지도 초기화하지도 않음 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watchFrameErrors(page, 'browser');
    const teamsChunk = [];
    page.on('request', (r) => /teams-js/.test(r.url()) && teamsChunk.push(r.url()));
    await page.goto(DEMO + '/?source=teams');
    await page.getByRole('button', { name: '입장하기' }).click();
    await page.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 4000 });
    assert((await page.evaluate(() => window.__awardsTeams)) === 'not-teams', '일반 브라우저는 not-teams');
    assert(teamsChunk.length === 0, `일반 브라우저에서 Teams SDK 미로드 (${teamsChunk})`);
    await ctx.close();
    console.log('  ✓ 일반 브라우저: 영향 없음, SDK 미로드');
  }

  // ---------- 2) Teams 호스트 안: SDK 초기화 + notifySuccess, 공개 화면 정상 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await hostPage(ctx, 'https://teams.microsoft.com', `${APP}/?source=teams`);
    watchFrameErrors(page, 'teams-public');
    await page.goto('https://teams.microsoft.com/_e2e/tab');
    await page.frameLocator('#app').getByRole('button', { name: '입장하기' }).waitFor({ timeout: 8000 });
    const f = appFrame(page);
    await f.waitForFunction(() => window.__awardsTeams === 'ready', null, { timeout: 8000 });
    const received = await page.evaluate(() => window.__received);
    assert(received.includes('initialize'), `initialize 호출 (${received})`);
    assert(received.includes('appInitialization.success'), `notifySuccess 호출 (${received})`);
    await page.frameLocator('#app').getByRole('button', { name: '입장하기' }).click();
    await page.frameLocator('#app').getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 4000 });
    const audio = await f.evaluate(() => window.__awardsAudio);
    assert(audio.musicPlaying, 'Teams 탭 안에서도 입장 후 음악 재생');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/teams-public.png` });
    await ctx.close();
    console.log('  ✓ Teams 호스트: initialize + notifySuccess, 공개 화면·음악 정상');
  }

  // ---------- 3) Teams 호스트가 응답하지 않아도(타임아웃) 화면은 정상 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await hostPage(ctx, 'https://teams.microsoft.com', `${APP}/?source=teams`, { respond: false });
    watchFrameErrors(page, 'teams-timeout');
    await page.goto('https://teams.microsoft.com/_e2e/silent');
    const fl = page.frameLocator('#app');
    await fl.getByRole('button', { name: '입장하기' }).click();
    await fl.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 4000 });
    await appFrame(page).waitForFunction(() => window.__awardsTeams === 'timeout', null, { timeout: 9000 });
    await ctx.close();
    console.log('  ✓ 초기화 타임아웃: 화면 정상 동작');
  }

  // ---------- 4) 다른 사이트에서의 iframe 삽입은 차단 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await hostPage(ctx, 'https://evil.example.com', `${APP}/`);
    await page.goto('https://evil.example.com/embed');
    await page.waitForTimeout(2500);
    const visible = await page
      .frameLocator('#app')
      .getByRole('button', { name: '입장하기' })
      .isVisible()
      .catch(() => false);
    assert(!visible, '다른 사이트에서는 iframe 으로 열리지 않음');
    const frameUrl = appFrame(page)?.url() ?? '';
    assert(!frameUrl.startsWith(APP), `차단된 프레임 (${frameUrl})`);
    await ctx.close();
    console.log('  ✓ 다른 사이트 삽입 차단 (frame-ancestors)');
  }

  // ---------- 4-1) 허용 호스트별 삽입 / 비슷한 가짜 도메인 차단 (실제 브라우저 CSP 판정) ----------
  {
    const allowed = [
      'https://teams.microsoft.com',
      'https://abc.teams.microsoft.com',
      'https://web.skype.com',
      'https://teams.live.com',
      'https://x.teams.live.com',
      'https://teams.cloud.microsoft',
      'https://m365.cloud.microsoft',
      'https://www.office.com',
      'https://outlook.office.com',
      'https://outlook.office365.com',
      'https://www.office365.com',
      'https://www.microsoft365.com',
      'https://admin.microsoft.com',
      'https://contoso.sharepoint.com',
    ];
    const blocked = [
      'https://teams.microsoft.com.evil.example',
      'https://evil-sharepoint.com',
      'https://outlook.live.com',
      'https://example.com',
    ];
    const loads = async (origin) => {
      const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
      const page = await hostPage(ctx, origin, `${APP}/`, { respond: false });
      await page.goto(`${origin}/_e2e/frame`);
      const ok = await page
        .frameLocator('#app')
        .getByRole('button', { name: '입장하기' })
        .waitFor({ timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      await ctx.close();
      return ok;
    };
    for (const o of allowed) assert(await loads(o), `${o} 에서 삽입 허용`);
    for (const o of blocked) assert(!(await loads(o)), `${o} 에서 삽입 차단`);
    console.log(`  ✓ 허용 호스트 ${allowed.length}곳 삽입 가능, 가짜·일반 사이트 ${blocked.length}곳 차단`);
  }

  // ---------- 5) 관리자 진입 경로 + 로그인 유지 + iframe 안 파일 선택 (데모) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await hostPage(ctx, 'https://teams.microsoft.com', `${APP}/admin?source=teams`);
    watchFrameErrors(page, 'teams-admin');
    await page.goto('https://teams.microsoft.com/_e2e/admin');
    const fl = page.frameLocator('#app');
    await fl.getByRole('heading', { name: '관리자 로그인' }).waitFor({ timeout: 8000 });
    assert(appFrame(page).url().includes('/admin/login'), '/admin?source=teams → 로그인 화면');
    await fl.getByText('Microsoft Teams 에서 열었습니다').waitFor();
    assert(await fl.getByRole('link', { name: '브라우저에서 열기' }).isVisible(), '브라우저에서 열기 링크');
    await page.screenshot({ path: `${OUT}/teams-admin-login.png` });
    await fl.getByLabel('비밀번호').fill('demo1234');
    await fl.getByRole('button', { name: '로그인' }).click();
    await fl.getByRole('heading', { name: /우수자 관리/ }).waitFor();
    // 탭 다시 열기(iframe 새로고침) → 로그인 유지
    await appFrame(page).goto(`${APP}/admin?source=teams`);
    await fl.getByRole('heading', { name: /우수자 관리/ }).waitFor({ timeout: 6000 });
    // iframe 안에서 사진 파일 선택
    await fl.getByRole('link', { name: '김하늘 수정' }).click();
    const fileBtn = fl.locator('label', { hasText: '파일 선택' }).first();
    await fileBtn.waitFor({ state: 'visible', timeout: 6000 });
    const box = await fileBtn.boundingBox();
    assert(box && box.width > 60 && box.height >= 36, `"파일 선택" 버튼 크기 (${JSON.stringify(box)})`);
    const chooser = page.waitForEvent('filechooser');
    // 실제 사용자처럼 버튼 위치를 클릭 → 그 위에 겹친 네이티브 파일 입력이 파일 선택창을 엶
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const fc = await chooser;
    await fc.setFiles('docs/screenshots/test-portrait.png');
    await fl.getByRole('dialog', { name: '사진 자르기 (3:4)' }).waitFor();
    await fl.getByRole('button', { name: '적용' }).click();
    await fl.getByText('사진을 적용했습니다').waitFor();
    await page.screenshot({ path: `${OUT}/teams-admin-photo.png` });
    await ctx.close();
    console.log('  ✓ /admin?source=teams → 로그인, 새로고침 후 로그인 유지, iframe 안 파일 선택');
  }

  // ---------- 6) iframe 저장소가 차단된 환경: 앱이 멈추지 않고 안내 표시 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.addInitScript(() => {
      if (window.top !== window && location.search.includes('blockstorage')) {
        const deny = () => {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        };
        Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
        Object.defineProperty(window, 'sessionStorage', { get: deny, configurable: true });
      }
    });
    const page = await hostPage(ctx, 'https://teams.microsoft.com', `${APP}/admin?source=teams&blockstorage=1`);
    watchFrameErrors(page, 'teams-nostorage');
    await page.goto('https://teams.microsoft.com/_e2e/nostorage');
    const fl = page.frameLocator('#app');
    await fl.getByText('이 환경에서는 로그인 정보를 저장할 수 없습니다').waitFor({ timeout: 8000 });
    await fl.getByLabel('비밀번호').fill('demo1234');
    await fl.getByRole('button', { name: '로그인' }).click();
    await fl.getByRole('heading', { name: /우수자 관리/ }).waitFor();
    await page.screenshot({ path: `${OUT}/teams-nostorage.png` });
    await ctx.close();
    console.log('  ✓ 저장소 차단: 안내 표시, 로그인(메모리) 가능, 오류 없음');
  }

  // ---------- 7) Supabase 모드: iframe 안에서 로그인 세션(localStorage) 유지 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.routeWebSocket(/realtime/, (ws) => ws.onMessage(() => {}));
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'admin@company.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated', email: user.email })}.sig`;
    let tokenCalls = 0;
    await ctx.route('https://e2e-fake.supabase.co/**', (route) => {
      const url = route.request().url();
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.includes('/auth/v1/token')) {
        tokenCalls++;
        return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user });
      }
      if (url.includes('/auth/v1/user')) return json(user);
      if (url.includes('/rest/v1/user_roles')) return json({ role: 'admin' });
      if (url.includes('/rest/v1/winners')) return json([]);
      if (url.includes('/rest/v1/rpc/get_public_settings'))
        return json({ event_title: 't', event_subtitle: 's', year: 2026, intro_line: 'l', intro_enabled: true, intro_length: 'short', intro_mode: 'instant', sound_default: true, accent_color: '#d9b45a', fanfare_url: null, bgm_url: null, music_source: 'default', music_volume: 0.5 });
      return json([]);
    });
    const page = await hostPage(ctx, 'https://teams.microsoft.com', `${APP_SB}/admin?source=teams`);
    watchFrameErrors(page, 'teams-supabase');
    await page.goto('https://teams.microsoft.com/_e2e/sb');
    const fl = page.frameLocator('#app');
    await fl.getByRole('heading', { name: '관리자 로그인' }).waitFor({ timeout: 8000 });
    await fl.getByLabel('이메일').fill('admin@company.com');
    await fl.getByLabel('비밀번호').fill('pw-1234');
    await fl.getByRole('button', { name: '로그인' }).click();
    await fl.getByRole('heading', { name: /우수자 관리/ }).waitFor({ timeout: 6000 });
    const stored = await appFrame(page).evaluate(() => Object.keys(localStorage).filter((k) => k.includes('auth-token')).length);
    assert(stored === 1, 'iframe 안 localStorage 에 Supabase 세션 저장');
    // Teams 탭을 다시 연 것처럼 iframe 새로고침 → 다시 로그인하지 않아도 됨
    await appFrame(page).goto(`${APP_SB}/admin?source=teams`);
    await fl.getByRole('heading', { name: /우수자 관리/ }).waitFor({ timeout: 6000 });
    assert(tokenCalls === 1, `새로고침 후 재로그인 없음 (토큰 요청 ${tokenCalls}회)`);
    await ctx.close();
    console.log('  ✓ Supabase 모드: iframe 안 로그인 세션 유지');
  }
} catch (e) {
  problems.push('중단: ' + e.message);
} finally {
  await browser.close();
}
if (problems.length) {
  console.log('문제:\n  - ' + [...new Set(problems)].join('\n  - '));
  process.exit(1);
}
console.log('Teams 개인 탭 검증 통과');
