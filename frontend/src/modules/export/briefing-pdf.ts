// Dependency-free PDF 1.4 writer for the Briefing Pack. It serializes the rendered print
// snapshot DOM so the file carries exactly the text the print pipeline shows.

export type PdfBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'text'; text: string; bold?: boolean }
  | { kind: 'row'; cells: string[] }
  | { kind: 'image'; index: number; width: number; height: number }

export interface PdfImage { jpeg: Uint8Array; width: number; height: number }

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 42
const CONTENT_W = PAGE_W - 2 * MARGIN
// Helvetica advance widths (1/1000 em) for ASCII 32..126; other Latin-1 glyphs use the digit width.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
const REPLACEMENTS: Record<string, string> = { '≤': '<=', '≥': '>=', '→': '->', '−': '-', '≈': '~', '’': "'", '‘': "'", '“': '"', '”': '"', ' ': ' ', ' ': ' ' }

// Latin-1 passes through unchanged; anything else is replaced visibly so no glyph is silently dropped.
export function toLatin1(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    out += REPLACEMENTS[ch] ?? (code >= 32 && code <= 255 && code !== 127 ? ch : code < 32 ? ' ' : '?')
  }
  return out
}
function charWidth(ch: string, size: number): number {
  const code = ch.charCodeAt(0)
  return ((code >= 32 && code <= 126 ? HELV[code - 32]! : 556) * size) / 1000
}
export function textWidth(text: string, size: number): number {
  let w = 0
  for (const ch of text) w += charWidth(ch, size)
  return w
}
export function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of toLatin1(text).split(/\s+/).filter(Boolean)) {
    let candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, size) <= maxWidth) { line = candidate; continue }
    if (line) lines.push(line)
    candidate = word
    // Break words longer than a line (identifiers, long numbers).
    while (textWidth(candidate, size) > maxWidth) {
      let cut = 1
      while (cut < candidate.length && textWidth(candidate.slice(0, cut + 1), size) <= maxWidth) cut++
      lines.push(candidate.slice(0, cut))
      candidate = candidate.slice(cut)
    }
    line = candidate
  }
  if (line) lines.push(line)
  return lines
}
const escapePdf = (s: string): string => s.replace(/[\\()]/g, m => `\\${m}`)

const BLOCK_TAGS = new Set(['P', 'LI', 'FIGCAPTION', 'DT', 'DD'])
// Walks the rendered snapshot and returns blocks in document order. Chart SVGs become image slots.
export function collectBlocks(root: Element): { blocks: PdfBlock[]; svgs: SVGSVGElement[] } {
  const blocks: PdfBlock[] = []
  const svgs: SVGSVGElement[] = []
  const clean = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim()
  // Nested blocks (warnings inside table cells) are separated by whitespace in print but not in textContent.
  const textOf = (el: Element): string => {
    const copy = el.cloneNode(true) as Element
    copy.querySelectorAll('p, li, div, h1, h2, h3, ul').forEach(n => n.append(' '))
    return clean(copy.textContent)
  }
  const visit = (el: Element): void => {
    if (el.matches('nav, .briefing-gate, [role="alertdialog"], button')) return
    if (el instanceof SVGSVGElement) { svgs.push(el); blocks.push({ kind: 'image', index: svgs.length - 1, width: 0, height: 0 }); return }
    if (/^H[1-3]$/.test(el.tagName)) { blocks.push({ kind: 'heading', level: Number(el.tagName[1]) as 1 | 2 | 3, text: textOf(el) }); return }
    if (el.tagName === 'TR') {
      const cells = [...el.children].map(textOf)
      if (cells.some(Boolean)) blocks.push({ kind: 'row', cells })
      return
    }
    if (BLOCK_TAGS.has(el.tagName) && !el.querySelector('ul, ol, table, p')) {
      const text = textOf(el)
      if (text) blocks.push({ kind: 'text', text, bold: !!el.querySelector('strong') && clean(el.querySelector('strong')!.textContent) === text })
      return
    }
    // Mixed container (e.g. LI with nested list): emit own text first, then children.
    if (el.tagName === 'LI') {
      const own = clean([...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE || (n as Element).tagName === 'STRONG' || (n as Element).tagName === 'CODE').map(n => n.textContent).join(' '))
      if (own) blocks.push({ kind: 'text', text: own })
    }
    for (const child of el.children) visit(child)
  }
  visit(root)
  return { blocks, svgs }
}

