/**
 * 갤러리 무대 배경 브라우저 검증
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/check-gallery-lights.mjs
 * - 1840×970(Teams)·1280·768·375px: 입장 전 꺼짐 → 켜짐, 빔·광원·글로우·입자·장식이 시간에 따라 움직임(스크린샷)
 * - 데스크톱(1280px 이상, 시안 C): 왼쪽 제목 단 + 오른쪽 별자리 액자 5개(위아래 물결), 별자리 선·빛 알갱이, 오로라·행성·오브제·플래시,
 *   이전 무대 요소(커튼·트러스·위쪽 빔·트로피) 없음
 * - 3+2(태블릿) / 2열(모바일), 하단 네모 패널 없음, 버튼·안내와 겹치지 않음, 명패 이름 잘림 없음
 * - 무대 장식(StageDecor): 커튼·트로피·벽 별·월계관이 액자·제목과 겹치지 않음, 커튼 → 조명 기구 → 월계관 → 바닥 → 입자 순서로 등장
 * - 시네마틱 조명(CinematicLights): 레이저가 지평선에서 뻗어 나가며 켜짐, 화면 크기별로 움직이는 층, 아나모픽 플래시 밝기·주기,
 *   렌즈 플레어가 제목·액자를 가리지 않음
 * - prefers-reduced-motion: 움직임·입자·플래시·컨페티·렌즈 플레어 없음, 정지 장식·정지된 빛만, 고정
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
  'teams-1840': { viewport: { width: 1840, height: 970 } },
  'desktop-1280': { viewport: { width: 1280, height: 800 } },
  'tablet-768': { viewport: { width: 768, height: 1024 } },
  'mobile-375': { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
};
const XL = 1280; // 이 폭부터 데스크톱 갈라 레이아웃 (시안 C)

/** 장식 배치: 화면에 보이는 장식 상자와 액자·제목 상자 */
const decorLayout = (p) =>
  p.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY, w: r.width, h: r.height };
    };
    const shown = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('[style*="display: none"]');
    };
    const visible = (sel) => [...document.querySelectorAll(sel)].filter(shown).map(box);
    const frames = [...document.querySelectorAll('[data-frame-id] button')].map(box);
    return {
      frames,
      title: box(document.getElementById('gallery-title').querySelector('.metal-text')),
      curtains: visible('.stage-curtain'),
      trophies: visible('.stage-trophy'),
      wallStars: visible('.stage-wall-star'),
      laurels: visible('[data-decor="laurel"]'),
      sparkles: visible('.cine-sparkle'),
      fixtures: visible('[data-fixture]'),
      truss: visible('.stage-truss'),
      confetti: Number(document.querySelector('[data-decor="confetti"]')?.dataset.count ?? 0),
      // 컨페티·유성은 모든 화면에서, 커튼 흔들림·선버스트 회전은 640px 이상에서만 움직임
      anim: [...document.querySelectorAll('.stage-confetti-piece[data-anim], .stage-shooting-star[data-anim]')].map((el) => getComputedStyle(el).animationName),
      sway: [...document.querySelectorAll('.stage-curtain[data-anim], .cine-fan[data-anim]')].map((el) => getComputedStyle(el).animationName),
    };
  });
