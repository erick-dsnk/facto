#!/usr/bin/env python3
"""Local, deterministic OCR development experiment. Never uses ground truth for selection."""
import argparse, collections, hashlib, importlib.metadata, json, math, re, time, unicodedata
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR
import rapidocr_onnxruntime.utils as ort_utils

# Bound CPU concurrency for consistent timings and to avoid machine-wide thread contention.
_original_options = ort_utils.SessionOptions
def session_options():
    opt = _original_options(); opt.intra_op_num_threads = 2; opt.inter_op_num_threads = 1
    return opt
ort_utils.SessionOptions = session_options

ENGINE_OPTIONS = dict(text_score=0.4, width_height_ratio=-1, det_model_path=None, det_limit_side_len=1536, det_limit_type='max')

def normalize(text):
    text = unicodedata.normalize('NFKC', text).casefold()
    return ' '.join(re.findall(r"[^\W_]+(?:['’][^\W_]+)?", text, re.UNICODE)).replace('’', "'")

def distance(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        row=[i]
        for j,y in enumerate(b,1):row.append(min(row[-1]+1,prev[j]+1,prev[j-1]+(x!=y)))
        prev=row
    return prev[-1]

def metrics(expected, predicted):
    a,b=normalize(expected),normalize(predicted); at,bt=a.split(),b.split()
    # Multiset overlap bounds recall at 1 and doesn't reward repeated sidebar words.
    overlap=sum((collections.Counter(at)&collections.Counter(bt)).values())
    return dict(target_token_recall=overlap/max(1,len(at)), token_precision=overlap/max(1,len(bt)),
                clutter_token_fraction=1-overlap/max(1,len(bt)), target_tokens=len(at), output_tokens=len(bt),
                matched_tokens=overlap, cer=distance(a,b)/max(1,len(a)), wer=distance(at,bt)/max(1,len(at)))

def box(line):
    p=np.array(line['box']); return [float(p[:,0].min()),float(p[:,1].min()),float(p[:,0].max()),float(p[:,1].max())]
def line_height(line):
    p=np.array(line['box']); return float((np.linalg.norm(p[3]-p[0])+np.linalg.norm(p[2]-p[1]))/2)
def center(line):
    b=box(line);return ((b[0]+b[2])/2,(b[1]+b[3])/2)
def union_box(lines):
    b=np.array([box(x) for x in lines]);return [float(b[:,0].min()),float(b[:,1].min()),float(b[:,2].max()),float(b[:,3].max())]
def ordered(lines):
    step=max(3,float(np.median([line_height(l) for l in lines]))*.6) if lines else 3
    return sorted(lines,key=lambda x:(round(center(x)[1]/step),box(x)[0]))
def text(lines):return '\n'.join(x['text'] for x in ordered(lines))
def order_quad(points):
    p=np.array(points,dtype=np.float32); s=p.sum(1);d=np.diff(p,axis=1).ravel()
    return np.array([p[s.argmin()],p[d.argmin()],p[s.argmax()],p[d.argmax()]],np.float32)
def warp(im,quad):
    q=order_quad(quad);tl,tr,br,bl=q
    w=max(np.linalg.norm(tr-tl),np.linalg.norm(br-bl));h=max(np.linalg.norm(bl-tl),np.linalg.norm(br-tr))
    dst=np.array([[0,0],[w-1,0],[w-1,h-1],[0,h-1]],np.float32)
    matrix=cv2.getPerspectiveTransform(q,dst)
    return cv2.warpPerspective(im,matrix,(round(w),round(h))),matrix

def screen_candidates(im):
    h,w=im.shape[:2];scale=min(1,1000/max(h,w));small=cv2.resize(im,None,fx=scale,fy=scale)
    gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY)
    masks=[cv2.Canny(gray,35,100)]
    # Bright, low-saturation page surface is a useful candidate, not a universal screen assumption.
    hsv=cv2.cvtColor(small,cv2.COLOR_BGR2HSV)
    masks.append(cv2.inRange(hsv,np.array([0,0,100]),np.array([180,115,255])))
    candidates=[]
    for mask in masks:
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
        contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area=cv2.contourArea(c)/(scale*scale)
            if not .045*w*h<area<.92*w*h:continue
            p=cv2.approxPolyDP(c,.025*cv2.arcLength(c,True),True)
            if len(p)!=4 or not cv2.isContourConvex(p):continue
            q=order_quad(p[:,0,:]/scale)
            side=[np.linalg.norm(q[i]-q[(i+1)%4]) for i in range(4)]
            if min(side)/max(side)<.3:continue
            if all(np.max(np.abs(q-a))>12 for a in candidates):candidates.append(q)
    return candidates

