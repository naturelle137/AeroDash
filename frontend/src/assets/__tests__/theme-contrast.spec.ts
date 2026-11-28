import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../theme.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`, 'g')
  for (const m of css.matchAll(re)) {
    for (const d of (m[1] ?? '').matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      out[d[1] as string] = (d[2] ?? '').replace(/\/\*.*?\*\//g, '').trim()
    }
  }
  return out
}

const primitives = block(':root')
const themes = {
  light: { ...primitives, ...block('[data-theme="light"]') },
  dark: { ...primitives, ...block('[data-theme="dark"]') },
}

function resolveColor(theme: Record<string, string>, token: string): string {
  let v = theme[token]
  while (v?.startsWith('var(')) v = theme[v.slice(4, -1)]
  return v ?? ''
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

// [foreground, background, minimum ratio]
const pairs: Array<[string, string, number]> = [
  ['--color-text-primary', '--color-surface', 4.5],
  ['--color-text', '--color-surface-card', 4.5],
  ['--color-text-secondary', '--color-surface', 4.5],
  ['--color-text-secondary', '--color-surface-alt', 4.5],
  ['--color-primary', '--color-surface', 4.5],
  ['--color-primary-text', '--color-primary', 4.5],
  ['--color-on-critical', '--color-critical', 4.5],
  ['--color-on-success', '--color-success', 4.5],
  ['--color-on-warning', '--color-warning', 4.5],
  ['--color-critical', '--color-critical-bg', 4.5],
  ['--color-success', '--color-success-bg', 4.5],
  ['--color-warning', '--color-warning-bg', 4.5],
  ['--color-warning-text', '--color-surface', 4.5],
  ['--color-nav-text', '--color-nav-bg', 4.5],
  ['--color-tag-soon-text', '--color-tag-soon-bg', 4.5],
  ['--chart-tick-text', '--color-surface', 4.5],
]

describe.each(Object.keys(themes) as Array<keyof typeof themes>)('theme contrast (%s)', (name) => {
  it.each(pairs)('%s on %s >= %f:1', (fg, bg, min) => {
    const f = resolveColor(themes[name], fg)
    const b = resolveColor(themes[name], bg)
    expect(f).toMatch(/^#[0-9a-f]{6}$/i)
    expect(b).toMatch(/^#[0-9a-f]{6}$/i)
    expect(ratio(f, b)).toBeGreaterThanOrEqual(min)
  })
})
