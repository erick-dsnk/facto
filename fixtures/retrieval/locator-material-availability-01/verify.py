"""Standard-library portable verifier; no original-workspace reads or archived code execution."""
import argparse,pathlib,json,hashlib,gzip,io
p=argparse.ArgumentParser();p.add_argument('--shared-archive',required=True);args=p.parse_args();R=pathlib.Path(__file__).resolve().parent;S=pathlib.Path(args.shared_archive).resolve();h=lambda b:hashlib.sha256(b).hexdigest()
def safe(root,relative):
 rel=pathlib.PurePosixPath(relative);assert not rel.is_absolute()and'..'not in rel.parts
 result=root.joinpath(*rel.parts)
 for x in [result]+list(result.parents):
  if x==root.parent:break
  assert not x.is_symlink(),str(x)
 assert result.is_file()and result.resolve().is_relative_to(root)
 return result
def read(root,relative,maxbytes=2*1024*1024):
 q=safe(root,relative);assert q.stat().st_size<=maxbytes
 return q.read_bytes()
def decode(raw,encoding,size):
 assert isinstance(size,int)and 0<=size<=2*1024*1024
 if encoding=='gzip':
  with gzip.GzipFile(fileobj=io.BytesIO(raw))as f:out=f.read(size+1)
 else:assert encoding=='identity';out=raw
 assert len(out)==size
 return out
m=json.loads(read(R,'MANIFEST.json'));declared=set(m['files'])|{'MANIFEST.json'};actual={str(q.relative_to(R))for q in R.rglob('*')if q.is_file()};assert actual==declared
for name,pin in m['files'].items():assert h(read(R,name))==pin,name
mapping=json.loads(read(R,'original-path-map.json'));ref=mapping['sharedArchive'];smRaw=read(S,'source-map.json');sharedRaw=read(S,'MANIFEST.json');assert h(sharedRaw)==ref['manifestSHA256'];assert h(smRaw)==ref['sourceMapSHA256'];shared=json.loads(sharedRaw);assert shared['sourceMapSHA256']==h(smRaw)
sharedFiles={e['path']:e for e in shared['files']};sharedMap=json.loads(smRaw)['files'];cache={};original={};rawtotal=0
for e in mapping['files']:
 if e['resolution']=='new-archive-payload':
  raw=read(R,e['payload']);assert len(raw)==e['encodedBytes']and h(raw)==e['encodedSHA256'];body=decode(raw,e['encoding'],e['bytes'])
 else:
  path=e['sharedArchiveRelativePath'];raw=read(S,path);assert len(raw)==e['sharedEncodedBytes']and h(raw)==e['sharedEncodedSHA256'];entry=sharedFiles[path];assert entry['bytes']==len(raw)and entry['sha256']==h(raw)
  assert any(x['archivedPath']==path and x['sha256']==e['sha256']and x['bytes']==e['bytes']and x['archivedSHA256']==h(raw)for x in sharedMap)
  body=decode(raw,e['sharedEncoding'],e['bytes'])
 assert h(body)==e['sha256'];original[e['originalPath']]=body;rawtotal+=len(body);assert rawtotal<=16*1024*1024
load=lambda path:json.loads(original[path]);base='/workspace/task-evidence/locator-material-availability-01/';report=load(base+'report.json');auth=load('/workspace/task-evidence/locator-material-availability-01-root-authorization.json');plan=load('/workspace/task-evidence/locator-material-runner-02/plan.json');cap=load(base+'MANIFEST.json')
assert h(original['/workspace/task-evidence/locator-material-runner-02/runner.mts'])==auth['runnerSHA256']==report['runnerSHA256']==cap['runnerSHA256'];assert h(original['/workspace/task-evidence/locator-material-runner-02/plan.json'])==auth['planSHA256']==report['planSHA256']==cap['planSHA256'];assert h(original['/workspace/task-evidence/locator-material-availability-01-root-authorization.json'])==cap['authorization']['sha256'];assert auth['networkAuthorized']is True
for e in cap['files']:
 assert len(original[e['path']])==e['bytes']and h(original[e['path']])==e['sha256']
for pin in plan['sourcePins']+[plan['prototypeManifest'],plan['prototypeRootReview'],plan['sdkPreview']]:assert h(original[pin['path']])==pin['sha256']
req=original[base+'request.json'];res=original[base+'response.json'];raw=json.loads(res);assert len(req)==176 and h(req)==plan['request']['bodySHA256']==report['attempt']['requestSHA256'];assert len(res)==7441 and h(res)==report['attempt']['responseSHA256'];assert json.loads(req)==plan['request']['body'];assert report['attempt']['status']==200 and report['attempt']['bodyComplete']is True and report['attempt']['bodyCleanup']=='drained'
t=report['totals'];assert(t['search'],t['contents'],t['jev'],t['httpBoundaryAttempts'])==(0,1,0,1);assert t['unknownCostAttempts']==0 and t['pendingDispatchReservations']==0 and t['totalCostUSD']==.001;assert report['followedLinks']==0 and report['originGETs']==0
assert len(report['materialEnvelopes'])==1;field=report['materialEnvelopes'][0];decoded=original[base+field['decodedFile']];assert decoded==raw['results'][0]['text'].encode();assert len(decoded)==6650 and h(decoded)==field['decodedUTF8SHA256'];assert len(decoded.decode())==6649 and len(decoded.decode().encode('utf-16-le'))//2==6649;assert field['outerResponseSHA256']==h(res)and field['rawJSONTokenSpan']is None
analysis=load('/workspace/task-evidence/locator-material-analysis-01/analysis.json');assert analysis['requestDenominator']==1 and analysis['literalHTMLLinkEdges']==0 and analysis['possibleDiscoveryTargetCount']==0 and analysis['unknownRoleSDKHints']==1;assert analysis['rawResponseSHA256']==h(res);assert h(original['/workspace/task-evidence/source-bound-locator-prototype-01/locator.py'])==analysis['parserSHA256'];assert report['linkHints'][0]['role']=='unknown'and report['linkHints'][0]['rawSpan']is None
journal=[json.loads(line)for line in original[base+'journal.jsonl'].decode().splitlines()];assert [e['phase'] for e in journal]==['declared','dispatch_reserved','settled_or_unknown','terminal'];prepared=journal[1]['totals'];assert prepared['httpBoundaryAttemptsLowerBound']==0 and prepared['httpBoundaryAttemptsUpperBound']==1 and prepared['totalCostUSD']is None;assert journal[2]['totals']['httpBoundaryAttempts']==1 and journal[2]['totals']['unknownCostAttempts']==0;assert journal[3]['totals']==report['totals']
active=[name for name in actual if pathlib.Path(name).suffix in['.ts','.mts','.cts','.js','.mjs','.cjs','.py','.sh']];assert active==['verify.py']or set(active)=={'verify.py'}
print(json.dumps({'portable':True,'originalPathsVerified':len(original),'sharedReferences':sum(e['resolution']=='existing-shared-archive-reference'for e in mapping['files']),'liveContents':1,'literalEdges':0,'possibleTargets':0,'providerCallsByVerifier':0,'originalWorkspaceReads':0,'archivedCodeExecuted':0,'fullPredecessorMaterializationClaim':False}))
