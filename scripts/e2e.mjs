/**
 * 데모 모드 전체 흐름 E2E (Playwright)
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/e2e.mjs [baseUrl]
 * 콘솔 오류·페이지 오류·가로 스크롤을 검사하고, 단계별 스크린샷을 docs/screenshots/e2e-* 로 남깁니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  pc: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

const problems = [];
let step = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(`검증 실패: ${msg}`);
}

async function checkLayout(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const overflowX = doc.scrollWidth - window.innerWidth;
    // 잘린 글자: 말줄임(truncate) 의도가 없는데 내용이 넘치는 요소
    const clipped = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,button,a,label,span')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      if (cs.textOverflow === 'ellipsis' || el.closest('.sr-only')) continue;
      if ((cs.overflowX === 'hidden' || cs.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim())
        clipped.push(el.textContent.trim().slice(0, 40));
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1) && cs.position !== 'fixed' && el.textContent.trim())
        clipped.push(`[화면 밖] ${el.textContent.trim().slice(0, 40)}`);
    }
    return { overflowX, clipped: [...new Set(clipped)].slice(0, 8) };
  });
  if (r.overflowX > 1) problems.push(`[${label}] 가로 스크롤 ${r.overflowX}px`);
  if (r.clipped.length) problems.push(`[${label}] 잘림 의심: ${r.clipped.join(' | ')}`);
}

async function snap(page, key, name) {
  step++;
  await page.screenshot({ path: `${OUT}/e2e-${key}-${String(step).padStart(2, '0')}-${name}.png` });
  await checkLayout(page, `${key}/${name}`);
}

function watch(page, key) {
  page.on('pageerror', (e) => problems.push(`[${key}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${key}] console.${m.type()}: ${m.text()}`);
  });
}

async function makePortrait(browser) {
  const p = await browser.newPage();
  const data = await p.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1100;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1100);
    bg.addColorStop(0, '#9fb7d9');
    bg.addColorStop(1, '#e9eef6');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1100);
    g.fillStyle = '#1f2a44';
    g.beginPath();
    g.ellipse(450, 1100, 330, 300, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#e8c4a4';
    g.beginPath();
    g.ellipse(450, 470, 170, 210, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2018';
    g.beginPath();
    g.ellipse(450, 330, 185, 120, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(380, 760, 140, 120);
    return c.toDataURL('image/png').split(',')[1];
  });
  await p.close();
  const file = 'docs/screenshots/test-portrait.png';
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

function makeWav() {
  // 1초짜리 조용한 사인파 WAV (테스트용, 외부 음원 아님)
  const rate = 8000;
  const n = rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 800), 44 + i * 2);
  const file = 'docs/screenshots/test-tone.wav';
  fs.writeFileSync(file, buf);
  return file;
}
const wavFile = makeWav();

/**
 * 자동 재생이 막힌 브라우저 흉내: 실제 사용자 조작(isTrusted) 전까지 미디어 play() 가 NotAllowedError.
 * (Playwright 의 Chromium 은 기본적으로 자동 재생을 허용하므로 차단 경로를 검증하려면 필요)
 */
async function simulateAutoplayBlock(ctx) {
  await ctx.addInitScript(() => {
    let activated = false;
    for (const t of ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'])
      window.addEventListener(t, (e) => e.isTrusted && (activated = true), true);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (activated) return play.call(this);
      return Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError'));
    };
  });
}

/**
 * 주의: Playwright 가 페이지 안에서 실행하는 확인(evaluate·요소 대기)은 크롬이 '사용자 조작'으로 취급해
 * 자동 재생을 허용해 버립니다. 차단 경로를 검증할 때는 앱의 판별(최대 1.2초)이 끝날 때까지
 * 페이지 안에서 아무것도 실행하지 않고 기다린 뒤 확인합니다.
 */
const settleAutoplayProbe = (p) => p.waitForTimeout(1600);