export function buildPdf(blocks: PdfBlock[], images: Array<PdfImage | null>, title: string): Uint8Array {
  const pages: string[][] = [[]]
  const used = new Set<number>()
  let y = PAGE_H - MARGIN
  const page = (): string[] => pages[pages.length - 1]!
  const ensure = (h: number): void => {
    if (y - h < MARGIN) { pages.push([]); y = PAGE_H - MARGIN }
  }
  const line = (text: string, x: number, size: number, bold: boolean): void => {
    page().push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`)
  }
  for (const block of blocks) {
    if (block.kind === 'heading') {
      const size = block.level === 1 ? 16 : block.level === 2 ? 12.5 : 11
      const lines = wrap(block.text, size, CONTENT_W)
      y -= block.level === 1 ? 0 : 8
      ensure(lines.length * size * 1.3 + 14)
      for (const l of lines) { y -= size * 1.25; line(l, MARGIN, size, true) }
      y -= 3
    } else if (block.kind === 'text') {
      const lines = wrap(block.text, 9.5, CONTENT_W)
      ensure(Math.min(lines.length, 3) * 12.5)
      for (const l of lines) { ensure(12.5); y -= 12; line(l, MARGIN, 9.5, !!block.bold); y -= 0.5 }
      y -= 2.5
    } else if (block.kind === 'row') {
      const colW = CONTENT_W / block.cells.length
      const wrapped = block.cells.map(c => wrap(c, 9, colW - 8))
      const rows = Math.max(1, ...wrapped.map(w => w.length))
      ensure(rows * 11.5 + 4)
      for (let r = 0; r < rows; r++) {
        y -= 11
        wrapped.forEach((cell, i) => { if (cell[r]) line(cell[r]!, MARGIN + i * colW, 9, false) })
        y -= 0.5
      }
      page().push(`0.6 G 0.5 w ${MARGIN} ${(y - 2).toFixed(2)} m ${(MARGIN + CONTENT_W).toFixed(2)} ${(y - 2).toFixed(2)} l S`)
      y -= 4
    } else {
      const img = images[block.index]
      if (!img) {
        const note = wrap('Loading envelope chart could not be embedded in this PDF; refer to the M&B results table.', 9.5, CONTENT_W)
        ensure(note.length * 12.5)
        for (const l of note) { y -= 12.5; line(l, MARGIN, 9.5, true) }
        continue
      }
      const w = CONTENT_W
      const h = (img.height / img.width) * w
      ensure(h + 6)
      used.add(block.index)
      y -= h
      page().push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${MARGIN} ${y.toFixed(2)} cm /Im${block.index} Do Q`)
      y -= 6
    }
  }
  return serialize(pages.map(p => p.join('\n')), images, used, title)
}

function serialize(streams: string[], images: Array<PdfImage | null>, used: Set<number>, title: string): Uint8Array {
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const push = (data: Uint8Array | string): void => {
    const bytes = typeof data === 'string' ? latin1Bytes(data) : data
    chunks.push(bytes); size += bytes.length
  }
  const obj = (n: number, body: string | Uint8Array[]): void => {
    offsets[n] = size
    push(`${n} 0 obj\n`)
    for (const part of Array.isArray(body) ? body : [body]) push(part)
    push('\nendobj\n')
  }
  // Object layout: 1 catalog, 2 pages, 3-4 fonts, 5 info, then image objects, then page+content pairs.
  const imageIds = new Map<number, number>()
  let next = 6
  for (const i of used) imageIds.set(i, next++)
  const pageIds = streams.map(() => { const id = next; next += 2; return id })
  push('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Count ${streams.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`)
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  obj(5, `<< /Title (${escapePdf(toLatin1(title))}) /Producer (AeroDash) >>`)
  for (const [i, id] of imageIds) {
    const img = images[i]!
    obj(id, [latin1Bytes(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`), img.jpeg, latin1Bytes('\nendstream')])
  }
  const xobjects = [...imageIds].map(([i, id]) => `/Im${i} ${id} 0 R`).join(' ')
  streams.forEach((content, i) => {
    const id = pageIds[i]!
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjects} >> >> /Contents ${id + 1} 0 R >>`)
    obj(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  const xref = size
  const count = next
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  const out = new Uint8Array(size)
  let pos = 0
  for (const c of chunks) { out.set(c, pos); pos += c.length }
  return out
}
function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline']
// Rasterizes a chart SVG to JPEG with computed styles inlined (CSS variables do not survive serialization).
export async function rasterizeSvg(svg: SVGSVGElement, scale = 2): Promise<PdfImage | null> {
  try {
    const vb = svg.viewBox.baseVal
    const width = vb.width || svg.clientWidth
    const height = vb.height || svg.clientHeight
    if (!width || !height) return null
    const clone = svg.cloneNode(true) as SVGSVGElement
    const src = [svg, ...svg.querySelectorAll('*')]
    const dst = [clone, ...clone.querySelectorAll('*')]
    src.forEach((el, i) => {
      const cs = getComputedStyle(el)
      const style = STYLE_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')
      dst[i]!.setAttribute('style', style)
    })
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('svg timeout')), 5000)
      img.onload = () => { clearTimeout(timer); resolve() }
      img.onerror = () => { clearTimeout(timer); reject(new Error('svg')) }
      img.src = url
    })
    URL.revokeObjectURL(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const data = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!)
    return { jpeg: latin1Bytes(data), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

// The chart is supplementary: if it cannot be rasterized the PDF still carries the tabular M&B data.
export async function renderBriefingPdf(root: Element, title: string): Promise<Uint8Array> {
  const { blocks, svgs } = collectBlocks(root)
  const images = await Promise.all(svgs.map(s => rasterizeSvg(s)))
  return buildPdf(blocks, images, title)
}
