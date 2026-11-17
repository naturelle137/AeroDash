import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runAudit } from './pnpm-audit.mjs';

const expiry = Date.parse('2026-11-24T00:00:00Z');
const cve = 'CVE-2026-112366';
const fakeAudit = `
  const args = process.argv.slice(1);
  const advisories = JSON.parse(process.env.ADVISORIES);
  const ignored = process.env.IGNORED;
  const threshold = args.includes('--audit-level=moderate') ? 2 : 3;
  process.exit(advisories.some(a => a.cve !== ignored && a.severity >= threshold) ? 1 : 0);
`;

function auditAt(timestamp, advisories, level = 'high') {
  return runAudit(level, {
    now: () => timestamp,
    spawn(command, args, options) {
      assert.equal(command, 'pnpm');
      assert.equal(options.stdio, 'inherit');
      assert.deepEqual(args.slice(0, 2), ['audit', `--audit-level=${level}`]);
      let ignored;
      if (timestamp < expiry) {
        assert.equal(args.length, 4);
        assert.equal(args[2], '--dir');
        assert.equal(readFileSync(join(args[3], 'pnpm-lock.yaml'), 'utf8'), readFileSync('pnpm-lock.yaml', 'utf8'));
        const config = JSON.parse(readFileSync(join(args[3], 'package.json'), 'utf8'));
        assert.deepEqual(config.pnpm, { auditConfig: { ignoreCves: [cve] } });
        ignored = config.pnpm.auditConfig.ignoreCves[0];
      } else {
        assert.equal(args.length, 2);
      }
      return spawnSync(process.execPath, ['-e', fakeAudit, '--', ...args], {
        env: { ...process.env, ADVISORIES: JSON.stringify(advisories), IGNORED: ignored },
      });
    },
  });
}

const accepted = [{ cve, severity: 3 }];

test('same advisory passes before expiry, fails at exact boundary and after', () => {
  assert.equal(auditAt(expiry - 1, accepted), 0);
  assert.equal(auditAt(expiry, accepted), 1);
  assert.equal(auditAt(expiry + 1, accepted), 1);
});

test('unrelated high and critical findings fail during exception', () => {
  for (const severity of [3, 4]) {
    assert.equal(auditAt(expiry - 1, [...accepted, { cve: 'CVE-OTHER', severity }]), 1);
  }
});

test('weekly moderate and ordinary high thresholds remain distinct', () => {
  const advisories = [...accepted, { cve: 'CVE-OTHER', severity: 2 }];
  assert.equal(auditAt(expiry - 1, advisories, 'moderate'), 1);
  assert.equal(auditAt(expiry - 1, advisories, 'high'), 0);
});

test('clean audit passes after expiry without ignore', () => {
  assert.equal(auditAt(expiry, []), 0);
});

test('registry or process failure status is preserved before and after expiry', () => {
  for (const timestamp of [expiry - 1, expiry]) {
    for (const status of [1, 7, 42]) {
      assert.equal(runAudit('high', {
        now: () => timestamp,
        spawn: () => spawnSync(process.execPath, ['-e', `process.exit(${status})`]),
      }), status);
    }
  }
});

test('spawn errors and signals fail closed', () => {
  assert.throws(() => runAudit('high', {
    spawn: () => ({ error: new Error('spawn ENOENT'), status: null }),
  }), /ENOENT/);
  assert.equal(runAudit('high', { spawn: () => ({ status: null, signal: 'SIGTERM' }) }), 1);
  const result = spawnSync(process.execPath, ['scripts/security/pnpm-audit.mjs', 'high'], {
    env: { ...process.env, PATH: '' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr.toString(), /ENOENT/);
});

test('invalid clock or level cannot invoke audit', () => {
  const spawn = () => assert.fail('must not spawn');
  for (const timestamp of [NaN, Infinity, undefined]) {
    assert.throws(() => runAudit('high', { now: () => timestamp, spawn }), /clock/);
  }
  assert.throws(() => runAudit('high --ignore-unfixable', { spawn }), /level/);
});

test('temporary configuration is cleaned on errors; project files stay identical', () => {
  const before = ['package.json', 'pnpm-lock.yaml'].map(p => readFileSync(p, 'utf8'));
  let directory;
  assert.throws(() => runAudit('high', {
    now: () => expiry - 1,
    spawn(command, args) { directory = args[3]; throw new Error('test failure'); },
  }), /test failure/);
  assert.equal(existsSync(directory), false);
  assert.deepEqual(['package.json', 'pnpm-lock.yaml'].map(p => readFileSync(p, 'utf8')), before);
});