/** 첫 진입 배경음악: 허용 / 차단 / 소리 꺼짐 / 키 입력 / 빈 곳 클릭 */
async function autostartScenarios(blockedBrowser, allowedBrowser, key, opts) {
  const browser = blockedBrowser;
  const audio = (p) => p.evaluate(() => window.__awardsAudio);
  const hint = (p) => p.getByText('화면을 한 번 누르면 음악이 시작됩니다');

  // (1-차단) 실제 브라우저 정책으로 자동 재생 차단: 조용히 실패 → 안내 → 빈 곳 클릭/터치로 시작
  {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    watch(p, `${key}/real-block`);
    await p.goto(BASE + '/');
    await settleAutoplayProbe(p);
    await hint(p).waitFor({ timeout: 4000 });
    let a = await audio(p);
    assert(a.autostart === 'blocked' && !a.unlocked, `실제 차단을 조용히 감지 (${JSON.stringify(a)})`);
    const y = Math.round(p.viewportSize().height * 0.85);
    if (opts.hasTouch) await p.touchscreen.tap(40, y);
    else await p.mouse.click(40, y);
    await p.waitForFunction(() => window.__awardsAudio?.musicPlaying, null, { timeout: 3000 });
    await hint(p).waitFor({ state: 'hidden', timeout: 3000 });
    a = await audio(p);
    assert(a.contextState === 'running', `한 번 누르면 시작 (${JSON.stringify(a)})`);
    assert(await p.getByRole('button', { name: '입장하기' }).isVisible(), '빈 곳을 눌러도 화면 전환 없이 음악만 시작');
    await ctx.close();
  }

  // (1-허용) 자동 재생이 허용된 브라우저: 열리자마자 게이트에서 음악 재생, 안내 없음
  {
    const ctx = await allowedBrowser.newContext({ ...opts, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    watch(p, `${key}/autoplay-allowed`);
    await p.goto(BASE + '/');
    await p.waitForFunction(() => window.__awardsAudio?.musicPlaying, null, { timeout: 4000 });
    const a = await audio(p);
    assert(a.autostart === 'playing' && a.contextState === 'running', `허용 환경 자동 재생 (${JSON.stringify(a)})`);
    assert(await p.getByRole('button', { name: '입장하기' }).isVisible(), '게이트 화면 그대로');
    assert(!(await hint(p).isVisible()), '허용 환경에서는 안내 없음');
    // 입장해도 음악은 끊기지 않고 계속
    await p.getByRole('button', { name: '입장하기' }).click();
    await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 2500 });
    assert((await audio(p)).musicPlaying, '입장 후에도 계속 재생');
    await ctx.close();
  }

  // (2) 소리를 꺼 둔 상태를 기억하면 자동 재생을 시도하지 않음
  {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => localStorage.setItem('awards.sound', '0'));
    const p = await ctx.newPage();
    watch(p, `${key}/sound-off`);
    await p.goto(BASE + '/');
    await p.getByRole('button', { name: '입장하기' }).waitFor();
    await p.waitForTimeout(1200);
    const a = await audio(p);
    assert(!a.musicPlaying && !a.unlocked && a.autostart === 'off', `소리 꺼짐: 시도 안 함 (${JSON.stringify(a)})`);
    assert(!(await hint(p).isVisible()), '소리 꺼짐: 안내 없음');
    await ctx.close();
  }

  // (3) 차단 환경: 키 입력 한 번으로 시작 (게이트 그대로)
  {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    await simulateAutoplayBlock(ctx);
    const p = await ctx.newPage();
    watch(p, `${key}/blocked-key`);
    await p.goto(BASE + '/');
    await settleAutoplayProbe(p);
    await hint(p).waitFor({ timeout: 4000 });
    assert(!(await audio(p)).musicPlaying, '차단: 조작 전 재생 안 함');
    await p.keyboard.press('a');
    await p.waitForFunction(() => window.__awardsAudio?.musicPlaying, null, { timeout: 3000 });
    await hint(p).waitFor({ state: 'hidden', timeout: 3000 });
    assert(await p.getByRole('button', { name: '입장하기' }).isVisible(), '키 입력은 화면 전환 없이 음악만 시작');
    await ctx.close();
  }

  // (4) 차단 환경: 버튼이 아닌 빈 곳을 눌러도 시작
  {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    await simulateAutoplayBlock(ctx);
    const p = await ctx.newPage();
    watch(p, `${key}/blocked-click`);
    await p.goto(BASE + '/');
    await settleAutoplayProbe(p);
    await hint(p).waitFor({ timeout: 4000 });
    await snap(p, key, 'music-hint');
    const vp = p.viewportSize();
    if (opts.hasTouch) await p.touchscreen.tap(Math.round(vp.width * 0.12), Math.round(vp.height * 0.8));
    else await p.mouse.click(Math.round(vp.width * 0.12), Math.round(vp.height * 0.8));
    await p.waitForFunction(() => window.__awardsAudio?.musicPlaying, null, { timeout: 3000 });
    await hint(p).waitFor({ state: 'hidden', timeout: 3000 });
    const a = await audio(p);
    assert(a.contextState === 'running' && a.autostart === 'playing', `빈 곳 클릭으로 시작 (${JSON.stringify(a)})`);
    await ctx.close();
  }
  console.log(`  ✓ 첫 진입 음악: 실제 차단→${opts.hasTouch ? '터치' : '클릭'}·자동 재생 허용·소리 꺼짐·키 입력·빈 곳 ${opts.hasTouch ? '터치' : '클릭'}`);
}

