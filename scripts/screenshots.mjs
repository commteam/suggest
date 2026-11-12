/**
 * Playwright 화면 확인 스크립트
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/screenshots.mjs [gallery|intro|admin|all] [baseUrl]
 * 결과: docs/screenshots/*.png
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

// 전역 설치된 Playwright 도 찾을 수 있도록 require 사용
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const which = process.argv[2] ?? 'all';
const BASE = process.argv[3] ?? 'http://localhost:4173';
const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  pc: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

const errors = [];

async function newPage(browser, vp, { skipIntro = true, reduce = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
    deviceScaleFactor: Number(process.env.SCALE ?? 1),
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  await ctx.addInitScript((skip) => {
    if (skip) sessionStorage.setItem('awards.intro.seen', '1');
  }, skipIntro);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
  return page;
}

const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });

async function gallery(browser) {
  for (const [key, vp] of Object.entries(VIEWPORTS)) {
    const page = await newPage(browser, vp);
    await page.goto(BASE + '/');
    await page.waitForSelector('#gallery-title');
    await page.waitForTimeout(2500);
    await shot(page, `${key}-gallery`, { fullPage: true });

    await page.getByRole('button', { name: /1번 액자/ }).click();
    await page.waitForTimeout(3000);
    await shot(page, `${key}-detail-top`);
    await shot(page, `${key}-detail-full`, { fullPage: false });
    await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"]');
      el?.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(800);
    await shot(page, `${key}-detail-bottom`);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(2600);
    await shot(page, `${key}-detail-next`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /4번 액자/ }).click();
    await page.waitForTimeout(500);
    await shot(page, `${key}-locked-toast`);
    await page.context().close();
  }
}

async function intro(browser) {
  const marks = [
    ['01-curtain-closed', 0, 2500],
    ['02-drumroll', 1, 3000],
    ['03-dots', 1, 6400],
    ['04-flash', 1, 8550],
    ['05-curtain-opening', 1, 10600],
    ['06-gallery', 1, 15500],
  ];
  for (const [key, vp] of Object.entries(VIEWPORTS)) {
    for (const [name, clickFirst, wait] of marks) {
      const page = await newPage(browser, vp, { skipIntro: false });
      await page.goto(BASE + '/');
      if (clickFirst) {
        await page.getByRole('button', { name: '입장하기' }).click();
      }
      await page.waitForTimeout(wait);
      await shot(page, `${key}-intro-${name}`);
      await page.context().close();
    }
    const page = await newPage(browser, vp, { skipIntro: false, reduce: true });
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: '입장하기' }).click();
    await page.waitForTimeout(2500);
    await shot(page, `${key}-intro-reduced-motion`);
    await page.context().close();
  }
}

async function admin(browser) {
  for (const [key, vp] of Object.entries(VIEWPORTS)) {
    const page = await newPage(browser, vp);
    await page.goto(BASE + '/admin/login');
    await page.waitForTimeout(600);
    await shot(page, `${key}-admin-login`);
    await page.getByLabel('비밀번호').fill('demo1234');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForTimeout(1200);
    await shot(page, `${key}-admin-winners`, { fullPage: true });
    await page.getByRole('link', { name: /김하늘/ }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, `${key}-admin-editor`, { fullPage: true });
    await page.goto(BASE + '/admin/settings');
    await page.waitForTimeout(800);
    await shot(page, `${key}-admin-settings`, { fullPage: true });
    await page.goto(BASE + '/admin/presentation');
    await page.waitForTimeout(800);
    await shot(page, `${key}-admin-presentation`, { fullPage: true });
    await page.context().close();
  }
}

const browser = await chromium.launch();
try {
  if (which === 'gallery' || which === 'all') await gallery(browser);
  if (which === 'intro' || which === 'all') await intro(browser);
  if (which === 'admin' || which === 'all') await admin(browser);
} finally {
  await browser.close();
}
if (errors.length) {
  console.log('브라우저 오류:');
  for (const e of [...new Set(errors)]) console.log('  ' + e);
} else console.log('브라우저 오류 없음');
