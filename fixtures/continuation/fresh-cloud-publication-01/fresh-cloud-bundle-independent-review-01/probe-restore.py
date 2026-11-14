from pathlib import Path
import tempfile,shutil,subprocess,sys,json,hashlib,os
review=Path(__file__).parent;source=Path('/workspace/task-evidence/fresh-cloud-continuation-01'); results=[]
source_manifest=(source/'BUNDLE-MANIFEST.json').read_bytes();source_restore=(source/'restore.py').read_bytes()
wrapper='''import sys,runpy\ndef guard(event,args):\n if event=="open" and isinstance(args[0],(str,bytes)) and str(args[0]).startswith("/workspace/"):raise RuntimeError("original_workspace_read_forbidden")\n if event in ("socket.connect","subprocess.Popen","os.system"):raise RuntimeError("execution_or_network_forbidden")\nsys.addaudithook(guard)\nsys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name="__main__")\n'''
def run(pkg,args=[]):
 p=subprocess.run([sys.executable,'-I','-c',wrapper,str(pkg/'restore.py'),*args],cwd=pkg,text=True,capture_output=True);return p
with tempfile.TemporaryDirectory(prefix='fresh-cloud-independent-',dir='/tmp') as tmp:
 root=Path(tmp);master=root/'master';shutil.copytree(source,master);assert (master/'BUNDLE-MANIFEST.json').read_bytes()==source_manifest
 p=run(master);assert p.returncode==0,p.stderr;results.append({'name':'isolated-package-only','passed':True,'stdout':p.stdout.strip()})
 target=root/'restored';target.mkdir();p=run(master,['--target-root',str(target),'--extract']);assert p.returncode==0,p.stderr
 p=run(master,['--target-root',str(target),'--verify-restored']);assert p.returncode==0,p.stderr
 rows=json.loads((master/'restore-map.json').read_bytes())['files'];assert len([p for p in target.rglob('*') if p.is_file()])==len(rows)
 for row in rows:
  b=(target/row['restorePath']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 results.append({'name':'exact-extract-and-verify','passed':True,'files':len(rows)})
 p=run(master,['--target-root',str(target),'--extract']);assert p.returncode==0,p.stderr;results.append({'name':'identical-existing-bytes','passed':True})
 def fresh(name):
  pkg=root/('pkg-'+name);shutil.copytree(master,pkg);dest=root/('dst-'+name);dest.mkdir();return pkg,dest
 def refuse(name,alter):
  pkg,dest=fresh(name);alter(pkg,dest);p=run(pkg,['--target-root',str(dest),'--extract']);assert p.returncode!=0,(name,p.stdout);results.append({'name':name,'passed':True,'refusal':p.stderr.strip().splitlines()[-1]})
 blob=rows[0]['blob'];first=rows[0]['restorePath']
 refuse('missing-blob',lambda p,d:(p/blob).unlink())
 refuse('corrupt-blob',lambda p,d:(p/blob).write_bytes(b'corrupt'))
 def link_blob(p,d):
  q=p/blob;original=q.read_bytes();q.unlink();other=root/'external-blob';other.write_bytes(original);q.symlink_to(other)
 refuse('package-symlink',link_blob)
 def hard_blob(p,d):
  q=p/blob;os.link(q,root/'hardlink-blob')
 refuse('package-hardlink',hard_blob)
 def conflict(p,d):
  q=d/first;q.parent.mkdir(parents=True);q.write_bytes(b'conflict')
 refuse('existing-conflict',conflict)
 def symlink_parent(p,d):
  outside=root/'outside';outside.mkdir();(d/'workspace').symlink_to(outside,target_is_directory=True)
 refuse('destination-symlink-ancestor',symlink_parent)
 def hard_dest(p,d):
  q=d/first;q.parent.mkdir(parents=True);q.write_bytes((target/first).read_bytes());os.link(q,root/'hardlink-dest')
 refuse('destination-hardlink',hard_dest)
 def edit_row(p,d,value):
  mp=p/'restore-map.json';x=json.loads(mp.read_bytes());x['files'][0]['restorePath']=value;x['files'][0]['originalPath']='/'+value;mp.write_text(json.dumps(x));m=json.loads((p/'BUNDLE-MANIFEST.json').read_bytes());b=mp.read_bytes();m['files']['restore-map.json']={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};(p/'BUNDLE-MANIFEST.json').write_text(json.dumps(m))
 for name,value in [('traversal','workspace/task-evidence/../../escape'),('absolute','/tmp/escape'),('backslash','workspace/task-evidence/a\\b'),('envpath','workspace/task-evidence/.env')]:refuse(name,lambda p,d,v=value:edit_row(p,d,v))
 assert not (root/'escape').exists();assert (source/'restore.py').read_bytes()==source_restore
result={'kind':'independent_isolated_restore_adversarial_probes','manifestSHA256':hashlib.sha256(source_manifest).hexdigest(),'restoreSHA256':hashlib.sha256(source_restore).hexdigest(),'cases':results,'originalWorkspaceReadAllowed':False,'networkOrSubprocessInsideRestorerAllowed':False,'newProviderCalls':0,'keyReads':0,'sourceEdits':0}
(review/'restore-probe-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
