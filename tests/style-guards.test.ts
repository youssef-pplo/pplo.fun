import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const projection = readFileSync(new URL('../src/scene/projection.ts', import.meta.url), 'utf8');

const luminance = (hex: string): number => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (foreground: string, background: string): number => {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

describe('typography and colour guards', () => {
  it('never declares text smaller than 9px in the stylesheet or in projected labels', () => {
    const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g), ...projection.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(50);
    expect(sizes.filter((size) => size < 9)).toEqual([]);
  });

  it('keeps every muted text colour at WCAG AA (4.5:1) on the ink background', () => {
    const tokens = [...css.matchAll(/(?:--quiet|--muted):\s*#([0-9a-f]{6})/gi)].map((m) => m[1]);
    const inline = [...css.matchAll(/(?<![-\w])color:\s*#([0-9a-f]{6})/gi)].map((m) => m[1]);
    expect(tokens).toHaveLength(2);
    for (const hex of new Set([...tokens, ...inline])) {
      // Dark ink and dark-on-lime button text intentionally use dark foregrounds.
      if (luminance(hex) < 0.05) continue;
      expect(contrast(hex, '080b0c'), `#${hex}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
