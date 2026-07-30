// Verifies every token pair actually used for text/UI components in
// UI-DESIGN.md's Design tokens table against WCAG 2.1 AA thresholds
// (issue #86: accessibility verification pass). Values mirror
// frontend/src/index.css's `@theme` block and its dark override — if
// those change, this test's literal token values must be updated to
// match, same as any other fixture.
import { describe, expect, it } from 'vitest'
import { contrastRatio, oklchToRelativeLuminance } from './colorContrast.js'

const TOKENS = {
  light: {
    surface: [0.985, 0.004, 70],
    panel: [1, 0, 0],
    ink: [0.24, 0.01, 70],
    'ink-muted': [0.47, 0.015, 70],
    accent: [0.52, 0.11, 60],
    'accent-ink': [0.99, 0.005, 70],
    danger: [0.5, 0.19, 27],
  },
  dark: {
    surface: [0.185, 0.008, 70],
    panel: [0.23, 0.01, 70],
    ink: [0.93, 0.005, 70],
    'ink-muted': [0.7, 0.015, 70],
    accent: [0.75, 0.1, 65],
    'accent-ink': [0.17, 0.02, 65],
    danger: [0.7, 0.17, 25],
  },
}

const AA_BODY = 4.5

// [fg, bg, minimum ratio, real usage this pair covers]
const USED_PAIRS = [
  ['ink', 'surface', AA_BODY, 'body text on page background'],
  ['ink', 'panel', AA_BODY, 'body text on cards/bars/inputs'],
  ['ink-muted', 'surface', AA_BODY, 'metadata/secondary text on page background'],
  ['ink-muted', 'panel', AA_BODY, 'metadata/secondary text on cards'],
  ['accent', 'surface', AA_BODY, 'active nav text, links, citation markers on page background'],
  ['accent', 'panel', AA_BODY, 'active nav text, links, citation markers on cards'],
  ['accent-ink', 'accent', AA_BODY, 'button/pill label text on accent fills'],
  ['danger', 'surface', AA_BODY, 'error text on page background'],
  ['danger', 'panel', AA_BODY, 'error text on cards'],
  ['accent-ink', 'danger', AA_BODY, 'button label text on danger fills'],
]

function luminance(theme, name) {
  const [L, C, H] = TOKENS[theme][name]
  return oklchToRelativeLuminance(L, C, H)
}

describe('design token contrast (WCAG 2.1 AA)', () => {
  for (const theme of ['light', 'dark']) {
    for (const [fg, bg, minRatio, usage] of USED_PAIRS) {
      it(`${theme}: ${fg} on ${bg} (${usage}) >= ${minRatio}:1`, () => {
        const ratio = contrastRatio(luminance(theme, fg), luminance(theme, bg))
        expect(ratio).toBeGreaterThanOrEqual(minRatio)
      })
    }
  }
})
