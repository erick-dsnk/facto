#!/usr/bin/env python3
"""Explicit author-only export. Never discovers paths; reads allowlist.json only."""
from pathlib import Path,PurePosixPath
import gzip,hashlib,json,os,stat
ROOT=Path(__file__).parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def regular(p):
 for q in [p,*p.parents]:
  st=q.lstat()
  if stat.S_ISLNK(st.st_mode):raise ValueError('symlink source')
 st=p.lstat()
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1:raise ValueError('nonregular/hardlinked source')
 return p.read_bytes()
def main():
 rows=json.loads(regular(ROOT/'allowlist.json'))['files']; seen=set();total=0;out=[]
 (ROOT/'blobs').mkdir(exist_ok=True)
 for x in rows:
  s=x['originalPath']; p=PurePosixPath(s)
  if not s.startswith('/workspace/task-evidence/') or '..' in p.parts or s in seen:raise ValueError('invalid explicit path')
  if any(v in p.parts for v in ['node_modules','__pycache__','.git']) or any(v.startswith('.env') for v in p.parts) or any(v in s.lower() for v in ['sealed','heldout']):raise ValueError('forbidden path')
  seen.add(s);data=regular(Path(s));total+=len(data)
  if len(data)>16*1024*1024 or total>100*1024*1024:raise ValueError('export bounds')
  if sha(data)!=x['sha256'] or len(data)!=x['bytes']:raise ValueError('allowlisted source changed: '+s)
  encoded=gzip.compress(data,compresslevel=9,mtime=0);blob='blobs/'+sha(data)+'.gz';dest=ROOT/blob
  if dest.exists():
   if regular(dest)!=encoded:raise ValueError('blob collision')
  else:
   with dest.open('xb') as f:f.write(encoded)
  out.append({**x,'blob':blob,'encodedSHA256':sha(encoded),'encodedBytes':len(encoded)})
 (ROOT/'restore-map.json').write_text(json.dumps({'schemaVersion':1,'kind':'OPEN_inert_continuation_data','files':out,'bytes':total,'oldAuthorizationsGrantNoNewCalls':True},indent=2)+'\n')
 print(json.dumps({'files':len(out),'rawBytes':total,'uniqueBlobs':len({x['blob'] for x in out}),'encodedBytes':sum((ROOT/p).stat().st_size for p in {x['blob'] for x in out})}))
if __name__=='__main__':main()
