import disclaimerMarkdown from '../../../../DISCLAIMER.md?raw'

export interface DisclaimerBlock { kind: 'heading' | 'text'; text: string }

// Flattens DISCLAIMER.md to plain blocks so the Briefing Pack carries the full legal text (print and PDF).
export function disclaimerBlocks(markdown: string = disclaimerMarkdown): DisclaimerBlock[] {
  const blocks: DisclaimerBlock[] = []
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line === '---' || line.startsWith('<a ') || line.startsWith('[[')) continue
    const heading = /^#{2,3}\s+(.*)$/.exec(line)
    const text = (heading ? heading[1]! : line)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|`/g, '')
      .replace(/^[\p{Regional_Indicator}\p{Extended_Pictographic}]+\s*/u, '')
      .trim()
    if (/^#\s/.test(line) || !text) continue
    blocks.push({ kind: heading ? 'heading' : 'text', text })
  }
  return blocks
}