def choose_screen(im,lines):
    h,w=im.shape[:2];scores=[]
    for q in screen_candidates(im):
        held=[]
        for l in lines:
            pts=np.array(l['box'],np.float32)
            if cv2.pointPolygonTest(q,center(l),False)>=0 and sum(cv2.pointPolygonTest(q,tuple(map(float,p)),False)>=0 for p in pts)>=3:held.append(l)
        area=sum((box(l)[2]-box(l)[0])*line_height(l) for l in held)
        if len(held)>=2 and area>=.004*w*h:scores.append((area,cv2.contourArea(q),q))
    if not scores:return im,np.eye(3),dict(found=False,candidate_count=len(screen_candidates(im)))
    best=max(x[0] for x in scores);picked=min((x for x in scores if x[0]>=.9*best),key=lambda x:x[1])
    crop,m=warp(im,picked[2]);return crop,m,dict(found=True,candidate_count=len(scores),quad=picked[2].tolist())

def crop_rect(im,b,pad=8):
    h,w=im.shape[:2];x1,y1,x2,y2=b
    x1,y1=max(0,math.floor(x1-pad)),max(0,math.floor(y1-pad));x2,y2=min(w,math.ceil(x2+pad)),min(h,math.ceil(y2+pad))
    return im[y1:y2,x1:x2],np.array([[1,0,-x1],[0,1,-y1],[0,0,1]],float),[x1,y1,x2,y2]

def groups(lines, max_gap=.9):
    # Join aligned neighboring text lines, avoiding separate columns and heading/body merges.
    out=[]
    for l in sorted(lines,key=lambda x:center(x)[1]):
        b=box(l);best=None
        for g in out:
            last=g[-1];lb=box(last);mh=max(line_height(l),line_height(last));ratio=line_height(l)/max(1,line_height(g[0]))
            aligned=abs(b[0]-lb[0])<mh*1.7
            gap=center(l)[1]-center(last)[1]
            if aligned and .45*mh<gap<(1+max_gap)*mh and .80<ratio<1.25 and len(g)<6:best=g
        if best is None:out.append([l])
        else:best.append(l)
    return out

