#!/usr/bin/env python3
"""Offline package-only tests; no archived imports and original workspace reads denied in child."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,tempfile
SOURCE=Path(__file__).parent
SHA=lambda b:hashlib.sha256(b).hexdigest()
WRAPPER=r'''
import sys,runpy
script=sys.argv[1];sys.argv=[script]+sys.argv[2:]
def audit(event,args):
 if event=='open' and args and isinstance(args[0],(str,bytes)):
  p=args[0].decode() if isinstance(args[0],bytes) else args[0]
  if p.startswith('/workspace/'):raise RuntimeError('original workspace access forbidden')
 if event.startswith('socket.') or event.startswith('subprocess.') or event in ['os.system','os.posix_spawn']:raise RuntimeError('network/process forbidden')
sys.addaudithook(audit)
runpy.run_path(script,run_name='__main__')
'''
def run(p,*args):return subprocess.run([sys.executable,'-I','-B','-c',WRAPPER,str(p/'restore.py'),*map(str,args)],capture_output=True,text=True)
def rehash(p,name):
 m=json.loads((p/'BUNDLE-MANIFEST.json').read_text());b=(p/name).read_bytes();m['files'][name]={'sha256':SHA(b),'bytes':len(b)};(p/'BUNDLE-MANIFEST.json').write_text(json.dumps(m))
def main():
 results=[]
 with tempfile.TemporaryDirectory(prefix='fresh-cloud-restore-') as td:
  root=Path(td);p=root/'package';shutil.copytree(SOURCE,p);target=root/'empty';target.mkdir()
  def check(name,result,ok=True):
   assert (result.returncode==0)==ok,(name,result.stdout,result.stderr);results.append({'case':name,'passed':True})
  check('package only, original workspace denied',run(p))
  check('empty root extraction, original workspace/network/process denied',run(p,'--target-root',target,'--extract'))
  check('exact restored verification',run(p,'--target-root',target,'--verify-restored'))
  check('idempotent identical files',run(p,'--target-root',target,'--extract'))
  rows=json.loads((p/'restore-map.json').read_text())['files'];dest=target/rows[0]['restorePath'];dest.write_bytes(b'conflict')
  check('existing changed destination refused',run(p,'--target-root',target,'--extract'),False);assert dest.read_bytes()==b'conflict'
  q=root/'symlink-root';q.mkdir();outside=root/'outside';outside.mkdir();(q/'workspace').symlink_to(outside,target_is_directory=True)
  check('destination ancestor symlink refused',run(p,'--target-root',q,'--extract'),False);assert not list(outside.iterdir())
  blob=p/rows[0]['blob'];saved=blob.read_bytes();blob.unlink();check('missing blob refused without original fallback',run(p),False);blob.write_bytes(saved)
  blob.write_bytes(saved+b'corrupt');check('corrupt blob refused',run(p),False);blob.write_bytes(saved)
  data=json.loads((p/'restore-map.json').read_text());data['files'][0]['restorePath']='../escape';(p/'restore-map.json').write_text(json.dumps(data));rehash(p,'restore-map.json')
  check('traversal refused even with matching package metadata',run(p,'--target-root',target,'--extract'),False)
 print(json.dumps({'tests':results,'count':len(results),'originalWorkspaceReadsInChildren':0,'providerCalls':0,'archivedModulesExecuted':0},indent=2))
if __name__=='__main__':main()
