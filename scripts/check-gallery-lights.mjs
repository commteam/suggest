/**
 * 갤러리 무대 조명 브라우저 검증
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/check-gallery-lights.mjs
 * - 입장 전 꺼짐 → 입장 후 켜짐(opacity 1.2s)
 * - 몇 초 간격으로 빔·광원 transform 이 실제로 바뀌는지 + 스크린샷
 * - prefers-reduced-motion: 애니메이션 없음, 고정 위치
 * - 모바일 CPU 4x 스로틀: rAF 프레임 간격, DevTools Performance 지표(Layout/RecalcStyle 횟수)
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
const assert = (c, m) => {
  if (!c) throw new Error('검증 실패: ' + m);
};

const lightState = (p) =>
  p.evaluate(() => {
    const lights = document.querySelector('[data-testid="gallery-lights"]');
    const items = [...document.querySelectorAll('[data-light]')].map((el) => {
      const cs = getComputedStyle(el);
      return { kind: el.dataset.light, transform: cs.transform, animation: cs.animationName, blend: cs.mixBlendMode };
    });
    return { opacity: lights ? Number(getComputedStyle(lights).opacity) : null, items };
  });

async function enter(p) {
  await p.goto(BASE + '/');
  await p.getByRole('button', { name: '입장하기' }).click();
  await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
}

const browser = await chromium.launch();
try {
  for (const [key, opts] of Object.entries(VIEWPORTS)) {
    // 1) 움직임 + 켜짐 + 가독성 스크린샷
    {
      const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => problems.push(`[${key}] pageerror: ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && problems.push(`[${key}] console: ${m.text()}`));
      await p.goto(BASE + '/');
      await p.getByRole('button', { name: '입장하기' }).waitFor();
      const before = await lightState(p);
      assert(before.opacity === 0, `[${key}] 입장 전(커튼 뒤) 조명 꺼짐 (${before.opacity})`);
      await p.getByRole('button', { name: '입장하기' }).click();
      await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
      await p.waitForTimeout(1500);
      const s0 = await lightState(p);
      assert(s0.opacity === 1, `[${key}] 입장 후 조명 켜짐 (${s0.opacity})`);
      assert(s0.items.filter((i) => i.kind === 'beam').length === 3, `[${key}] 빔 3개`);
      assert(s0.items.every((i) => i.blend === 'screen' && i.animation !== 'none'), `[${key}] screen 블렌드 + 애니메이션`);
      const shots = [];
      for (let t = 0; t < 3; t++) {
        const st = await lightState(p);
        shots.push(st.items.map((i) => i.transform));
        await p.screenshot({ path: `${OUT}/lights-${key}-${t}.png` });
        if (t < 2) await p.waitForTimeout(3000);
      }
      for (let i = 0; i < shots[0].length; i++) {
        const uniq = new Set(shots.map((s) => s[i]));
        assert(uniq.size >= 2, `[${key}] ${i === 0 ? '광원' : `빔 ${i}`} 이 시간에 따라 움직임 (${[...uniq].join(' | ')})`);
      }
      // 빔끼리 박자가 다름: 같은 시점에 회전 상태가 서로 다름
      assert(new Set(shots[2].slice(1)).size === 3, `[${key}] 빔 3개가 서로 다른 위치`);
      // 명패 글자는 조명보다 위(z-10)에 있어 덮이지 않음
      const onTop = await p.evaluate(() => {
        const plate = document.querySelector('[data-frame-id] button');
        const r = plate.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.bottom - 12);
        return !!el && !el.closest('[data-testid="gallery-lights"]');
      });
      assert(onTop, `[${key}] 액자·명패가 조명 위에 그려짐`);
      await ctx.close();
      console.log(`  ✓ [${key}] 입장 전 꺼짐 → 켜짐, 빔 3개·광원이 3초 간격으로 움직임, 액자가 조명 위`);
    }

    // 2) reduced-motion: 고정
    {
      const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await enter(p);
      await p.waitForTimeout(800);
      const a = await lightState(p);
      await p.waitForTimeout(2500);
      const b = await lightState(p);
      assert(a.opacity === 1, `[${key}] reduce: 조명은 보임`);
      assert(a.items.every((i) => i.animation === 'none'), `[${key}] reduce: 애니메이션 없음`);
      assert(JSON.stringify(a.items) === JSON.stringify(b.items), `[${key}] reduce: 위치 고정`);
      await p.screenshot({ path: `${OUT}/lights-${key}-reduced.png` });
      await ctx.close();
      console.log(`  ✓ [${key}] reduced-motion: 고정된 은은한 위치`);
    }
  }

  // 3) 모바일 CPU 4x 스로틀 성능 (DevTools Performance 지표)
  {
    const ctx = await browser.newContext({ ...VIEWPORTS.mobile, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await enter(p);
    await p.waitForTimeout(7500); // 입장 색종이(약 6.5초)가 끝난 뒤 측정
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    // (a) 아무것도 실행하지 않는 5초: 조명 애니메이션만 돌 때의 메인 스레드 부담
    const i0 = await metric();
    await p.waitForTimeout(5000);
    const i1 = await metric();
    // (b) rAF 로 프레임 간격 측정 (측정 루프 자체가 스타일 재계산을 일으키므로 (a)와 분리)
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
    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
    gaps.sort((x, y) => x - y);
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const p95 = gaps[Math.floor(gaps.length * 0.95)];
    const long = gaps.filter((g) => g > 50).length;
    const layouts = (m1.LayoutCount - m0.LayoutCount) + (i1.LayoutCount - i0.LayoutCount);
    const idleStyles = i1.RecalcStyleCount - i0.RecalcStyleCount;
    const idleTaskMs = (i1.TaskDuration - i0.TaskDuration) * 1000;
    const report = {
      fps: +(1000 / avg).toFixed(1),
      avgMs: +avg.toFixed(1),
      p95Ms: +p95.toFixed(1),
      framesOver50ms: long,
      layoutsIn10s: layouts,
      idle5s: { styleRecalcs: idleStyles, mainThreadTaskMs: +idleTaskMs.toFixed(0) },
    };
    console.log('  · 모바일 CPU 4x 스로틀 5초 측정:', JSON.stringify(report));
    assert(report.fps >= 50, `4x 스로틀에서도 50fps 이상 (${report.fps})`);
    assert(long <= 2, `50ms 넘는 프레임 2개 이하 (${long})`);
    assert(layouts <= 2, `조명 애니메이션이 레이아웃을 일으키지 않음 (${layouts})`);
    assert(idleStyles <= 30, `조명 애니메이션이 매 프레임 스타일 재계산을 일으키지 않음 (${idleStyles}/5초)`);
    fs.writeFileSync(`${OUT}/lights-perf-mobile-4x.json`, JSON.stringify(report, null, 2));
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
console.log('갤러리 조명 검증 통과');
