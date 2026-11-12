import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../styles/index.css'), 'utf8');
const block = (re: RegExp) => css.match(re)?.[0] ?? '';
const rule = (sel: string) => block(new RegExp(`\\${sel} \\{[\\s\\S]*?\\n {2}\\}`));

describe('갤러리 무대 조명 CSS', () => {
  it('모든 키프레임은 transform·opacity 만 바꿈 (레이아웃·filter 애니메이션 없음)', () => {
    for (const name of ['gallery-breathe', 'gallery-beam-sway', 'gallery-wash-drift', 'gallery-drift-up', 'gallery-twinkle', 'gallery-flash']) {
      const kf = block(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n {2}\\}\\n`));
      expect(kf, name).not.toBe('');
      const props = new Set([...kf.matchAll(/\n\s+([a-z-]+)\s*:/g)].map((m) => m[1]));
      for (const p of props) expect(['transform', 'opacity'], `${name}: ${p}`).toContain(p);
    }
    expect(css).not.toMatch(/\.gallery-[a-z-]+[^{]*\{[^}]*filter:/);
  });

  it('숨 쉬는 글로우: opacity 0.7↔1, 8초 주기(4초 alternate)', () => {
    expect(block(/@keyframes gallery-breathe \{[\s\S]*?\n {2}\}\n/)).toMatch(/opacity: 0\.7;[\s\S]*opacity: 1;/);
    expect(rule('.gallery-glow')).toMatch(/gallery-breathe 4s ease-in-out infinite alternate/);
  });

  it('빔·광원·입자만 will-change, 빔은 alternate, 블렌드 모드 없음(저사양 성능)', () => {
    expect(rule('.gallery-beam')).toContain('will-change: transform');
    for (const sel of ['.gallery-beam', '.gallery-wash', '.gallery-glow', '.gallery-flash', '.gallery-dots', '.gallery-star'])
      expect(rule(sel), sel).not.toContain('mix-blend-mode');
    expect(rule('.gallery-dots')).toContain('will-change: transform, opacity');
    expect(rule('.gallery-star')).toContain('will-change: transform, opacity');
    expect(rule('.gallery-beam')).toMatch(/infinite alternate/);
    expect(rule('.gallery-wash')).toContain('will-change: transform');
    expect(rule('.gallery-glow')).not.toContain('will-change');
    expect(rule('.gallery-flash')).not.toContain('will-change');
    const wash = rule('.gallery-wash').match(/gallery-wash-drift (\d+)s/);
    expect(Number(wash![1])).toBeGreaterThanOrEqual(20);
  });

  it('카메라 플래시: 12~20초에 한 번, 최대 0.10, 0.3초 이내 (광과민성 안전)', () => {
    const period = Number(rule('.gallery-flash').match(/gallery-flash (\d+(?:\.\d+)?)s/)![1]);
    expect(period).toBeGreaterThanOrEqual(12);
    expect(period).toBeLessThanOrEqual(20);
    const kf = block(/@keyframes gallery-flash \{[\s\S]*?\n {2}\}\n/);
    const peaks = [...kf.matchAll(/opacity: ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.1);
    const stops = [...kf.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
    const visible = (Math.max(...stops.filter((p) => p < 100)) - Math.min(...stops.filter((p) => p > 0))) / 100 * period;
    expect(visible).toBeLessThanOrEqual(0.3);
    expect(1 / period).toBeLessThan(3); // 초당 3회 미만
  });

  it('켜질 때 opacity 1.2초 페이드', () => {
    expect(rule('.gallery-lights')).toContain('opacity: 0');
    expect(rule('.gallery-lights')).toContain('transition: opacity 1.2s');
  });

  it('prefers-reduced-motion: 움직임·입자·플래시·페이드 없음', () => {
    const reduce = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g)].map((m) => m[0]).join('\n');
    expect(reduce).toMatch(/\.gallery-beam,\s*\.gallery-wash,\s*\.gallery-glow \{\s*animation: none !important;/);
    expect(reduce).toMatch(/\.gallery-particles,\s*\.gallery-flash \{\s*display: none !important;/);
    expect(reduce).toMatch(/\.gallery-lights \{\s*transition: none !important;/);
  });
});
