// Derives web icons from the original artwork in assets/ using Chromium's
// canvas (no image dependency). Run: node frontend/scripts/generate-brand-assets.mjs
// Originals are never modified; outputs land in frontend/public/.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const src = (f) => readFileSync(resolve(root, 'assets', f)).toString('base64')
const out = resolve(root, 'frontend/public')
mkdirSync(resolve(out, 'brand'), { recursive: true })

const inputs = {
  logoLight: src('logo-light.PNG'),
  logoDark: src('logo-dark.png'),
  iconLight: src('favicon-light.PNG'),
  iconDark: src('favicon-dark.png'),
}

const browser = await chromium.launch()
const page = await browser.newPage()
const result = await page.evaluate(async (inputs) => {
  const load = (b64) =>
    new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = 'data:image/png;base64,' + b64
    })
  const toCanvas = (img, w = img.width, h = img.height) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, w, h)
    return c
  }
  const png = (c) => c.toDataURL('image/png').split(',')[1]
  // Bounding box of pixels that differ from the corner (background) colour.
  const bbox = (img, tol) => {
    const c = toCanvas(img)
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    const bg = [data[0], data[1], data[2]]
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4
        const d = Math.abs(data[k] - bg[0]) + Math.abs(data[k + 1] - bg[1]) + Math.abs(data[k + 2] - bg[2])
        if (d > tol) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
        }
      }
    return { x0, y0, x1, y1 }
  }
  // Trim to content plus a margin, keeping aspect ratio and original pixels.
  const trim = (img, tol, marginRatio) => {
    const b = bbox(img, tol)
    const m = Math.round((b.x1 - b.x0) * marginRatio)
    const x = Math.max(0, b.x0 - m), y = Math.max(0, b.y0 - m)
    const w = Math.min(img.width, b.x1 + m) - x, h = Math.min(img.height, b.y1 + m) - y
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h)
    return c
  }
  const sq = (img, size) => toCanvas(img, size, size)

  const [logoLight, logoDark, iconLight, iconDark] = await Promise.all([
    load(inputs.logoLight), load(inputs.logoDark), load(inputs.iconLight), load(inputs.iconDark),
  ])
  return {
    'brand/logo-light.png': png(trim(logoLight, 60, 0.02)),
    'brand/logo-dark.png': png(trim(logoDark, 90, 0.02)),
    'brand/icon-light.png': png(trim(iconLight, 60, 0.03)),
    'brand/icon-dark.png': png(trim(iconDark, 90, 0.03)),
    'favicon-light.png': png(sq(iconLight, 96)),
    'favicon-dark.png': png(sq(iconDark, 96)),
    'favicon-16.png': png(sq(iconLight, 16)),
    'favicon-32.png': png(sq(iconLight, 32)),
    'favicon-48.png': png(sq(iconLight, 48)),
    // iOS fills transparency with black, so the full-bleed dark artwork is used.
    'apple-touch-icon.png': png(sq(iconDark, 180)),
    'pwa-192x192.png': png(sq(iconDark, 192)),
    'pwa-512x512.png': png(sq(iconDark, 512)),
  }
}, inputs)
await browser.close()

for (const [name, b64] of Object.entries(result)) if (!/favicon-(16|48)\.png/.test(name)) writeFileSync(resolve(out, name), Buffer.from(b64, 'base64'))

// PNG-embedded ICO (16/32/48), supported by all current browsers.
const frames = [16, 32, 48].map((s) => ({ s, buf: Buffer.from(result[`favicon-${s}.png`], 'base64') }))
const head = Buffer.alloc(6 + 16 * frames.length)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(frames.length, 4)
let offset = head.length
frames.forEach((f, i) => {
  const o = 6 + i * 16
  head[o] = f.s; head[o + 1] = f.s
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6)
  head.writeUInt32LE(f.buf.length, o + 8); head.writeUInt32LE(offset, o + 12)
  offset += f.buf.length
})
writeFileSync(resolve(out, 'favicon.ico'), Buffer.concat([head, ...frames.map((f) => f.buf)]))
