/**
 * 갤러리 무대 배경 브라우저 검증
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/check-gallery-lights.mjs
 * - 1280·1920·375px: 입장 전 꺼짐 → 켜짐, 빔·광원·글로우·입자가 시간에 따라 움직임(스크린샷)
 * - 액자 5개 한 줄(데스크톱) / 2열(모바일), 하단 네모 패널 없음, 버튼·안내와 겹치지 않음, 명패 이름 잘림 없음
 * - prefers-reduced-motion: 움직임·입자·플래시 없음, 고정
 * - 모바일 CPU 4x 스로틀: 프레임 간격, DevTools Performance 지표(Layout/RecalcStyle)
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  'desktop-1280': { viewport: { width: 1280, height: 800 } },
  'desktop-1920': { viewport: { width: 1920, height: 1080 } },
  'mobile-375': { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
};
const problems = [];
const assert = (c, m) => {
  if (!c) throw new Error('검증 실패: ' + m);
};

const lightState = (p) =>
  p.evaluate(() => {
    const lights = document.querySelector('[data-testid="gallery-lights"]');
    const pick = (sel) =>
      [...document.querySelectorAll(sel)].map((el) => {
        const cs = getComputedStyle(el);
        return { transform: cs.transform, opacity: cs.opacity, animation: cs.animationName, display: cs.display };
      });
    return {
      opacity: lights ? Number(getComputedStyle(lights).opacity) : null,
      beams: pick('[data-light="beam"]'),
      wash: pick('[data-light="wash"]'),
      glow: pick('[data-light="glow"]'),
      flash: pick('[data-light="flash"]'),
      particlesBox: pick('[data-light="particles"]'),
      particleCount: Number(document.querySelector('[data-light="particles"]')?.dataset.count ?? 0),
      particles: pick('.gallery-dots, .gallery-star'),
    };
  });

const layout = (p) =>
  p.evaluate(() => {
    const items = [...document.querySelectorAll('[data-frame-id]')].map((el) => el.getBoundingClientRect());
    const footer = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('처음 화면으로'))?.getBoundingClientRect();
    const plates = [...document.querySelectorAll('[data-frame-id] button p')].map((el) => ({
      text: el.textContent,
      clipped: el.scrollWidth > el.clientWidth + 1,
    }));
    const backdrop = document.querySelector('[data-testid="gallery-lights"]')?.parentElement;
    const panelBoxes = backdrop ? backdrop.querySelectorAll('[class*="border"]').length : -1;
    const sy = window.scrollY;
    return {
      tops: items.map((r) => Math.round(r.top + sy)),
      widths: items.map((r) => Math.round(r.width)),
      lastBottom: Math.max(...items.map((r) => r.bottom + sy)),
      footerTop: footer ? footer.top + sy : null,
      plates,
      panelBoxes,
      hasFloor: !!document.querySelector('[data-floor]'),
      scrollW: document.scrollingElement.scrollWidth,
      vw: window.innerWidth,
    };
  });

async function enter(p) {
  await p.goto(BASE + '/');
  await p.getByRole('button', { name: '입장하기' }).click();
  await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
}

const browser = await chromium.launch();
try {
  for (const [key, opts] of Object.entries(VIEWPORTS)) {
    const mobile = !!opts.isMobile;
    // 1) 레이아웃 + 움직임 + 스크린샷
    {
      const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => problems.push(`[${key}] pageerror: ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && problems.push(`[${key}] console: ${m.text()}`));
      await p.goto(BASE + '/');
      await p.getByRole('button', { name: '입장하기' }).waitFor();
      assert((await lightState(p)).opacity === 0, `[${key}] 입장 전(커튼 뒤) 조명 꺼짐`);
      await p.getByRole('button', { name: '입장하기' }).click();
      await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
      await p.waitForTimeout(1600);
      const s0 = await lightState(p);
      assert(s0.opacity === 1, `[${key}] 입장 후 조명 켜짐`);
      assert(s0.beams.length === 4 && s0.wash.length === 1 && s0.glow.length === 1 && s0.flash.length === 1, `[${key}] 레이어 구성`);
      assert(s0.particleCount >= 17 && s0.particleCount <= 30, `[${key}] 입자 ${s0.particleCount}개`);
      assert([...s0.beams, ...s0.wash, ...s0.glow, ...s0.flash].every((i) => i.animation !== 'none'), `[${key}] 애니메이션 동작`);

      // 레이아웃
      const L = await layout(p);
      assert(L.hasFloor && L.panelBoxes === 0, `[${key}] 하단 네모 패널 없음 (${L.panelBoxes})`);
      assert(L.scrollW <= L.vw + 1, `[${key}] 가로 스크롤 없음`);
      if (!mobile) {
        assert(new Set(L.tops).size === 1, `[${key}] 액자 5개 한 줄 (${L.tops})`);
        assert(L.widths.every((w) => w === 180), `[${key}] 액자 폭 180px (${L.widths})`);
      } else {
        assert(new Set(L.tops).size === 3, `[${key}] 모바일 2열 줄바꿈 (${L.tops})`);
      }
      assert(L.footerTop === null || L.footerTop > L.lastBottom + 8, `[${key}] 처음 화면으로 버튼이 액자와 겹치지 않음 (${L.footerTop} > ${L.lastBottom})`);

      const shots = [];
      for (let t = 0; t < 3; t++) {
        shots.push(await lightState(p));
        await p.screenshot({ path: `${OUT}/stage-${key}-${t}.png` });
        if (t < 2) await p.waitForTimeout(2500);
      }
      const moved = (pick) => new Set(shots.map((s) => JSON.stringify(pick(s)))).size >= 2;
      for (let i = 0; i < 4; i++) assert(moved((s) => s.beams[i].transform), `[${key}] 빔 ${i + 1} 움직임`);
      assert(moved((s) => s.wash[0].transform), `[${key}] 가로지르는 광원 움직임`);
      assert(moved((s) => s.glow[0].opacity), `[${key}] 글로우 숨쉬기`);
      assert(moved((s) => s.particles.map((x) => x.transform + x.opacity)), `[${key}] 입자 움직임`);
      assert(new Set(shots[2].beams.map((b) => b.transform)).size === 4, `[${key}] 빔 4개가 서로 다른 위치`);

      // 명패: 공개된 사람 두 명을 열어 이름이 잘리지 않는지
      for (const i of [0, 1]) {
        await p.locator('[data-frame-id] button').nth(i).click();
        await p.getByRole('dialog').waitFor();
        await p.keyboard.press('Escape');
        await p.getByRole('dialog').waitFor({ state: 'detached' });
      }
      await p.waitForTimeout(400);
      const L2 = await layout(p);
      const names = L2.plates.filter((x) => /김하늘|이도윤|생산기술팀|품질보증팀/.test(x.text));
      assert(names.length >= 4 && names.every((x) => !x.clipped), `[${key}] 명패 이름·소속 잘림 없음 (${JSON.stringify(names)})`);
      await p.screenshot({ path: `${OUT}/stage-${key}-opened.png`, fullPage: mobile });
      await ctx.close();
      console.log(`  ✓ [${key}] 레이아웃(${mobile ? '2열' : '한 줄'}·네모 패널 없음·겹침 없음·명패 정상), 빔4·광원·글로우·입자 움직임`);
    }

    // 2) reduced-motion: 고정, 입자·플래시 없음
    {
      const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await enter(p);
      await p.waitForTimeout(600);
      const a = await lightState(p);
      await p.waitForTimeout(2500);
      const b = await lightState(p);
      assert(a.opacity === 1, `[${key}] reduce: 조명은 보임`);
      assert([...a.beams, ...a.wash, ...a.glow].every((i) => i.animation === 'none'), `[${key}] reduce: 애니메이션 없음`);
      assert(a.particlesBox[0].display === 'none' && a.flash[0].display === 'none', `[${key}] reduce: 입자·플래시 숨김`);
      assert(JSON.stringify(a) === JSON.stringify(b), `[${key}] reduce: 고정`);
      await p.screenshot({ path: `${OUT}/stage-${key}-reduced.png` });
      await ctx.close();
      console.log(`  ✓ [${key}] reduced-motion: 고정, 입자·플래시 없음`);
    }
  }

  // 3) 모바일 CPU 4x 스로틀 (DevTools Performance 지표)
  {
    const ctx = await browser.newContext({ ...VIEWPORTS['mobile-375'], deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await enter(p);
    await p.waitForTimeout(7500); // 입장 색종이가 끝난 뒤
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const i0 = await metric();
    await p.waitForTimeout(5000);
    const i1 = await metric();
    const m0 = await metric();
    const frames = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const ts = [];
          const start = performance.now();
          const tick = (t) => {
            ts.push(t);
            if (t - start < 5000) requestAnimationFrame(tick);
            else resolve(ts);
          };
          requestAnimationFrame(tick);
        }),
    );
    const m1 = await metric();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((x, y) => x - y);
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const report = {
      fps: +(1000 / avg).toFixed(1),
      p95Ms: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1),
      framesOver50ms: gaps.filter((g) => g > 50).length,
      layoutsIn10s: m1.LayoutCount - m0.LayoutCount + (i1.LayoutCount - i0.LayoutCount),
      idle5s: { styleRecalcs: i1.RecalcStyleCount - i0.RecalcStyleCount, mainThreadTaskMs: +((i1.TaskDuration - i0.TaskDuration) * 1000).toFixed(0) },
    };
    console.log('  · 모바일 CPU 4x 스로틀:', JSON.stringify(report));
    assert(report.fps >= 50, `4x 스로틀에서도 50fps 이상 (${report.fps})`);
    assert(report.framesOver50ms <= 2, `50ms 넘는 프레임 2개 이하 (${report.framesOver50ms})`);
    assert(report.layoutsIn10s <= 2, `레이아웃 없음 (${report.layoutsIn10s})`);
    // 매 프레임 재계산이면 5초에 150회 이상. 애니메이션 반복 경계에서만 생기는 수십 회는 정상
    assert(report.idle5s.styleRecalcs < 60, `매 프레임 스타일 재계산 없음 (${report.idle5s.styleRecalcs}/5초)`);
    fs.writeFileSync(`${OUT}/stage-perf-mobile-4x.json`, JSON.stringify(report, null, 2));
    await ctx.close();
    console.log('  ✓ 모바일 CPU 4x 스로틀: 프레임 안정');
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
console.log('갤러리 무대 배경 검증 통과');
