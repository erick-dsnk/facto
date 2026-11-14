#!/usr/bin/env python3
"""OFFLINE byte verifier/extractor. No Git/npm/imports of archived code/network."""
from pathlib import Path,PurePosixPath
import argparse,gzip,hashlib,json,os,re,stat,sys
ROOT=Path(__file__).absolute().parent
MAX_FILE=16*1024*1024;MAX_TOTAL=100*1024*1024
sha=lambda b:hashlib.sha256(b).hexdigest()
def no_links(p,need_file=False):
 for q in [p,*p.parents]:
  if q.exists() or q.is_symlink():
   st=q.lstat()
   if stat.S_ISLNK(st.st_mode):raise ValueError('symlink forbidden: '+str(q))
 if need_file:
  st=p.lstat()
  if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1:raise ValueError('nonregular/hardlink forbidden')
def safe_rel(name):
 if not isinstance(name,str) or not name or '\\' in name or '\x00' in name:raise ValueError('bad path')
 p=PurePosixPath(name)
 if p.is_absolute() or any(x in ['.','..',''] for x in name.split('/')):raise ValueError('path traversal')
 return p

def read(p,limit=MAX_FILE):
 no_links(p,True)
 if p.stat().st_size>limit:raise ValueError('file bound')
 with p.open('rb') as f:return f.read(limit+1)
def verify_package():
 manifest=json.loads(read(ROOT/'BUNDLE-MANIFEST.json',2*1024*1024)); listed=manifest['files']
 if not isinstance(listed,dict) or len(listed)>5000:raise ValueError('manifest bounds')
 for name,pin in listed.items():
  safe_rel(name); b=read(ROOT/name)
  if len(b)!=pin['bytes'] or sha(b)!=pin['sha256']:raise ValueError('package hash mismatch: '+name)
 rows=json.loads(read(ROOT/'restore-map.json',4*1024*1024))['files']
 if len(rows)>5000:raise ValueError('row bound')
 destinations=set(); blobs={};total=0;checked=[]
 for x in rows:
  rel=str(safe_rel(x['restorePath']))
  if not rel.startswith('workspace/task-evidence/') or x['originalPath']!='/'+rel or rel in destinations:raise ValueError('invalid/duplicate restore path')
  parts=PurePosixPath(rel).parts
  if any(v in parts for v in ['node_modules','__pycache__','.git']) or any(v.startswith('.env') for v in parts) or any(v in rel.lower() for v in ['sealed','heldout']):raise ValueError('forbidden restore path')
  destinations.add(rel);n=x['bytes'];total+=n
  if type(n)!=int or not 0<=n<=MAX_FILE or total>MAX_TOTAL:raise ValueError('decompression bounds')
  digest=x['sha256'];blob=x['blob']
  if not re.fullmatch('[0-9a-f]{64}',digest) or blob!='blobs/'+digest+'.gz' or blob not in listed:raise ValueError('blob binding')
  if blob not in blobs:
   raw=read(ROOT/blob)
   if len(raw)!=x['encodedBytes'] or sha(raw)!=x['encodedSHA256']:raise ValueError('encoded mismatch')
   import io
   with gzip.GzipFile(fileobj=io.BytesIO(raw)) as f:data=f.read(n+1)
   if len(data)!=n or sha(data)!=digest:raise ValueError('decoded mismatch')
   blobs[blob]=data
  data=blobs[blob]
  if len(data)!=n or sha(data)!=digest:raise ValueError('duplicate blob metadata mismatch')
  checked.append((rel,data,digest))
 return checked,manifest

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--target-root',type=Path);ap.add_argument('--extract',action='store_true');ap.add_argument('--verify-restored',action='store_true');args=ap.parse_args()
 if args.extract and args.verify_restored:raise ValueError('choose one mode')
 checked,manifest=verify_package()
 if args.extract or args.verify_restored:
  if args.target_root is None or not args.target_root.is_absolute():raise ValueError('absolute --target-root required')
  target=args.target_root;no_links(target)
  if not target.is_dir():raise ValueError('target root must already exist')
  # Validate every destination before the first write. Refuse changed bytes, no overwrite.
  for rel,data,digest in checked:
   p=target/rel;no_links(p)
   if p.exists():
    if read(p)!=data:raise ValueError('existing destination conflict: '+rel)
   elif args.verify_restored:raise ValueError('missing restored file: '+rel)
  if args.extract:
   for rel,data,digest in checked:
    p=target/rel
    if p.exists():continue
    p.parent.mkdir(parents=True,exist_ok=True);no_links(p.parent)
    fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
    with os.fdopen(fd,'wb') as f:f.write(data)
    if sha(read(p))!=digest:raise ValueError('write verification failure')
 print(json.dumps({'verifiedFiles':len(checked),'verifiedRawBytes':sum(len(x[1]) for x in checked),'mode':'extract' if args.extract else 'verify-restored' if args.verify_restored else 'verify-package','network':False,'codeExecutedFromArchive':False,'liveCallsAuthorized':False}))
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,KeyError,TypeError,json.JSONDecodeError) as e:
  print('REFUSED: '+str(e),file=sys.stderr);sys.exit(2)
