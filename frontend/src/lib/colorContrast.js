// WCAG 2.1 contrast-ratio math for this app's OKLCH design tokens
// (UI-DESIGN.md's Design tokens table). OKLCH lightness doesn't map
// linearly to WCAG relative luminance, so the check needs a real
// OKLCH -> linear sRGB conversion (Björn Ottosson's OKLab matrices),
// not a shortcut off the L channel.
export function oklchToRelativeLuminance(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  const clamp = (x) => Math.max(0, Math.min(1, x))
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl)
}

export function contrastRatio(luminanceA, luminanceB) {
  const hi = Math.max(luminanceA, luminanceB)
  const lo = Math.min(luminanceA, luminanceB)
  return (hi + 0.05) / (lo + 0.05)
}