def select_target(im,lines):
    h,w=im.shape[:2]
    # Explicit desktop text selection: connected cyan/blue band with OCR lines contained.
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    mask=cv2.inRange(hsv,np.array([88,95,80]),np.array([119,255,255]))
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,13),np.uint8))
    cont,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    highlights=[]
    for c in cont:
        x,y,cw,ch=cv2.boundingRect(c)
        if cw>.15*w and 3<cw/max(1,ch)<18 and cv2.contourArea(c)/(cw*ch)>.55:
            held=[l for l in lines if x-8<center(l)[0]<x+cw+8 and y-8<center(l)[1]<y+ch+8]
            if len(held)>=2:highlights.append((cw*ch,[x,y,x+cw,y+ch],held))
    if highlights:
        _,b,ls=max(highlights,key=lambda x:x[0]);return dict(kind='highlight',status='selected',box=b,lines=ls,candidates=[])
    # A prominent red breaking card is a candidate, but multi-story context is ambiguous.
    red=cv2.inRange(hsv,np.array([0,140,90]),np.array([12,255,255])) | cv2.inRange(hsv,np.array([168,140,90]),np.array([180,255,255]))
    red=cv2.morphologyEx(red,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    rc,_=cv2.findContours(red,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(rc,key=cv2.contourArea,reverse=True):
        x,y,cw,ch=cv2.boundingRect(c)
        if cw>.2*w and ch>.06*h and cw/ch>1.5 and cv2.contourArea(c)/(cw*ch)>.7:
            held=[l for l in lines if x<center(l)[0]<x+cw and y<center(l)[1]<y+ch and normalize(l['text'])!='breaking']
            if len(held)>=2:
                return dict(kind='dominant_card',status='ambiguous',box=union_box(held),lines=held,candidates=[])
    # X post: use semantic structure only to locate the post column; never infer claim content.
    posts=[l for l in lines if normalize(l['text'])=='post' and .20*w<center(l)[0]<.70*w and center(l)[1]<.75*h]
    if posts:
        marker=min(posts,key=lambda l:center(l)[1]);mx,my=center(marker)
        # Account handle anchors body start; adjacent right-rail heading bounds the post column.
        rails=[box(l)[0] for l in lines if 'relevantpeople' in re.sub(r'[^a-z]','',l['text'].lower()) and box(l)[0]>mx]
        right=min(rails)-15 if rails else mx+.38*w
        handles=[l for l in lines if l['text'].strip().startswith('@') and mx-.07*w<box(l)[0]<mx+.15*w and my<box(l)[1]<my+5*line_height(marker)]
        start=max((box(l)[3] for l in handles),default=my+3*line_height(marker))+3
        column=[l for l in lines if box(l)[0]>=mx-.07*w and box(l)[2]<right and box(l)[1]>=start]
        account_skip=[]
        for l in sorted(column,key=lambda l:box(l)[1]):
            t=l['text'];b=box(l)
            if line_height(l)>2.0*line_height(marker) or re.search(r'\b(views|reply|relevant|post your|follow)\b',t,re.I) or re.search(r'\d:\d\d',t):break
            if account_skip and b[1]-box(account_skip[-1])[3]>3.5*line_height(marker):break
            account_skip.append(l)
        if account_skip:
            return dict(kind='post',status='truncated' if re.search(r'view\s*more|\.\.\.|…',text(account_skip),re.I) else 'selected',box=union_box(account_skip),lines=account_skip,candidates=[])
    # Prominent text groups; enforce usable sentence length and exclude top navigation/browser rail.
    candidates=[]
    heading_lines=[l for l in lines if re.sub(r'[^a-z]','',l['text'].lower()) not in {'breaking','liveupdates','oliveupdates'}]
    for g in groups(heading_lines):
        b=union_box(g);s=text(g);tokens=normalize(s).split();height=float(np.median([line_height(l) for l in g]))
        if len(normalize(s))<35 or b[0]<.01*w or b[1]<.09*h or b[3]>.92*h:continue
        # Largest letter size is strong heading evidence. Cap length to avoid whole body paragraphs.
        if len(tokens)>45:continue
        score=height*min(100,len(normalize(s)))**.25
        candidates.append(dict(text=s,box=b,height=height,score=score,lines=g))
    if not candidates:return dict(kind='none',status='no_target',box=None,lines=[],candidates=[])
    candidates.sort(key=lambda x:x['score'],reverse=True);winner=candidates[0]
    # A page with multiple similarly prominent unrelated headings needs user intent, even if one wins.
    competitors=[c for c in candidates[1:] if c['score']>.67*winner['score'] and abs(c['box'][0]-winner['box'][0])>.20*w]
    return dict(kind='heading',status='ambiguous' if competitors else 'selected',box=winner['box'],lines=winner['lines'],candidates=[{k:v for k,v in c.items() if k!='lines'} for c in candidates[:8]])

def transform_lines(lines,m):
    output=[]
    for l in lines:
        q=cv2.perspectiveTransform(np.array([l['box']],np.float32),m)[0]
        output.append(dict(l,box=q.tolist()))
    return output

def in_target(lines,bbox,shape):
    h,w=shape[:2];x1,y1,x2,y2=np.array(bbox)*[w,h,w,h]
    # OCR line boxes can extend beyond letters; center is stable against a modest crop margin.
    return [l for l in lines if x1<=center(l)[0]<=x2 and y1<=center(l)[1]<=y2]

def recognize(engine,im):
    start=time.perf_counter();result,parts=engine(im)
    lines=[dict(box=b,text=t,confidence=float(c)) for b,t,c in (result or [])]
    return dict(lines=lines,text=text(lines),ocr_seconds=time.perf_counter()-start,engine_seconds=parts)

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def save_json(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    (out/'.gitignore').write_text('*\n!.gitignore\n')
    gt=json.loads(Path(args.ground_truth).read_text())
    options=dict(ENGINE_OPTIONS)
    if args.rec_model:options['rec_model_path']=args.rec_model
    if args.rec_keys:options['rec_keys_path']=args.rec_keys
    root=Path(ort_utils.__file__).parent
    provenance=dict(engine='rapidocr-onnxruntime',packages={p:importlib.metadata.version(p) for p in ['rapidocr-onnxruntime','onnxruntime','opencv-python','numpy','Pillow']},
                    options=options,models={p.name:sha(p) for p in (root/'models').glob('*')},
                    cpu_threads=dict(intra_op=2,inter_op=1),ground_truth_sha256=sha(args.ground_truth),script_sha256=sha(__file__))
    if args.rec_model:provenance['custom_rec_model_sha256']=sha(args.rec_model)
    if args.rec_keys:provenance['custom_rec_keys_sha256']=sha(args.rec_keys)
    provenance_path=out/'provenance.json'
    if provenance_path.exists() and not args.force and json.loads(provenance_path.read_text())!=provenance:
        raise RuntimeError('Existing output has different provenance; use a fresh directory or --force. Never mix models, code or labels in one run.')
    save_json(out/'ground-truth.json',gt)
    save_json(provenance_path,provenance);engine=RapidOCR(**options)
    all_results=[]
    for index,sample in enumerate(gt['samples'],1):
        src=Path(args.images)/sample['filename'];sid=f'{index:02d}';dest=out/sid;dest.mkdir(exist_ok=True)
        cached=dest/'result.json'
        if cached.exists() and not args.force:
            prior=json.loads(cached.read_text())
            if prior['sha256']!=sha(src):raise RuntimeError(f'{src.name}: input changed; use a fresh output directory or --force')
            all_results.append(prior);print(sid,'cached',flush=True);continue
        im=np.array(ImageOps.exif_transpose(Image.open(src)).convert('RGB'))[:,:,::-1].copy();primary=next(t for t in sample['targets'] if t['role']=='primary')
        variants={};raw=recognize(engine,im);raw['to_original']=np.eye(3).tolist();variants['raw']=raw
        screen,m,info=choose_screen(im,raw['lines']);cv2.imwrite(str(dest/'screen.png'),screen)
        current=recognize(engine,screen);current['to_original']=np.linalg.inv(m).tolist();variants['screen']=current
        # Upscaling bounded to detector input max. Recognition model/settings stay fixed in every pass.
        scale=min(2,1536/max(screen.shape[:2]));up=cv2.resize(screen,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
        upm=np.diag([scale,scale,1.])@m
        gray=cv2.cvtColor(up,cv2.COLOR_BGR2GRAY)
        contrast=cv2.createCLAHE(clipLimit=1.5,tileGridSize=(8,8)).apply(gray)
        sharp=cv2.addWeighted(contrast,1.4,cv2.GaussianBlur(contrast,(0,0),1.0),-.4,0)
        for name,img in [('upscale',up),('gray',cv2.cvtColor(gray,cv2.COLOR_GRAY2BGR)),('contrast',cv2.cvtColor(contrast,cv2.COLOR_GRAY2BGR)),('sharpen',cv2.cvtColor(sharp,cv2.COLOR_GRAY2BGR))]:
            cv2.imwrite(str(dest/f'{name}.png'),img);v=recognize(engine,img);v['to_original']=np.linalg.inv(upm).tolist();variants[name]=v
        # Selection based on untreated screen OCR. Enhancement choice is fixed (upscaled RGB), not GT-best.
        selection=select_target(screen,current['lines']);selection['text_before_reread']=text(selection.pop('lines'))
        if selection['box']:
            crop,cm,actual=crop_rect(screen,selection['box']);scale=min(3,1536/max(crop.shape[:2]));crop=cv2.resize(crop,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
            cv2.imwrite(str(dest/'target.png'),crop);sel=recognize(engine,crop);sel['to_original']=np.linalg.inv(np.diag([scale,scale,1])@cm@m).tolist()
            selection['crop_box']=actual
        else:sel=dict(lines=[],text='',ocr_seconds=0,to_original=np.eye(3).tolist())
        selection['fact_check_text']=sel['text'] if selection['status']=='selected' else ''
        selection['requires_user_input']=selection['status'] in {'ambiguous','truncated','no_target'}
        variants['selected']=sel
        # Oracle diagnostic only; manually annotated coordinates never reach detector/selector.
        b=np.array(primary['bbox_norm'])*[im.shape[1],im.shape[0],im.shape[1],im.shape[0]]
        oracle,om,_=crop_rect(im,b,pad=10);scale=min(3,1536/max(oracle.shape[:2]));oracle=cv2.resize(oracle,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(str(dest/'oracle.png'),oracle);ov=recognize(engine,oracle);ov['to_original']=np.linalg.inv(np.diag([scale,scale,1])@om).tolist();variants['oracle']=ov
        for name,v in variants.items():
            original=transform_lines(v['lines'],np.array(v['to_original']));v['original_lines']=original
            v['metrics']=metrics(primary['text'],v['text'])
            target_lines=in_target(original,primary['bbox_norm'],im.shape)
            v['spatial_clutter_token_fraction']=1-sum(len(normalize(l['text']).split()) for l in target_lines)/max(1,len(normalize(v['text']).split()))
            v['target_region_text']=text(target_lines)
            v['target_region_metrics']=metrics(primary['text'],v['target_region_text'])
            v['secondary_targets']=[dict(kind=t['kind'],metrics=metrics(t['text'],text(in_target(original,t['bbox_norm'],im.shape))),text=text(in_target(original,t['bbox_norm'],im.shape))) for t in sample['targets'] if t['role']=='secondary']
        overlay=screen.copy()
        for c in selection.get('candidates',[]):
            x1,y1,x2,y2=map(round,c['box']);cv2.rectangle(overlay,(x1,y1),(x2,y2),(0,180,200),1)
        if selection['box']:
            x1,y1,x2,y2=map(round,selection['box']);cv2.rectangle(overlay,(x1,y1),(x2,y2),(20,230,20),3)
        cv2.imwrite(str(dest/'selection.png'),overlay)
        r=dict(id=sid,filename=sample['filename'],sha256=sha(src),shape=list(im.shape),primary=primary,screen_detection=info,selection=selection,variants=variants)
        save_json(cached,r);all_results.append(r);print(sid,selection['kind'],selection['status'],repr(sel['text'][:140]),flush=True)
    save_json(out/'results.json',dict(provenance=provenance,samples=all_results));summarize(out,all_results)

def summarize(out,results):
    summary={}
    for name in results[0]['variants']:
        values=[r['variants'][name]['metrics'] for r in results];regions=[r['variants'][name]['target_region_metrics'] for r in results]
        summary[name]=dict(mean_target_token_recall=float(np.mean([v['target_token_recall'] for v in values])),mean_nonmatching_token_fraction=float(np.mean([v['clutter_token_fraction'] for v in values])),mean_spatial_clutter_token_fraction=float(np.mean([r['variants'][name]['spatial_clutter_token_fraction'] for r in results])),
                           mean_target_region_cer=float(np.mean([v['cer'] for v in regions])),mean_target_region_wer=float(np.mean([v['wer'] for v in regions])),
                           mean_selected_or_full_cer=float(np.mean([v['cer'] for v in values])),mean_selected_or_full_wer=float(np.mean([v['wer'] for v in values])),
                           total_ocr_seconds=sum(r['variants'][name]['ocr_seconds'] for r in results),total_output_tokens=sum(v['output_tokens'] for v in values))
    save_json(out/'summary.json',summary)
    print(json.dumps(summary,indent=2),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--images',required=True);p.add_argument('--ground-truth',required=True);p.add_argument('--output',default='artifacts/ocr-experiment');p.add_argument('--force',action='store_true');p.add_argument('--rec-model');p.add_argument('--rec-keys');run(p.parse_args())
