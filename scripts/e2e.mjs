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

async function run(browser, key, opts, portrait) {
  step = 0;
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
  const pub = await ctx.newPage();
  watch(pub, `${key}/public`);

  // 1. 입장 → 오프닝
  await pub.goto(BASE + '/');
  await pub.getByRole('button', { name: '입장하기' }).waitFor();
  await snap(pub, key, 'gate');
  await pub.getByRole('button', { name: '입장하기' }).click();
  await pub.getByText('2026 제안제도 우수 수행자를 소개합니다').waitFor({ timeout: 4000 });
  await pub.waitForTimeout(4500);
  await snap(pub, key, 'intro-dots');
  // 2. 갤러리
  await pub.getByRole('button', { name: '오프닝 다시 보기' }).waitFor({ timeout: 15000 });
  await pub.waitForTimeout(1500);
  await snap(pub, key, 'gallery');

  // 3. 액자 클릭 → 상세(네 파트)
  await pub.locator('[data-frame-id] button').first().click();
  const dlg = pub.getByRole('dialog');
  await dlg.waitFor();
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

  // 9. 오프닝 건너뛰기 → 다시 보기
  const fresh = await ctx.newPage();
  watch(fresh, `${key}/fresh`);
  await fresh.evaluate(() => sessionStorage.clear()).catch(() => {});
  await fresh.goto(BASE + '/');
  await fresh.evaluate(() => sessionStorage.clear());
  await fresh.reload();
  await fresh.getByRole('button', { name: '입장하기' }).click();
  await fresh.waitForTimeout(2500);
  await fresh.getByRole('button', { name: '건너뛰기' }).click();
  await fresh.getByRole('button', { name: '오프닝 다시 보기' }).waitFor({ timeout: 3000 });
  assert(!(await fresh.getByRole('button', { name: '건너뛰기' }).isVisible()), '건너뛰기 후 버튼 사라짐');
  await fresh.waitForTimeout(12000); // 건너뛴 뒤 남은 타이머가 연출을 다시 띄우지 않는지
  assert(!(await fresh.getByText('2026 제안제도 우수 수행자를 소개합니다').isVisible()), '건너뛴 뒤 오프닝 문구가 다시 나타나지 않음');
  await snap(fresh, key, 'after-skip');
  await fresh.getByRole('button', { name: '오프닝 다시 보기' }).click();
  await fresh.getByText('2026 제안제도 우수 수행자를 소개합니다').waitFor({ timeout: 4000 });
  await fresh.getByRole('button', { name: '오프닝 다시 보기' }).waitFor({ timeout: 16000 });
  await fresh.waitForTimeout(1200);
  await snap(fresh, key, 'replay-done');

  // 효과음 토글
  const toggle = fresh.getByRole('button', { name: /효과음 (끄기|켜기)/ });
  const before = await toggle.getAttribute('aria-pressed');
  await toggle.click();
  assert((await toggle.getAttribute('aria-pressed')) !== before, '효과음 토글');

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
try {
  const portrait = await makePortrait(browser);
  for (const [key, opts] of Object.entries(VIEWPORTS)) {
    console.log(`▶ ${key}`);
    await run(browser, key, opts, portrait);
    console.log(`  완료`);
  }
} catch (e) {
  problems.push(`중단: ${e.message}`);
} finally {
  await browser.close();
}
const uniq = [...new Set(problems)];
if (uniq.length) {
  console.log(`문제 ${uniq.length}건:`);
  for (const p of uniq) console.log('  - ' + p);
  process.exit(1);
}
console.log('E2E 통과: 콘솔 오류 0, 페이지 오류 0, 가로 스크롤 없음');
