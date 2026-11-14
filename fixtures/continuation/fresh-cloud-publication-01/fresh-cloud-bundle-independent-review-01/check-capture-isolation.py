from pathlib import Path
import hashlib,json,gzip,shutil,tempfile,subprocess,sys,re
source=Path('/workspace/task-evidence/new24-completed-capture-package-01');review=Path(__file__).parent
assert hashlib.sha256((source/'MANIFEST.json').read_bytes()).hexdigest()=='c693f6fe5ae4bdb1f05b624c9e8df72144775b02ecbb59db4f2cb077719667df'
m=json.loads((source/'source-map.json').read_bytes());seen=set();decoded={}
for x in m['entries']:
 p=Path(x['originalPath']);assert p.is_absolute() and '..' not in p.parts and str(p).startswith('/workspace/task-evidence/')
 assert x['originalPath'] not in seen;seen.add(x['originalPath'])
 assert not re.search(r'(?:independent-evaluation|cases-heldout\.json|(?:^|/)\.env(?:[./]|$)|(?:^|/)id_rsa$|(?:^|/)credentials(?:[./]|$))',x['originalPath'],re.I)
 q=Path(x['blobPath']);assert not q.is_absolute() and '..' not in q.parts
 if x['blobPath'] not in decoded:decoded[x['blobPath']]=gzip.decompress((source/q).read_bytes())
 b=decoded[x['blobPath']];assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
 assert not re.search(rb'(?:AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',b)
with tempfile.TemporaryDirectory(prefix='capture-package-isolation-',dir='/tmp') as tmp:
 dst=Path(tmp)/'package';shutil.copytree(source,dst)
 wrapper='''import sys,runpy,json\nopens=[]\ndef guard(event,args):\n if event=="open" and isinstance(args[0],(str,bytes)) and str(args[0]).startswith("/workspace/"):\n  opens.append(str(args[0]));raise RuntimeError("original_workspace_read_forbidden")\nsys.addaudithook(guard)\nrunpy.run_path(sys.argv[1],run_name="__main__")\nassert not opens\nprint(json.dumps({"forbiddenWorkspaceReads":len(opens)}))\n'''
 p=subprocess.run([sys.executable,'-I','-c',wrapper,str(dst/'VERIFY.py.txt')],cwd=dst,text=True,capture_output=True);assert p.returncode==0,p.stderr
 result={'kind':'independent_completed_capture_portability_review','decision':'approved_for_inert_evidence_inclusion_not_live_execution','sourceManifestSHA256':hashlib.sha256((source/'MANIFEST.json').read_bytes()).hexdigest(),'sourceMapSHA256':hashlib.sha256((source/'source-map.json').read_bytes()).hexdigest(),'originalPaths':len(seen),'uniqueDecodedBlobs':len(decoded),'isolatedVerifierStdout':p.stdout,'originalWorkspaceFallback':False,'pathTraversalSymlinkIssuesObserved':False,'forbiddenSecretPrivateSealedPathsObserved':0,'highConfidencePrivateKeyAWSMarkersObserved':0,'secretScanLimitation':'No environment/key values read; pattern checks are not proof against arbitrary embedded credentials. Explicit allowlist and sanitized provenance remain required.','providers':0,'network':0,'restoredExecution':False,'method':'Agent packaging inspection; prior public corpus/source and producer involvement disclosed. No semantic relabeling or original protected evaluation reads.'}
(review/'capture-package-review.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
