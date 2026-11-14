#!/usr/bin/env python3
"""Author-time final metadata freeze; hashes package only, never runs archived modules."""
from pathlib import Path
import hashlib,json,re,gzip
r=Path(__file__).parent
rows=json.loads((r/'restore-map.json').read_text())['files'];hits=[]
patterns={'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','common_live_token':rb'\b(?:sk-proj-|sk_live_|ghp_|github_pat_)[A-Za-z0-9_-]{20,}','jwt':rb'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'}
for x in rows:
 b=gzip.decompress((r/x['blob']).read_bytes())
 for label,p in patterns.items():
  if re.search(p,b):hits.append({'path':x['originalPath'],'pattern':label})
(r/'secret-scan.json').write_text(json.dumps({'scope':'all allowlisted raw bytes; no environment/key reads','files':len(rows),'patterns':list(patterns),'hits':hits,'limitations':'Pattern scan plus explicit provenance/allowlist; not a proof that arbitrary unknown credential formats cannot exist. No env, credential store, node_modules, private/sealed/heldout paths were included.'},indent=2)+'\n')
if hits:raise ValueError('secret-pattern hits require review')
files={}
for p in sorted(r.rglob('*')):
 if not p.is_file() or p.name=='BUNDLE-MANIFEST.json':continue
 if p.is_symlink() or '__pycache__' in p.parts:raise ValueError('unexpected symlink/cache')
 b=p.read_bytes();files[str(p.relative_to(r))]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(r/'BUNDLE-MANIFEST.json').write_text(json.dumps({'schemaVersion':1,'kind':'OPEN_fresh_cloud_continuation','files':files,'completedNEW24MustNeverRerun':True,'oldAuthorizationsReusable':False,'providerCallsByExporter':0,'publicationCommit':None,'publicationPending':True},indent=2)+'\n')
print(json.dumps({'manifestSHA256':hashlib.sha256((r/'BUNDLE-MANIFEST.json').read_bytes()).hexdigest(),'packageFiles':len(files),'originalPaths':len(rows)}))
