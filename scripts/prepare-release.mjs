import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const match = /^(?:release|hotfix)\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(branch);
if (!match || match[4]?.split('.').some((part) => /^0\d+$/.test(part))) {
  throw new Error('Expected a release/v<semver> or hotfix/v<semver> branch without build metadata');
}
const version = branch.slice(branch.indexOf('/v') + 2);
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
manifest.version = version;
writeFileSync('package.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared package.json for v${version}`);
