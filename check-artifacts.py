from pathlib import Path
import subprocess,hashlib,json,zipfile,re
out=Path(__file__).resolve().parent;p=out.parent/'1367';repo='/var/home/critter/lokal/dev/aerodash';rev='9e4109e24a58712e23a12366e6d4824c2db945dd'
def git(*a):return subprocess.check_output(['git','-C',repo,*a])
r={'commit':rev,'tree':git('rev-parse',rev+'^{tree}').decode().strip()}
assert r['tree']=='e48ba39caf5417e2e40b233f84c991d18bd8b7e8'
assert (p/'source-tree.txt').read_bytes()==git('ls-tree','-r',rev)
assert rev in (p/'source-identity.txt').read_text()
assert (p/'dist-manifest.before.sha256').read_bytes()==(p/'dist-manifest.after.sha256').read_bytes()
assert not (p/'initial-status.txt').read_text().strip() and not (p/'final-status.txt').read_text().strip()
r['sources']={}
for src in ['frontend/tests/offline-production/'+f for f in ['lookup-fuel-mb.spec.ts','fuel-endurance.spec.ts','fuel-print.spec.ts']]+['frontend/playwright.offline.config.ts','frontend/package.json','pnpm-lock.yaml']:
 b=(p/'source'/Path(src).name).read_bytes();assert b==git('show',rev+':'+src);r['sources'][src]=hashlib.sha256(b).hexdigest()
r['artifacts']=0
for l in (p/'artifact-manifest.sha256').read_text().splitlines():
 h,f=l.split('  ',1);assert hashlib.sha256((p/f).read_bytes()).hexdigest()==h,f;r['artifacts']+=1
r['sw_sha256']=hashlib.sha256((p/'source/sw.js').read_bytes()).hexdigest()
assert r['sw_sha256']+'  frontend/dist/sw.js' in (p/'dist-manifest.before.sha256').read_text()
log=(p/'offline.log').read_text();assert '24 passed' in log and len(re.findall(r'✓\s+\d+ \[chromium-',log))==24 and 'skipped' not in log
assert len(re.findall(r'✓.*lookup-fuel-mb.spec.ts',log))==2
r['traces']=[]
for z in sorted((p/'evidence/test-results').glob('*/trace.zip')):
 with zipfile.ZipFile(z) as f:
  assert f.testzip() is None
  ev=[json.loads(l) for n in f.namelist() if n.endswith('.trace') for l in f.read(n).splitlines()]
  before={e['callId']:e for e in ev if e['type']=='before'};after={e['callId']:e for e in ev if e['type']=='after'}
  errors=[e for e in after.values() if e.get('error')]
  r['traces'].append({'name':z.parent.name,'errors':len(errors)})
  if z.parent.name.startswith(('lookup-fuel','fuel-endurance','fuel-print')):
   src='lookup-fuel-mb.spec.ts' if z.parent.name.startswith('lookup-fuel') else ('fuel-endurance.spec.ts' if z.parent.name.startswith('fuel-endurance') else 'fuel-print.spec.ts')
   assert any(f.read(n)==(p/'source'/src).read_bytes() for n in f.namelist() if n.startswith('resources/src@'))
   assert any(e.get('method')=='setOffline' and e.get('params')=={'offline':True} for e in before.values())
   rows=[{'line':e.get('stack',[{}])[0].get('line'),'params':e.get('params'),'after':after.get(e['callId'])} for e in before.values() if e.get('method')=='expect']
   (out/'tmp'/(z.parent.name+'.assertions.json')).write_text(json.dumps(rows,indent=2))
   if src=='lookup-fuel-mb.spec.ts':
    for e in errors:
     b=before[e['callId']]; assert b['stack'][0]['line']==279 and not after[b['parentId']].get('error')
    assert len(rows)>60
assert len(r['traces'])==24
(out/'independent-artifact-check.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
