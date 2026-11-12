/**
 * 인물 상세 화면 액자 크기 비교 스크린샷
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/detail-frame-shots.mjs <출력폴더 이름> [baseUrl]
 * 데모 관리자에서 테스트용 인물 사진을 올린 뒤, 375·768·1280px 상세 화면과 관리자 미리보기를 찍고
 * 액자·사진의 실제 렌더 크기(px)를 출력합니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const NAME = process.argv[2] ?? 'detail-frame';
const BASE = process.argv[3] ?? 'http://localhost:4173';
const OUT = `docs/screenshots/${NAME}`;
fs.mkdirSync(OUT, { recursive: true });
const PORTRAIT = 'docs/screenshots/test-portrait.png';

const SIZES = [
  ['mobile-375', { width: 375, height: 812 }, true],
  ['tablet-768', { width: 768, height: 1024 }, true],
  ['desktop-1280', { width: 1280, height: 800 }, false],
];

async function makePortrait(browser) {
  if (fs.existsSync(PORTRAIT)) return;
  const p = await browser.newPage();
  const data = await p.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#9fb7d9');
    bg.addColorStop(1, '#e9eef6');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);
    g.fillStyle = '#1f2a44';
    g.beginPath();
    g.ellipse(450, 1200, 330, 300, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#e8c4a4';
    g.beginPath();
    g.ellipse(450, 520, 170, 210, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2018';
    g.beginPath();
    g.ellipse(450, 380, 185, 120, 0, Math.PI, 0);
    g.fill();
    // 눈·입 (식별 가능 여부를 보기 위한 얼굴 특징)
    g.fillStyle = '#2a2018';
    g.beginPath();
    g.ellipse(390, 500, 16, 10, 0, 0, Math.PI * 2);
    g.ellipse(510, 500, 16, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#a0524a';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(450, 590, 45, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    return c.toDataURL('image/png').split(',')[1];
  });
  await p.close();
  fs.writeFileSync(PORTRAIT, Buffer.from(data, 'base64'));
}

const measure = (p, root) =>
  p.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document;
    const img = scope.querySelector('img[alt$="증명사진"]');
    const frame = img?.closest('.rounded-\\[4px\\]');
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height) : null);
    return { frame: r(frame), photo: r(img) };
  }, root);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await makePortrait(browser);
const errors = [];
const results = {};
try {
  // 데모 관리자: 김하늘 사진 올리기
  const adm = await ctx.newPage();
  adm.on('pageerror', (e) => errors.push(e.message));
  await adm.goto(BASE + '/admin/login');
  await adm.getByLabel('비밀번호').fill('demo1234');
  await adm.getByRole('button', { name: '로그인' }).click();
  await adm.getByRole('link', { name: '김하늘 수정' }).click();
  await adm.getByLabel('증명사진 파일 선택').setInputFiles(PORTRAIT);
  await adm.getByRole('button', { name: '적용' }).click();
  await adm.getByText('사진을 적용했습니다').waitFor();
  await adm.getByRole('button', { name: '저장' }).click();
  await adm.getByText('저장했습니다').first().waitFor();
  await adm.waitForTimeout(2600);
  results['admin-preview-1280'] = await measure(adm, 'aside[aria-label="공개 화면 미리보기"]');
  await adm.screenshot({ path: `${OUT}/admin-preview-1280.png` });
  // 미리보기 패널만 확대
  await adm.locator('aside[aria-label="공개 화면 미리보기"]').screenshot({ path: `${OUT}/admin-preview-panel.png` });

  for (const [name, viewport, touch] of SIZES) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setViewportSize(viewport);
    await p.goto(BASE + '/');
    await p.getByRole('button', { name: '입장하기' }).click();
    await p.getByRole('button', { name: '처음 화면으로' }).waitFor();
    await p.waitForTimeout(1200);
    await p.locator('[data-frame-id] button').first().click();
    await p.getByRole('dialog').waitFor();
    await p.waitForTimeout(2600); // 현상 애니메이션 끝까지
    results[name] = await measure(p, '[role="dialog"]');
    await p.screenshot({ path: `${OUT}/detail-${name}.png` });
    void touch;
    await p.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(`${OUT}/sizes.json`, JSON.stringify(results, null, 2));
if (errors.length) {
  console.log('페이지 오류:', errors);
  process.exit(1);
}