const hit = (a, b, pad = 0) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
const decorOpacity = (p) =>
  p.evaluate(() =>
    Object.fromEntries(
      ['curtains', 'truss', 'laurel', 'floor', 'confetti'].map((n) => {
        const el = document.querySelector(`[data-decor="${n}"]`);
        return [n, el ? Number(getComputedStyle(el).opacity) : null];
      }),
    ),
  );
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
    // '처음 화면으로' 는 두 군데(데스크톱 제목 단 / 그 외 화면 아래) 중 보이는 것
    const footer = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('처음 화면으로') && b.getClientRects().length > 0)
      ?.getBoundingClientRect();
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
      footerRight: footer ? footer.right : null,
      lefts: items.map((r) => Math.round(r.left)),
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
      // 장식 등장 순서: 입장 버튼을 누른 때부터 각 층이 처음 보이기 시작한 시각을 기록
      await p.evaluate(() => {
        const names = ['curtains', 'truss', 'laurel', 'floor', 'confetti', 'gala-sky', 'gala-orbs'];
        const seen = (window.__decorSeen = {});
        const t0 = performance.now();
        const tick = () => {
          for (const n of names) {
            // 화면에 보이는 것 (모바일 월계관은 sm 이상에서 display:none)
            const el = [...document.querySelectorAll(`[data-decor="${n}"]`)].find((e) => getComputedStyle(e).display !== 'none');
            if (el && seen[n] === undefined && Number(getComputedStyle(el).opacity) > 0.05) seen[n] = Math.round(performance.now() - t0);
          }
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await p.getByRole('button', { name: '입장하기' }).click();
      await p.getByRole('button', { name: '처음 화면으로' }).waitFor({ timeout: 3000 });
      await p.waitForTimeout(3000);
      const seen = await p.evaluate(() => window.__decorSeen);
      // 트러스·조명 기구는 768px 미만에서 숨김
      // 데스크톱(시안 C)은 커튼·트러스·월계관이 없으므로 하늘(행성·오로라) → 오브제 → 바닥 → 입자
      const layers =
        opts.viewport.width >= XL
          ? ['gala-sky', 'gala-orbs', 'floor', 'confetti']
          : ['curtains', ...(opts.viewport.width >= 768 ? ['truss'] : []), 'laurel', 'floor', 'confetti'];
      const seq = layers.map((n) => seen[n]);
      assert(seq.every((t) => typeof t === 'number'), `[${key}] 장식이 모두 나타남 (${JSON.stringify(seen)})`);
      // 실제로 차례대로 보이기 시작 (측정은 프레임 타이밍에 따라 수십 ms 흔들리므로 순서만 확인)
      // (소프트웨어 렌더링에서는 프레임이 드문드문 와서 이웃한 두 층이 같은 프레임에 처음 보일 수 있음 → 같거나 늦으면 통과, 전체 폭은 0.6초 이상)
      for (let i = 1; i < seq.length; i++) assert(seq[i] >= seq[i - 1], `[${key}] 장식 등장 순서 (${JSON.stringify(seen)})`);
      assert(seq.at(-1) - seq[0] >= 600, `[${key}] 장식이 한꺼번에가 아니라 차례로 등장 (${JSON.stringify(seen)})`);
      // 간격 자체는 CSS 지연값으로 확인: 0, 0.3, 0.6, 0.9, 1.2초
      const delays = await p.evaluate(() =>
        ['curtains', 'truss', 'laurel', 'floor', 'confetti'].map((n) => {
          const el = [...document.querySelectorAll(`[data-decor="${n}"]`)].find((e) => getComputedStyle(e).display !== 'none') ?? document.querySelector(`[data-decor="${n}"]`);
          return parseFloat(getComputedStyle(el).transitionDelay);
        }),
      );
      assert(JSON.stringify(delays) === JSON.stringify([0, 0.3, 0.6, 0.9, 1.2]), `[${key}] 장식 등장 간격 0.3초 (${delays})`);
      console.log(`  · [${key}] 장식 등장(ms): ${JSON.stringify(seen)}`);
      const o2 = await decorOpacity(p);
      assert(['curtains', 'floor', 'confetti'].every((n) => o2[n] === 1), `[${key}] 장식 모두 나타남 (${JSON.stringify(o2)})`);
      const s0 = await lightState(p);
      assert(s0.opacity === 1, `[${key}] 입장 후 조명 켜짐`);
      assert(s0.beams.length === 4 && s0.wash.length === 1 && s0.glow.length === 1 && s0.flash.length === 1, `[${key}] 레이어 구성`);
      assert(s0.particleCount >= 17 && s0.particleCount <= 30, `[${key}] 입자 ${s0.particleCount}개`);
      assert([...s0.beams, ...s0.wash, ...s0.glow, ...s0.flash].every((i) => i.animation !== 'none'), `[${key}] 애니메이션 동작`);

      // 레이아웃
      const L = await layout(p);
      assert(L.hasFloor && L.panelBoxes === 0, `[${key}] 하단 네모 패널 없음 (${L.panelBoxes})`);
      assert(L.scrollW <= L.vw + 1, `[${key}] 가로 스크롤 없음`);
      if (key.startsWith('tablet')) {
        assert(new Set(L.tops).size === 2, `[${key}] 태블릿 두 줄 (${L.tops})`);
      } else if (!mobile) {
        // 시안 C: 5개가 왼쪽→오른쪽 순서로 한 줄, 1·3·5번이 아래인 물결
        assert(L.lefts.every((x, i) => i === 0 || x > L.lefts[i - 1]), `[${key}] 액자 5개 한 줄 순서대로 (${L.lefts})`);
        assert(new Set(L.tops).size === 2 && L.tops[0] > L.tops[1] && L.tops[2] > L.tops[1] && L.tops[0] === L.tops[2], `[${key}] 위아래 물결 (${L.tops})`);
        assert(new Set(L.widths).size === 1 && L.widths[0] >= 136 && L.widths[0] <= 170, `[${key}] 액자 폭 136~170px (${L.widths})`);
        const horizon = opts.viewport.height - Math.max(opts.viewport.height * 0.11, 96);
        assert(L.lastBottom < horizon - 20, `[${key}] 액자가 지평선 위 (${Math.round(L.lastBottom)} < ${Math.round(horizon)})`);
        assert(Math.min(...L.tops) > 60, `[${key}] 위쪽 액자가 화면 위 끝에 붙지 않음 (${Math.min(...L.tops)})`);
      } else {
        assert(new Set(L.tops).size === 3, `[${key}] 모바일 2열 줄바꿈 (${L.tops})`);
      }
      // 장식이 액자·제목을 가리지 않음
      const D = await decorLayout(p);
      const firstFrame = D.frames.reduce((a, b) => (a.l < b.l ? a : b));
      const lastFrame = D.frames.reduce((a, b) => (a.r > b.r ? a : b));
      const desk = opts.viewport.width >= XL;
      if (desk) {
        assert(D.curtains.length === 0, `[${key}] 데스크톱: 커튼 없음`);
        assert(firstFrame.l > D.title.r + 40, `[${key}] 액자는 제목 단 오른쪽 (${Math.round(firstFrame.l)} > ${Math.round(D.title.r)})`);
        assert(L.footerRight !== null && L.footerRight < firstFrame.l, `[${key}] 처음 화면으로 버튼은 제목 단 안`);
      } else {
        assert(D.curtains.length === 2, `[${key}] 커튼 2개`);
        assert(D.curtains[0].r <= firstFrame.l - 4 && D.curtains[1].l >= lastFrame.r + 4, `[${key}] 커튼이 액자와 겹치지 않음`);
        const cw = D.curtains[0].w / opts.viewport.width;
        assert(mobile ? cw >= 0.03 && cw <= 0.065 : cw >= 0.055 && cw <= 0.125, `[${key}] 커튼 폭 ${(cw * 100).toFixed(1)}%`);
      }
      for (const [name, list] of [['트로피', D.trophies], ['벽 별', D.wallStars], ['월계관', D.laurels]])
        for (const b of list) {
          assert(!D.frames.some((f) => hit(b, f, 6)), `[${key}] ${name}이 액자와 겹치지 않음`);
          assert(!hit(b, D.title, -2), `[${key}] ${name}이 제목 글자를 가리지 않음`);
        }
      const laurels = desk ? 0 : mobile ? 1 : 2;
      assert(D.laurels.length === laurels, `[${key}] 월계관 ${laurels}개 (${D.laurels.length})`);
      const wide = opts.viewport.width >= 1024;
      assert((D.truss.length === 1 && D.fixtures.length === 4) === (opts.viewport.width >= 768 && !desk), `[${key}] 트러스·조명 기구 표시 여부`);
      assert(D.trophies.length === (wide && !desk ? 2 : 0), `[${key}] 트로피 표시 여부 (${D.trophies.length})`);
      assert(D.confetti >= (mobile ? 6 : 10) && D.confetti <= 14, `[${key}] 컨페티 ${D.confetti}개`);
      assert(D.anim.length > 0 && D.anim.every((n) => n !== 'none'), `[${key}] 장식 애니메이션 동작`);
      assert(D.sway.every((n) => (opts.viewport.width >= 640 ? n !== 'none' : n === 'none')), `[${key}] 커튼 흔들림·레이저 쓸기는 640px 이상만 (${D.sway})`);

      // 시네마틱 조명
      const C = await p.evaluate(() => {
        const anims = (sel) => [...document.querySelectorAll(sel)].map((el) => getComputedStyle(el).animationName);
        const kf = (name) => {
          for (const sh of document.styleSheets)
            for (const r of sh.cssRules ?? []) {
              const found = r.cssRules && [...r.cssRules].find((x) => x.name === name) ;
              if (r.name === name || found) return [...(r.name === name ? r : found).cssRules].map((k) => Number(k.style.opacity || 0));
            }
          return [];
        };
        const sweep = document.querySelector('.cine-sweep');
        return {
          layers: ['cine-sky', 'cine-pillars', 'cine-wings', 'cine-lasers', 'cine-horizon', 'cine-sparkles', 'cine-floor'].filter((n) => document.querySelector(`[data-decor="${n}"]`)),
          opened: [...document.querySelectorAll('.cine-fan-open')].map((el) => getComputedStyle(el).transform),
          small: anims('.cine-burst, .cine-core-flare, .cine-sweep'),
          sparkle: anims('.cine-sparkle').filter((_, i) => getComputedStyle(document.querySelectorAll('.cine-sparkle')[i]).display !== 'none'),
          big: anims('.cine-twinkle, .cine-glitter, .cine-gold, .cine-pillar-group'),
          sweepMax: Math.max(...kf('cine-sweep')),
          sweepDur: sweep ? parseFloat(getComputedStyle(sweep).animationDuration) : 0,
        };
      });
      assert(C.layers.length === 7, `[${key}] 시네마틱 층 7개 (${C.layers})`);
      assert(C.opened.length === 3 && C.opened.every((t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'), `[${key}] 레이저가 끝까지 뻗음 (${C.opened})`);
      assert(C.small.every((n) => n !== 'none') && C.sparkle.length >= 3 && C.sparkle.every((n) => n !== 'none'), `[${key}] 폭발광·플래시·기둥·플레어 움직임`);
      assert(C.big.every((n) => (opts.viewport.width >= 640 ? n !== 'none' : n === 'none')), `[${key}] 화면 전체 반짝임은 640px 이상만 (${C.big})`);
      assert(C.sweepMax > 0 && C.sweepMax <= 0.85 && C.sweepDur >= 10, `[${key}] 아나모픽 플래시 최대 ${C.sweepMax}, ${C.sweepDur}초 주기 (광과민성 안전)`);
      for (const b of D.sparkles) {
        assert(!D.frames.some((f) => hit(b, f, 0)), `[${key}] 렌즈 플레어가 액자와 겹치지 않음`);
        assert(!hit(b, D.title, 0), `[${key}] 렌즈 플레어가 제목을 가리지 않음`);
      }

      // 데스크톱 갈라(시안 C): 별자리 선·빛 알갱이, 오로라·행성·오브제·서치라이트·별똥별·카메라 플래시
      const G = await p.evaluate(() => {
        const shown = (sel) => [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length > 0);
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY };
        };
        return {
          lines: shown('[data-constellation] line').length,
          nodes: shown('[data-constellation-node]').length,
          sparksRunning: document.getAnimations().filter((a) => a.effect?.target?.matches?.('[data-spark]') && a.playState === 'running').length,
          gala: ['gala-sky', 'gala-orbs', 'gala-lights'].map((n) => shown(`[data-decor="${n}"]`).length),
          objects: [...shown('.gala-orb'), ...shown('.gala-planet')].map(box),
          running: ['.gala-aurora', '.gala-planet', '.gala-orb', '.gala-sweep', '.gala-meteor', '.gala-flash'].map(
            (sel) => [...document.querySelectorAll(sel)].every((el) => getComputedStyle(el).animationName !== 'none'),
          ),
        };
      });
      if (desk) {
        assert(G.nodes === 5 && G.lines === 4, `[${key}] 별 마디 5개·별자리 선 4개 (${G.nodes}, ${G.lines})`);
        assert(G.sparksRunning === 4, `[${key}] 별자리 선 빛 알갱이 4개 움직임 (${G.sparksRunning})`);
        assert(G.gala.every((n) => n === 1), `[${key}] 갈라 효과 층 표시 (${G.gala})`);
        assert(G.running.every(Boolean), `[${key}] 갈라 효과 애니메이션 (${G.running})`);
        for (const o of G.objects) {
          assert(!D.frames.some((f) => hit(o, f, 4)), `[${key}] 오브제·행성이 액자와 겹치지 않음`);
          assert(!hit(o, D.title, 4), `[${key}] 오브제·행성이 제목을 가리지 않음`);
        }
      } else {
        assert(G.nodes === 0 && G.lines === 0 && G.sparksRunning === 0 && G.gala.every((n) => n === 0), `[${key}] 데스크톱 전용 효과는 숨김·정지`);
      }
      if (!desk) assert(L.footerTop === null || L.footerTop > L.lastBottom + 8, `[${key}] 처음 화면으로 버튼이 액자와 겹치지 않음 (${L.footerTop} > ${L.lastBottom})`);

      const shots = [];
      const confettiAt = [];
      for (let t = 0; t < 3; t++) {
        shots.push(await lightState(p));
        confettiAt.push(await p.evaluate(() => [...document.querySelectorAll('.stage-confetti-piece')].map((e) => getComputedStyle(e).transform).join('|')));
        await p.screenshot({ path: `${OUT}/stage-${key}-${t}.png` });
        if (t < 2) await p.waitForTimeout(2500);
      }
      const moved = (pick) => new Set(shots.map((s) => JSON.stringify(pick(s)))).size >= 2;
      // 위쪽 서치라이트 빔은 데스크톱(시안 C)에서 숨김
      if (!desk) for (let i = 0; i < 4; i++) assert(moved((s) => s.beams[i].transform), `[${key}] 빔 ${i + 1} 움직임`);
      assert(moved((s) => s.wash[0].transform), `[${key}] 가로지르는 광원 움직임`);
      assert(moved((s) => s.glow[0].opacity), `[${key}] 글로우 숨쉬기`);
      assert(moved((s) => s.particles.map((x) => x.transform + x.opacity)), `[${key}] 입자 움직임`);
      if (!desk) assert(new Set(shots[2].beams.map((b) => b.transform)).size === 4, `[${key}] 빔 4개가 서로 다른 위치`);
      assert(new Set(confettiAt).size === 3, `[${key}] 컨페티가 떨어짐`);

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
      console.log(`  ✓ [${key}] ${desk ? '데스크톱 갈라: 제목 단·별자리 물결·별자리 선·빛 알갱이·오로라·행성·오브제·플래시' : `레이아웃(${mobile ? '2열' : '한 줄'}·네모 패널 없음·겹침 없음·명패 정상), 빔4·광원·글로우·입자 움직임`}`);
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
      const rd = await p.evaluate(() => ({
        anim: document.querySelectorAll('[data-anim]').length,
        confetti: !!document.querySelector('[data-decor="confetti"]') || !!document.querySelector('.cine-sweep, [data-decor="cine-sparkles"]'),
        cine: ['cine-sky', 'cine-lasers', 'cine-horizon', 'cine-floor'].every((n) => document.querySelector(`[data-decor="${n}"]`)),
        curtains: document.querySelectorAll('.stage-curtain').length,
        floor: !!document.querySelector('[data-floor]'),
        running: document.getAnimations().filter((x) => x.playState === 'running' && x.effect?.target?.closest?.('.stage-root')).length,
      }));
      assert(rd.anim === 0 && !rd.confetti && rd.running === 0, `[${key}] reduce: 장식 움직임·컨페티 없음 (${JSON.stringify(rd)})`);
      assert(rd.curtains === 2 && rd.floor && rd.cine, `[${key}] reduce: 커튼·바닥·정지된 시네마틱 빛은 보임`);
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
    // 매 프레임 재계산이면 5초에 150회 이상(30fps 기준). 애니메이션 반복 경계에서만 생기는 수십 회는 정상
    // (작은 애니메이션 하나당 5초에 2~3회. 시네마틱 조명 추가 후 약 65~75회, main 약 35회)
    assert(report.idle5s.styleRecalcs < 100, `매 프레임 스타일 재계산 없음 (${report.idle5s.styleRecalcs}/5초)`);
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
