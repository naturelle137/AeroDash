import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/prepare-release.mjs');
for (const [branch, expected] of [
  ['release/v0.4.0-alpha.1', '0.4.0-alpha.1'],
  ['hotfix/v1.2.3', '1.2.3'],
  ['release/v0.4.0-rc.01', null],
  ['release/v01.2.3', null],
  ['feature/v1.2.3', null],
]) {
  test(branch, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'aerodash-release-'));
    try {
      execFileSync('git', ['init', '-q', '-b', branch], { cwd });
      writeFileSync(join(cwd, 'package.json'), '{"name":"test","version":"0.3.0-alpha"}\n');
      const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
      assert.equal(result.status, expected ? 0 : 1, result.stderr);
      assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'))).version, expected ?? '0.3.0-alpha');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('publisher requires curated notes before creating a tag', () => {
  const workflow = readFileSync('.github/workflows/publish-release.yml', 'utf8');
  const notesStep = workflow.match(/      - name: Resolve release notes\n[\s\S]*?        run: \|\n((?:          .*\n)+)/)?.[1];
  assert.ok(notesStep);
  assert.ok(workflow.indexOf('- name: Resolve release notes') < workflow.indexOf('- name: Create and push tag'));
  assert.doesNotMatch(workflow, /--generate-notes/);
  const command = notesStep.replaceAll('${{ steps.version.outputs.version }}', '1.2.3');
  const cwd = mkdtempSync(join(tmpdir(), 'aerodash-notes-'));
  try {
    const env = { ...process.env, GITHUB_OUTPUT: join(cwd, 'output') };
    assert.notEqual(spawnSync('bash', ['-e', '-c', command], { cwd, env }).status, 0);
    execFileSync('mkdir', ['-p', '.github/release-notes'], { cwd });
    writeFileSync(join(cwd, '.github/release-notes/v1.2.3.md'), 'Curated notes\n');
    assert.equal(spawnSync('bash', ['-e', '-c', command], { cwd, env }).status, 0);
    assert.match(readFileSync(join(cwd, 'output'), 'utf8'), /v1\.2\.3\.md/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
