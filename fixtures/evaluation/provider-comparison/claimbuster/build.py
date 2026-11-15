import csv,json,random,collections
import os
C=os.environ.get('CB_DIR', os.path.dirname(os.path.abspath(__file__)))
SEED=20261114
rows=list(csv.DictReader(open(os.environ.get('CB_GROUNDTRUTH', C+'/raw/groundtruth.csv'),encoding='utf-8')))
seen=set();rs=[]
for x in rows:
    t=' '.join(x['Text'].split())
    if t in seen: continue
    seen.add(t);x['Text']=t;rs.append(x)
debates=sorted({x['File_id'] for x in rs})
need={'1':50,'0':30,'-1':40}
rng=random.Random(SEED)
def cnt(ds):
    c=collections.Counter(x['Verdict'] for x in rs if x['File_id'] in ds);return c
for attempt in range(100000):
    sh=debates[:];rng.shuffle(sh);k=len(sh)//2
    A,B=set(sh[:k]),set(sh[k:])
    ca,cb=cnt(A),cnt(B)
    if all(ca[l]>=n and cb[l]>=n for l,n in need.items()): break
else: raise SystemExit('no partition')
print('attempt',attempt,dict(ca),dict(cb))
lab={'1':'CFS','0':'UFS','-1':'NFS'}
def build(ds,name):
    r2=random.Random(f'{SEED}-{name}')
    cases=[];ufs=[];side={}
    for l,n in need.items():
        pool=sorted([x for x in rs if x['File_id'] in ds and x['Verdict']==l],key=lambda x:int(x['Sentence_id']))
        for x in r2.sample(pool,n):
            id=f"cb-{name}-{lab[l].lower()}-{x['Sentence_id']}"
            exp='not_a_claim' if l=='-1' else 'cant_verify'
            c={'id':id,'text':x['Text'],'expected':exp,'context':[],'mode':'typed'}
            (ufs if l=='0' else cases).append(c)
            side[id]={'claimbuster_label':lab[l],'verdict':int(l),'sentence_id':x['Sentence_id'],'debate':x['File_id'],'speaker':x['Speaker'],'speaker_title':x['Speaker_title'],'speaker_party':x['Speaker_party']}
    r2.shuffle(cases)
    return cases,ufs,side
sidecar={'seed':SEED,'source':'https://zenodo.org/records/3609356 groundtruth.csv','debates':{}}
for name,ds in(('dev',A),('holdout',B)):
    cases,ufs,side=build(ds,name)
    # admission-cb-<name>.json = CFS+NFS (90, scored); -ufs = UFS (30, reported separately); -all120 = all three shuffled
    allc=cases+ufs
    random.Random(f'{SEED}-{name}-order').shuffle(allc)
    json.dump({'schemaVersion':1,'name':f'admission-cb-{name}-all120','cases':allc},open(f'{C}/admission-cb-{name}-all120.json','w'),indent=2,ensure_ascii=False)
    json.dump({'schemaVersion':1,'name':f'admission-cb-{name}-ufs','cases':ufs},open(f'{C}/admission-cb-{name}-ufs.json','w'),indent=2,ensure_ascii=False)
    json.dump({'schemaVersion':1,'name':f'admission-cb-{name}-cfs-nfs','cases':cases},open(f'{C}/admission-cb-{name}.json','w'),indent=2,ensure_ascii=False)
    sidecar[name]=side;sidecar['debates'][name]=sorted(ds)
    print(name,len(allc),len(cases),len(ufs),collections.Counter(v['claimbuster_label'] for v in side.values()))
assert not set(sidecar['dev'])&set(sidecar['holdout'])
assert not set(sidecar['debates']['dev'])&set(sidecar['debates']['holdout'])
json.dump(sidecar,open(C+'/sidecar.json','w'),indent=1,ensure_ascii=False)
