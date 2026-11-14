from pathlib import Path
import subprocess,hashlib,json,zipfile
p=Path(__file__).resolve().parent.parent/'1312'; out=Path(__file__).resolve().parent; repo=Path('/var/home/critter/lokal/dev/aerodash'); rev='d27325a1aff90ac67e751db3dca0aec2d091f10a'
r={'commit':rev,'tree':subprocess.check_output(['git','-C',str(repo),'rev-parse',rev+'^{tree}'],text=True).strip()}
assert r['tree']=='d617bd969cf9a589d95654076e0a1084652ac799'
assert (p/'source-tree.txt').read_bytes()==subprocess.check_output(['git','-C',str(repo),'ls-tree','-r',rev])
assert (p/'dist-manifest.before.sha256').read_bytes()==(p/'dist-manifest.after.sha256').read_bytes()
assert not (p/'initial-status.txt').read_text().strip() and not (p/'final-status.txt').read_text().strip()
r['frozen_sources']={}
for src in ['frontend/tests/offline-production/fuel-endurance.spec.ts','frontend/tests/offline-production/fuel-print.spec.ts','frontend/playwright.offline.config.ts','frontend/package.json','pnpm-lock.yaml']:
 b=(p/'source'/Path(src).name).read_bytes(); assert b==subprocess.check_output(['git','-C',str(repo),'show',rev+':'+src]); r['frozen_sources'][src]=hashlib.sha256(b).hexdigest()
count=0
for line in (p/'artifact-manifest.sha256').read_text().splitlines():
 h,f=line.split('  ',1); assert hashlib.sha256((p/f).read_bytes()).hexdigest()==h; count+=1
r['verified_artifacts']=count
r['dist_entries']=len((p/'dist-manifest.before.sha256').read_text().splitlines())
r['sw_sha256']=hashlib.sha256((p/'source/sw.js').read_bytes()).hexdigest()
assert any(line==r['sw_sha256']+'  frontend/dist/sw.js' for line in (p/'dist-manifest.before.sha256').read_text().splitlines())
r['traces']=[]
for z in (p/'evidence/test-results').glob('*/trace.zip'):
 with zipfile.ZipFile(z) as f:
  assert f.testzip() is None
  if not any(x in str(z) for x in ('fuel-endurance','fuel-print')):continue
  events=[]
  for n in f.namelist():
   if n.endswith('.trace'):events.extend(json.loads(l) for l in f.read(n).splitlines())
  by={e.get('callId'):e for e in events if e.get('type')=='before'}
  after={e.get('callId'):e for e in events if e.get('type')=='after'}
  errors=[e for e in events if e.get('type')=='after' and e.get('error')]
  for e in errors:
   before=by[e['callId']]; parent=after[before['parentId']]
   assert before['stack'][0]['line']==311 and 'fuel-endurance' in str(z) and not parent.get('error'),(before,e)
  offline=[e for e in events if e.get('type')=='before' and e.get('method')=='setOffline']
  assert any(e['params']=={'offline':True} for e in offline)
  asserts=[e for e in events if e.get('type')=='before' and e.get('method')=='expect']
  r['traces'].append({'path':str(z.relative_to(p)),'library_errors':sum(e.get('class')!='Test' for e in [by[x['callId']] for x in errors]),'successful_poll_retries':len(errors),'offline':[e.get('params') for e in offline],'assertions':len(asserts),'events':len(events),'source_embedded_matches':any(f.read(n)==(p/'source'/('fuel-endurance.spec.ts' if 'fuel-endurance' in str(z) else 'fuel-print.spec.ts')).read_bytes() for n in f.namelist() if n.startswith('resources/src@'))})
  assert r['traces'][-1]['source_embedded_matches']
  if 'fuel-endurance' in str(z):
   for line in [499,500,503,504,512,515,527,530,533,548,554,558]:
    matched=[e for e in asserts if any(s.get('line')==line for s in e.get('stack',[]))]
    # Literal trace stack and final successful responses retained for personal inspection.
   selected=[e for e in asserts if any(s.get('line',0)>=470 for s in e.get('stack',[]))]
  else:selected=[e for e in asserts if any(s.get('line',0)>=205 for s in e.get('stack',[]))]
  (out/'tmp'/(z.parent.name+'.assertions.json')).write_text(json.dumps([{'before':e,'after':after.get(e['callId'])} for e in selected],indent=2))
(out/'independent-artifact-check.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