async function run(browser, key, opts, portrait) {
  step = 0;
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
  await simulateAutoplayBlock(ctx); // 주 흐름은 자동 재생이 막힌 브라우저 기준
  const pub = await ctx.newPage();
  watch(pub, `${key}/public`);

  const audio = (p) => p.evaluate(() => window.__awardsAudio);

  // 1. 게이트 → 입장하기 → 바로 갤러리 (긴 오프닝 없음)
  await pub.goto(BASE + '/');
  await settleAutoplayProbe(pub);
  await pub.getByRole('button', { name: '입장하기' }).waitFor();
  assert((await pub.locator('input').count()) === 0, '첫 화면에 접속 코드 입력칸 없음');
  await snap(pub, key, 'gate');
  assert(!(await audio(pub)).musicPlaying, '차단 환경: 클릭 전에는 음악 재생 안 함');
  assert(await pub.getByText('화면을 한 번 누르면 음악이 시작됩니다').isVisible(), '차단 환경: 음악 시작 안내 표시');
  const t0 = Date.now();
  await pub.getByRole('button', { name: '입장하기' }).click();
  await pub.waitForTimeout(500);
  await snap(pub, key, 'curtain-opening');
  assert(!(await pub.getByText('2026 제안제도 우수 수행자를 소개합니다').isVisible()), '바로 입장: 오프닝 문구 없음');
  // 2. 갤러리 (2.5초 안에)
  await pub.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 2500 });
  const elapsed = Date.now() - t0;
  assert(elapsed < 2600, `입장 후 갤러리까지 ${elapsed}ms`);
  let a = await audio(pub);
  assert(a.musicPlaying && a.musicSource === 'synth', `입장 클릭 후 기본 음악 재생 (${JSON.stringify(a)})`);
  assert(a.contextState === 'running', `AudioContext 실행 중 (${a.contextState})`);
  assert(!(await pub.getByText('화면을 한 번 누르면 음악이 시작됩니다').isVisible()), '음악이 시작되면 안내 사라짐');
  await pub.waitForTimeout(1500);
  await snap(pub, key, 'gallery');
  // 갤러리 안내문구: 헤더에 한 줄로
  const clickHint = pub.getByText('액자를 클릭하면 수상자가 공개됩니다.');
  assert(await clickHint.isVisible(), '갤러리 안내문구 표시');
  const hb = await clickHint.boundingBox();
  assert(hb && hb.height < 28 && hb.x >= 0 && hb.x + hb.width <= pub.viewportSize().width, `안내문구 한 줄·화면 안 (${JSON.stringify(hb)})`);
  const plate = (p, i) => p.locator('[data-frame-id]').nth(i);
  assert(await plate(pub, 0).getByText('공개 전').isVisible(), '첫 접속: 공개된 사람도 물음표 상태로 시작');

  // 3. 액자 클릭 → 상세(네 파트)
  await pub.locator('[data-frame-id] button').first().click();
  const dlg = pub.getByRole('dialog');
  await dlg.waitFor();
  assert((await audio(pub)).ducked, '상세 화면에서 음악 덕킹');
  for (const t of ['AS-IS', 'ACTION', 'TO-BE', 'REFLECTION', '제안 주제', '도장 라인 지그 교체 시간 단축'])
    assert(await dlg.getByText(t, { exact: false }).first().isVisible(), `상세에 "${t}" 표시`);
  await pub.waitForTimeout(2300);
  await snap(pub, key, 'detail');
  // 4. 이전/다음 (키보드 + 버튼)
  await pub.keyboard.press('ArrowRight');
  await dlg.getByText('출하 검사 성적서 자동 작성', { exact: true }).waitFor();
  await pub.getByRole('button', { name: '이전 우수자' }).click();
  await dlg.getByText('도장 라인 지그 교체 시간 단축', { exact: true }).waitFor();
  await pub.getByRole('button', { name: '다음 우수자' }).click();
  await dlg.getByText('출하 검사 성적서 자동 작성', { exact: true }).waitFor();
  await pub.waitForTimeout(2300);
  await dlg.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await pub.waitForTimeout(500);
  await snap(pub, key, 'detail-next-bottom');
  await pub.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
  a = await audio(pub);
  assert(!a.ducked && a.musicPlaying, '상세를 닫으면 덕킹 해제, 음악은 계속');
  // 공개 전 액자
  await pub.locator('[data-frame-id] button').nth(3).click();
  await pub.getByText('발표 전입니다').waitFor();

  // 5. 관리자 로그인
  const adm = await ctx.newPage();
  watch(adm, `${key}/admin`);
  await adm.goto(BASE + '/admin');
  await adm.waitForURL('**/admin/login');
  await adm.getByLabel('비밀번호').fill('wrong');
  await adm.getByRole('button', { name: '로그인' }).click();
  await adm.getByText('비밀번호가 올바르지 않습니다').waitFor();
  await adm.getByLabel('비밀번호').fill('demo1234');
  await adm.getByRole('button', { name: '로그인' }).click();
  await adm.getByRole('heading', { name: /우수자 관리/ }).waitFor();
  await snap(adm, key, 'admin-list');
  // 관리자 탭을 새로 열어도(새 접속) 발표 탭에서 이미 연 액자는 그대로
  assert(await plate(pub, 0).getByText('김하늘').isVisible(), '관리자 탭을 열어도 발표 탭의 공개 상태 유지');

  // 6. 우수자 수정 + 사진 업로드
  await adm.getByRole('link', { name: '김하늘 수정' }).click();
  const topic = adm.getByLabel('제안 주제 *');
  await topic.waitFor();
  await topic.fill('도장 라인 지그 교체 시간 단축 (수정됨)');
  await adm.getByLabel('증명사진 파일 선택').setInputFiles(portrait);
  await adm.getByRole('dialog', { name: '사진 자르기 (3:4)' }).waitFor();
  await adm.waitForTimeout(500);
  await snap(adm, key, 'admin-crop');
  await adm.getByRole('button', { name: '적용' }).click();
  await adm.getByText('사진을 적용했습니다').waitFor();
  const src = await adm.locator('img[alt="김하늘 증명사진"]').first().getAttribute('src');
  assert(src?.startsWith('data:image/webp') || src?.startsWith('data:image/jpeg'), `사진이 WebP 로 변환됨 (${src?.slice(0, 20)})`);
  const dims = await adm.evaluate(
    (s) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = s; }),
    src,
  );
  assert(dims[1] <= 1200 && Math.abs(dims[0] / dims[1] - 0.75) < 0.01, `3:4, 최대 1200px (${dims})`);
  await adm.getByRole('button', { name: '저장' }).click();
  await adm.getByText('저장했습니다').first().waitFor();
  if (key === 'mobile') {
    await adm.getByRole('tab', { name: '미리보기' }).click();
    await adm.waitForTimeout(2500);
  } else await adm.waitForTimeout(2500);
  await snap(adm, key, 'admin-editor');

  // 7. 공개 화면 반영 확인
  await pub.bringToFront();
  await pub.waitForTimeout(500);
  await pub.locator('[data-frame-id] button').first().click();
  await pub.getByRole('dialog').getByText('도장 라인 지그 교체 시간 단축 (수정됨)', { exact: true }).waitFor();
  assert(await pub.getByRole('dialog').locator('img[alt="김하늘 증명사진"]').isVisible(), '공개 화면에 새 사진');
  await pub.waitForTimeout(2600);
  await snap(pub, key, 'public-updated');
  await pub.keyboard.press('Escape');
  await pub.getByRole('dialog').waitFor({ state: 'detached' });

  // 8. 발표 모드: 다음 사람 공개
  await adm.bringToFront();
  await adm.getByRole('link', { name: '발표 모드' }).click();
  await adm.getByRole('button', { name: '다음 사람 공개' }).click();
  await adm.getByText('최민준 님을 공개했습니다').waitFor();
  await snap(adm, key, 'admin-presentation');
  await pub.bringToFront();
  await pub.waitForTimeout(1000);
  await snap(pub, key, 'reveal-spotlight');
  await pub.waitForTimeout(1500);
  await snap(pub, key, 'reveal-done');
  await pub.locator('[data-frame-id]').nth(3).getByText('최민준').waitFor({ timeout: 5000 });

  // 9. 처음 화면으로 → 게이트, 음악은 계속
  await pub.getByRole('button', { name: '처음 화면으로' }).click();
  await pub.getByRole('button', { name: '입장하기' }).waitFor();
  assert((await audio(pub)).musicPlaying, '처음 화면으로 돌아가도 음악 유지');
  await pub.getByRole('button', { name: '입장하기' }).click();
  await pub.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 2500 });
  assert(await plate(pub, 0).getByText('김하늘').isVisible(), '같은 접속 안에서는 처음 화면에 다녀와도 공개 상태 유지');

  // 9-1. 새로 접속(새로고침): 공개된 사람도 다시 물음표 상태, 클릭해야 열림
  await pub.reload();
  await settleAutoplayProbe(pub);
  await pub.getByRole('button', { name: '입장하기' }).click();
  await pub.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 2500 });
  await pub.waitForTimeout(1500);
  for (const i of [0, 1, 3]) {
    assert(await plate(pub, i).getByText('공개 전').isVisible(), `새로고침 후 ${i + 1}번 액자 물음표 상태`);
  }
  assert(!(await plate(pub, 0).getByText('김하늘').isVisible()), '새로고침 후 이름이 보이지 않음');
  assert(await pub.getByText('액자를 클릭하면 수상자가 공개됩니다.').isVisible(), '새로고침 후에도 안내문구');
  await snap(pub, key, 'revisit-gallery');
  await pub.locator('[data-frame-id] button').first().click();
  await pub.getByRole('dialog').waitFor();
  await pub.keyboard.press('Escape');
  await pub.getByRole('dialog').waitFor({ state: 'detached' });
  await plate(pub, 0).getByText('김하늘').waitFor();

  // 10. 관리자: 입장 연출을 시네마틱으로 → 건너뛰기 동작
  await adm.bringToFront();
  await adm.goto(`${BASE}/admin/settings`);
  await adm.getByRole('radio', { name: /시네마틱 오프닝/ }).waitFor();
  assert((await adm.getByText('접속 코드').count()) === 0, '연출 설정에 접속 코드 영역 없음');
  await adm.getByRole('radio', { name: /시네마틱 오프닝/ }).click();
  await adm.getByRole('button', { name: '설정 저장', exact: true }).click();
  await adm.getByText('연출 설정을 저장했습니다').waitFor();
  const fresh = await ctx.newPage();
  watch(fresh, `${key}/fresh`);
  await fresh.goto(BASE + '/');
  await fresh.getByRole('button', { name: '입장하기' }).click();
  await fresh.getByText('2026 제안제도 우수 수행자를 소개합니다').waitFor({ timeout: 4000 });
  assert((await audio(fresh)).introDucked, '시네마틱 오프닝 중 음악은 덕킹');
  await fresh.waitForTimeout(1500);
  await snap(fresh, key, 'cinematic-headline');
  await fresh.getByRole('button', { name: '건너뛰기' }).click();
  await fresh.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
  // 새 탭 = 새 접속: 물음표로 시작, 기존 발표 탭은 그대로
  assert(await plate(fresh, 0).getByText('공개 전').isVisible(), '새 탭은 물음표 상태로 시작');
  assert(await plate(pub, 0).getByText('김하늘').isVisible(), '새 탭이 열려도 기존 탭의 공개 상태 유지');
  a = await audio(fresh);
  assert(a.musicPlaying && !a.introDucked, '건너뛰기 후 음악은 계속, 덕킹 해제');
  await fresh.waitForTimeout(9000); // 건너뛴 뒤 남은 타이머가 연출을 다시 띄우지 않는지
  assert(!(await fresh.getByText('2026 제안제도 우수 수행자를 소개합니다').isVisible()), '건너뛴 뒤 오프닝 문구가 다시 나타나지 않음');
  await snap(fresh, key, 'after-skip');
  // 관리자: 배경음악 미리듣기 → 업로드 → 업로드 음악으로 재생
  await adm.bringToFront();
  await adm.getByRole('button', { name: '미리듣기' }).click();
  await adm.waitForTimeout(400);
  let aa = await audio(adm);
  assert(aa.musicPlaying && aa.musicSource === 'synth', `관리자 미리듣기: 기본 음악 (${JSON.stringify(aa)})`);
  await adm.getByLabel('배경음악 음량').fill('0.3');
  assert(Math.abs((await audio(adm)).volume - 0.3) < 0.01, '음량 슬라이더 즉시 반영');
  await adm.getByRole('button', { name: '미리듣기 정지' }).click();
  await adm.getByLabel('배경음악 파일 선택').setInputFiles(wavFile);
  await adm.getByText('배경음악을 등록했습니다').waitFor();
  assert((await adm.getByRole('radio', { name: /업로드한 음악/ }).getAttribute('aria-checked')) === 'true', '업로드 후 업로드 음악 선택');
  await adm.getByRole('button', { name: '미리듣기' }).click();
  await adm.waitForTimeout(600);
  aa = await audio(adm);
  assert(aa.musicPlaying && aa.musicSource === 'url', `업로드 음악 미리듣기 (${JSON.stringify(aa)})`);
  await adm.getByRole('button', { name: '미리듣기 정지' }).click();
  await snap(adm, key, 'admin-music');
  // 공개 화면: 업로드 음악으로 바뀜
  await fresh.bringToFront();
  await fresh.waitForTimeout(800);
  aa = await audio(fresh);
  assert(aa.musicPlaying && aa.musicSource === 'url', `공개 화면도 업로드 음악으로 교체 (${JSON.stringify(aa)})`);
  // 기본 음악으로 되돌림
  await adm.bringToFront();
  await adm.getByRole('button', { name: '업로드한 음악 삭제' }).click();
  await adm.getByText('기본 음악을 사용합니다').waitFor();

  // 원래대로(바로 입장)
  await adm.bringToFront();
  await adm.getByRole('radio', { name: /바로 입장/ }).click();
  await adm.getByRole('button', { name: '설정 저장', exact: true }).click();
  await adm.getByText('연출 설정을 저장했습니다').first().waitFor();

  // 11. 소리 토글: 음악·효과음 함께 끄고, 상태 기억
  const toggle = fresh.getByRole('button', { name: /음악·효과음 (끄기|켜기)/ });
  assert((await toggle.getAttribute('aria-pressed')) === 'true', '기본은 소리 켜짐');
  await toggle.click();
  assert((await toggle.getAttribute('aria-pressed')) === 'false', '토글 끔');
  assert(!(await audio(fresh)).enabled, '엔진도 꺼짐');
  assert((await fresh.evaluate(() => localStorage.getItem('awards.sound'))) === '0', '토글 상태 저장');
  await fresh.reload();
  assert((await fresh.getByRole('button', { name: /음악·효과음 켜기/ }).getAttribute('aria-pressed')) === 'false', '새로고침 후에도 꺼짐 유지');
  await fresh.getByRole('button', { name: /음악·효과음 켜기/ }).click();

  // 12. 탭 숨김 → 음악 일시정지, 복귀 → 재개
  await fresh.getByRole('button', { name: '입장하기' }).click();
  await fresh.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
  const hidden = await fresh.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 300));
    const s1 = window.__awardsAudio.contextState;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 300));
    return [s1, window.__awardsAudio.contextState];
  });
  assert(hidden[0] === 'suspended' && hidden[1] === 'running', `탭 숨김 시 정지·복귀 시 재개 (${hidden})`);

  // 13. 모두 공개 전이면 안내문구 숨김 (클릭해도 열 수 있는 액자가 없음)
  await adm.bringToFront();
  await adm.goto(`${BASE}/admin/presentation`);
  await adm.getByRole('button', { name: '전체 비공개' }).click();
  await adm.getByRole('alertdialog').getByRole('button', { name: '전체 비공개' }).click();
  await adm.getByText('전체 비공개로 바꿨습니다').waitFor();
  await fresh.bringToFront();
  await fresh.getByText('액자를 클릭하면 수상자가 공개됩니다.').waitFor({ state: 'hidden', timeout: 5000 });
  await adm.getByRole('button', { name: '전체 공개' }).click();
  await adm.getByRole('alertdialog').getByRole('button', { name: '전체 공개' }).click();
  await fresh.getByText('액자를 클릭하면 수상자가 공개됩니다.').waitFor({ timeout: 5000 });

  // 관리자 다른 화면 레이아웃 점검
  await adm.bringToFront();
  for (const path of ['settings', 'backup']) {
    await adm.goto(`${BASE}/admin/${path}`);
    await adm.waitForTimeout(800);
    await snap(adm, key, `admin-${path}`);
  }
  await ctx.close();
}

const browser = await chromium.launch();
// 첫 진입 음악 검증용: 브라우저 자체 정책으로 자동 재생을 '항상 차단' / '허용' 한 두 브라우저
// (Chromium 기본값은 방문 이력 등에 따라 판단이 달라질 수 있어 확정적으로 고정)
const blockedBrowser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
const allowedBrowser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const portrait = await makePortrait(browser);
  for (const [key, opts] of Object.entries(VIEWPORTS)) {
    console.log(`▶ ${key}`);
    await autostartScenarios(blockedBrowser, allowedBrowser, key, opts);
    await run(browser, key, opts, portrait);
    console.log(`  완료`);
  }
} catch (e) {
  problems.push(`중단: ${e.message}`);
} finally {
  await browser.close();
  await allowedBrowser.close();
  await blockedBrowser.close();
}
const uniq = [...new Set(problems)];
if (uniq.length) {
  console.log(`문제 ${uniq.length}건:`);
  for (const p of uniq) console.log('  - ' + p);
  process.exit(1);
}
console.log('E2E 통과: 콘솔 오류 0, 페이지 오류 0, 가로 스크롤 없음');
