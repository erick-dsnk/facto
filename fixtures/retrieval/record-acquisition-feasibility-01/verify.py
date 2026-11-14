"""Portable offline byte/accounting checks. Does not import runners, contact providers, or require originals."""
from pathlib import Path
import argparse,hashlib,json,datetime,gzip
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--originals',action='store_true');args=parser.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def check(path,row):
 b=path if isinstance(path,bytes)else path.read_bytes();assert len(b)==row['bytes'],str(path)[:100];assert sha(b)==row['sha256'],str(path)[:100]
def local(rel):
 p=(ROOT/rel).resolve();assert p.is_relative_to(ROOT)and p.is_file(),rel;return p
mapping=json.loads((ROOT/'source-map.json').read_text())['files'];by_original={r['originalPath']:r for r in mapping}
assert len(by_original)==len(mapping)
for row in mapping:
 stored=local(row['archivedPath']).read_bytes();assert len(stored)==row['archivedBytes']and sha(stored)==row['archivedSHA256'];check(gzip.decompress(stored)if row['encoding']=='gzip'else stored,row)
 if args.originals:check(Path(row['originalPath']),row)
def original(p):
 assert p in by_original,'Unmapped original: '+p;row=by_original[p];b=local(row['archivedPath']).read_bytes();return gzip.decompress(b)if row['encoding']=='gzip'else b
def joriginal(p):return json.loads(original(p))
embedded_entries=0
for row in mapping:
 p=local(row['archivedPath'])
 if p.name.lower()!='manifest.json':continue
 d=json.loads(original(row['originalPath']))
 for nested in d.get('files',[]):
  if not isinstance(nested,dict)or not all(k in nested for k in ['path','bytes','sha256']):continue
  source=nested['path']if Path(nested['path']).is_absolute()else str(Path(row['originalPath']).parent/nested['path']);check(original(source),nested);embedded_entries+=1
 for nested in d.get('artifacts',[]):
  if not all(k in nested for k in ['file','bytes','sha256']):continue
  source=str(Path(row['originalPath']).parent/nested['file']);check(original(source),nested);embedded_entries+=1
plan=joriginal('/workspace/task-evidence/record-acquisition-feasibility-plan-01/plan.json')
assert sha(original(plan['queriesPath']))==plan['queriesSHA256']
assert sha(original(plan['registeredUnitsPath']))==plan['registeredUnitsSHA256']
for pin in plan['sourcePins']:check(original(pin['path']),pin)
registry=joriginal(plan['registeredUnitsPath'])
assert sha(original(registry['installedManifestPath']))==registry['installedManifestSHA256']
for family in registry['families']:
 for pathfield,hashfield in [('receiptPath','receiptSHA256'),('rawBodyPath','rawBodySHA256'),('extractionPath','extractionSHA256')]:assert sha(original(family[pathfield]))==family[hashfield]
 extraction=original(family['extractionPath']).decode().encode('utf-16-le')
 for unit in family['units']:
  content=extraction[unit['start']*2:unit['end']*2].decode('utf-16-le');assert content==unit['exactContent'];assert sha(content.encode())==unit['contentSHA256']
  assert unit['materialSpans']==[{'start':0,'end':unit['utf16Length'],'role':'entire_audited_record_unit'}]
report=json.loads((ROOT/'live/report.json').read_text());attempts=report['attempts'];totals=report['totals']
assert report['completed']and report['status']=='completed'and report['fatal']is None
assert len(report['cases'])==4 and all(c['status']=='returned'for c in report['cases'])
assert totals['search']==4 and totals['contents']==5 and totals['jevCalls']==0 and totals['networkCalls']==9
assert all(a['dispatched']and a['settled']and a['bodyComplete']and a['bodyCleanup']=='drained'and a['status']==200 for a in attempts)
assert sum(a['requestBytes']for a in attempts)==totals['requestBytes']==6426
assert sum(a['responseBytes']for a in attempts)==totals['responseBytes']==121753
assert totals['pendingDispatchReservations']==totals['attemptsWithUnknownCost']==0
assert abs(sum(a['costUSD']for a in attempts)-totals['totalCostUSD'])<1e-12 and abs(totals['totalCostUSD']-.038)<1e-12
for attempt in attempts:
 for filename,hashname,bytename in [('requestFile','requestSHA256','requestBytes'),('responseFile','responseSHA256','storedResponseBytes')]:
  b=(ROOT/'live'/attempt[filename]).read_bytes();assert sha(b)==attempt[hashname]and len(b)==attempt[bytename]
for case in report['cases']:
 assert case['elapsedMs']<=10000 and len(case['evidence'])<=6 and all(len(e['excerpt'])<=2000 for e in case['evidence'])
 counts={}
 for e in case['evidence']:counts[e['sourceGroup']]=counts.get(e['sourceGroup'],0)+1
 assert max(counts.values(),default=0)<=2
journal=[json.loads(x)for x in (ROOT/'live/journal.jsonl').read_text().splitlines()]
assert len([e for e in journal if e['phase']=='dispatch_reserved'])==len(attempts)==9
assert len([e for e in journal if e['phase']=='settled_or_unknown'])==9
for attempt in attempts:
 reserve=next(i for i,e in enumerate(journal)if e['phase']=='dispatch_reserved'and e['attempt']['id']==attempt['id'])
 settle=next(i for i,e in enumerate(journal)if e['phase']=='settled_or_unknown'and e['attempt']['id']==attempt['id']);assert reserve<settle
analysis=json.loads((ROOT/'analysis/results/analysis.json').read_text());reconciliation=json.loads((ROOT/'analysis/results/reconciliation.json').read_text())
assert analysis['denominator']==4 and analysis['primaryCompletedAcquisitionMatches']==0
assert len(analysis['families'])==4 and all(not f['primaryCompletedAcquisitionMatch']for f in analysis['families'])
assert sum(len(u['rawFullUnitPresence'])for f in analysis['families']for u in f['units'])==3
assert reconciliation['captureManifestFilesVerified']==21 and reconciliation['uniqueReservationAndSettlementPairs']==9
assert reconciliation['resourceCounts']=={'attempts':9,'search':4,'contents':5,'jev':0,'requestBytes':6426,'observedResponseBytes':121753,'storedResponseBytes':121753,'pending':0,'returnedCostUSD':.038,'missingCostFields':0}
# The historical live freeze's pending-analysis text is preserved; final summary is a separate later artifact.
manifest=ROOT/'MANIFEST.json'
if manifest.exists():
 rows=json.loads(manifest.read_text())['files']
 for row in rows:check(local(row['path']),row)
 print(json.dumps({'verified':True,'archiveFiles':len(rows),'originalCopies':len(mapping),'embeddedManifestEntries':embedded_entries,'originalsChecked':args.originals,'networkCalls':0,'providerCalls':0,'runnersExecuted':0}))
else:print(json.dumps({'verifiedPreparation':True,'originalCopies':len(mapping),'embeddedManifestEntries':embedded_entries,'originalsChecked':args.originals,'networkCalls':0,'providerCalls':0,'runnersExecuted':0,'finalManifestPending':True}))
