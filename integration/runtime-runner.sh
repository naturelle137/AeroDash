#!/usr/bin/env bash
# Invoke only in an HQ-managed shell worktree at the accepted merge commit.
set -euo pipefail
expected_commit=${1:?merged commit required}
expected_tree=${2:?merged tree required}
stage=identity
finish() {
  rc=$?
  trap - EXIT
  mkdir -p "$HQ_JOB_DIR/evidence"
  if [ -d frontend/test-results ]; then cp -a frontend/test-results "$HQ_JOB_DIR/evidence/"; fi
  if [ -d frontend/playwright-report/offline ]; then cp -a frontend/playwright-report/offline "$HQ_JOB_DIR/evidence/report"; fi
  python3 - "$rc" "$stage" <<'PY'
import hashlib,json,os,sys
from pathlib import Path
p=Path(os.environ['HQ_JOB_DIR'])
rows=[]
for f in sorted((p/'evidence').rglob('*')):
    if f.is_file():
        rows.append(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(p)}')
(p/'artifact-manifest.sha256').write_text('\n'.join(rows)+'\n')
rc=int(sys.argv[1])
(p/'result.json').write_text(json.dumps({
    'status':'done' if rc==0 else 'failed',
    'summary':f'Merged530 production offline execution exit {rc}; stage {sys.argv[2]}. Actual logs, source/build identity and artifacts retained. Execution is not personal product acceptance.',
    'pr':'https://github.com/naturelle137/AeroDash/pull/532',
    'next':'Dependent terminal PLAN inspects actual source/tree/dist/SW, traces and screenshots 390/1440 and owns every outcome; close 530 only after acceptance.',
    'reply':None},indent=2)+'\n')
PY
  exit "$rc"
}
trap finish EXIT
[ "$(git rev-parse HEAD)" = "$expected_commit" ]
[ "$(git rev-parse 'HEAD^{tree}')" = "$expected_tree" ]
git status --porcelain > "$HQ_JOB_DIR/initial-status.txt"
[ ! -s "$HQ_JOB_DIR/initial-status.txt" ]
git show -s --format=fuller HEAD > "$HQ_JOB_DIR/source-identity.txt"
git ls-tree -r HEAD > "$HQ_JOB_DIR/source-tree.txt"
mkdir -p "$HQ_JOB_DIR/source"
for source_path in frontend/tests/offline-production/lookup-fuel-mb.spec.ts frontend/tests/offline-production/fuel-endurance.spec.ts frontend/tests/offline-production/fuel-print.spec.ts frontend/playwright.offline.config.ts frontend/package.json pnpm-lock.yaml; do
  cp "$source_path" "$HQ_JOB_DIR/source/$(basename "$source_path")"
done
stage=frozen-install
timeout 600 pnpm install --frozen-lockfile > "$HQ_JOB_DIR/install.log" 2>&1
stage=production-build
timeout 1200 pnpm build > "$HQ_JOB_DIR/build.log" 2>&1
find frontend/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$HQ_JOB_DIR/dist-manifest.before.sha256"
sha256sum frontend/dist/sw.js "$HQ_JOB_DIR/dist-manifest.before.sha256" > "$HQ_JOB_DIR/build-hashes.txt"
cp frontend/dist/sw.js "$HQ_JOB_DIR/source/sw.js"
stage=cached-offline-390-1440
CI=1 timeout 2400 pnpm --filter frontend test:offline > "$HQ_JOB_DIR/offline.log" 2>&1
stage=final-identity
find frontend/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$HQ_JOB_DIR/dist-manifest.after.sha256"
cmp "$HQ_JOB_DIR/dist-manifest.before.sha256" "$HQ_JOB_DIR/dist-manifest.after.sha256"
[ "$(git rev-parse HEAD)" = "$expected_commit" ]
[ "$(git rev-parse 'HEAD^{tree}')" = "$expected_tree" ]
git status --porcelain > "$HQ_JOB_DIR/final-status.txt"
[ ! -s "$HQ_JOB_DIR/final-status.txt" ]
stage=complete
