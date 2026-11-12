import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../styles/index.css'), 'utf8');
const block = (re: RegExp) => css.match(re)?.[0] ?? '';

describe('갤러리 조명 CSS', () => {
  it('키프레임은 transform 만 바꿈 (레이아웃·filter 애니메이션 없음)', () => {
    for (const name of ['gallery-beam-sway', 'gallery-wash-drift']) {
      const kf = block(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n {2}\\}`));
      expect(kf, name).not.toBe('');
      const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(new Set(props), name).toEqual(new Set(['transform']));
    }
  });

  it('빔: alternate·ease-in-out, screen 블렌드, will-change 는 빔에만', () => {
    const beam = block(/\.gallery-beam \{[\s\S]*?\n {2}\}/);
    expect(beam).toMatch(/animation:\s*gallery-beam-sway[^;]*ease-in-out[^;]*infinite alternate/);
    expect(beam).toContain('mix-blend-mode: screen');
    expect(beam).toContain('will-change: transform');
    const wash = block(/\.gallery-wash \{[\s\S]*?\n {2}\}/);
    expect(wash).not.toContain('will-change');
    expect(wash).toMatch(/animation:\s*gallery-wash-drift\s+(\d+)s/);
    expect(Number(wash.match(/gallery-wash-drift\s+(\d+)s/)![1])).toBeGreaterThanOrEqual(20);
    expect(css).not.toMatch(/gallery-[a-z-]+[^{]*\{[^}]*filter:\s*blur/);
  });

  it('켜질 때 opacity 1.2초 페이드', () => {
    const lights = block(/\.gallery-lights \{[\s\S]*?\n {2}\}/);
    expect(lights).toContain('opacity: 0');
    expect(lights).toContain('transition: opacity 1.2s');
  });

  it('prefers-reduced-motion: reduce 에서는 조명 애니메이션·페이드 없음', () => {
    const reduce = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g)].map((m) => m[0]).join('\n');
    expect(reduce).toMatch(/\.gallery-beam,\s*\.gallery-wash \{\s*animation: none !important;/);
    expect(reduce).toMatch(/\.gallery-lights \{\s*transition: none !important;/);
  });
});
