import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const expiresAt = Date.parse('2026-11-24T00:00:00Z');

export function runAudit(level, { now = Date.now, spawn = spawnSync } = {}) {
  if (level !== 'high' && level !== 'moderate') {
    throw new Error('Expected audit level: high or moderate');
  }
  const timestamp = now();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid audit clock');

  const args = ['audit', `--audit-level=${level}`];
  let directory;
  try {
    if (timestamp < expiresAt) {
      console.error('Temporary CVE-2026-112366 exception; expires 2026-11-24T00:00:00Z');
      // pnpm --ignore persists configuration and returns success before checking other advisories.
      // Audit an identical lockfile with isolated, temporary configuration instead.
      directory = mkdtempSync(join(tmpdir(), 'aerodash-audit-'));
      copyFileSync('pnpm-lock.yaml', join(directory, 'pnpm-lock.yaml'));
      const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
      manifest.pnpm = { auditConfig: { ignoreCves: ['CVE-2026-112366'] } };
      writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
      args.push('--dir', directory);
    }
    const result = spawn('pnpm', args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error('Expected one audit level');
  process.exitCode = runAudit(process.argv[2]);
}
