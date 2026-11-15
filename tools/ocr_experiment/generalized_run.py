#!/usr/bin/env python3
"""Paired generalized selector regression runner; annotations used only after inference."""
import argparse
import importlib.metadata
import json
import os
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image,ImageOps

from generalized import MultimodalSelector,ProductionSelector,disagreements,select
from run import ENGINE_OPTIONS,RapidOCR,box,crop_rect,in_target,metrics,recognize,save_json,sha,text,transform_lines

REPO_ROOT=Path(__file__).resolve().parents[2]
REDDIT_SAMPLES=(
    ('WhatsApp Image 2026-11-15 at 02.12.35.jpeg',dict(bbox_norm=[.340,.460,.750,.492],ambiguous=False)),
    ('WhatsApp Image 2026-11-15 at 02.12.34.jpeg',dict(bbox_norm=[.345,.485,.680,.505],ambiguous=True)),
)

def samples(images_dir,reddit_images_dir,baseline_dir,reddit_baseline_dir):
    old=json.loads((REPO_ROOT/'tools/ocr_experiment/ground_truth.json').read_text())['samples']
    out=[(images_dir/s['filename'],s,baseline_dir/f'{i:02d}'/'result.json') for i,s in enumerate(old,1)]
    title='US aviation shutdown blamed on L3 Harris installed router | Reuters'
    for i,(fn,details) in enumerate(REDDIT_SAMPLES,1):
        sample=dict(filename=fn,targets=[dict(role='primary',text=title,ambiguous=details['ambiguous'],truncated=False,bbox_norm=details['bbox_norm'])],evaluation_note='Reddit title manually transcribed from original image; feed has multiple peer targets and this reference is diagnostic only.')
        out.append((reddit_images_dir/fn,sample,reddit_baseline_dir/f'{i:02d}'/'result.json'))
    return out


def run(args):
    dest=Path(args.output).expanduser().resolve();dest.mkdir(parents=True,exist_ok=True);(dest/'.gitignore').write_text('*\n!.gitignore\n')
    selector=MultimodalSelector.from_env() if args.mode=='multimodal' else (ProductionSelector(os.getenv('OCR_VISION_MODEL','')) if args.mode=='production' else None)
    if args.mode=='multimodal' and not selector:raise RuntimeError('Set OCR_SELECTOR_BASE_URL/MODEL or OCR_VISION_BASE_URL/MODEL; API key optional only for authorized local endpoints.')
    options=dict(ENGINE_OPTIONS,rec_model_path=str(Path(args.rec_model).expanduser()),rec_keys_path=str(Path(args.rec_keys).expanduser()))
    # Cached recognitions are frozen baseline outputs, not labels. Running raw again remains default.
    engine=None if args.reuse_raw else RapidOCR(**options);reread_engine=None
    provenance=dict(mode=args.mode,ocr_options=options,recognizer_sha256=sha(args.rec_model),dictionary_sha256=sha(args.rec_keys),runner_sha256=sha(__file__),selector_sha256=sha(Path(__file__).with_name('generalized.py')),frozen_runner_sha256=sha(Path(__file__).with_name('run.py')),provider_model=selector.model if selector else None,ocr_source='verified historical raw + mapped supplemental screen cache' if args.reuse_raw else 'fresh raw pass + mapped historical supplemental screen cache',evaluation='11 known regression images; no blind generalization claim',packages={p:importlib.metadata.version(p) for p in ['rapidocr-onnxruntime','onnxruntime','opencv-python','numpy','Pillow']})
    provenance['observation_views']='complete original and mapped screen views, including overlaps' if args.all_views else 'original plus spatially missing mapped screen lines; overlapping alternatives retained separately'
    if args.mode=='production':
        provenance['production_selector_sha256']=sha(REPO_ROOT/'services/api/src/input/ocr/target-selection.ts')
        provenance['production_bridge_sha256']=sha(REPO_ROOT/'services/api/src/input/ocr/evaluate-target-selection.ts')
        provenance['provider_timeout_ms']=int(os.getenv('OCR_VISION_TIMEOUT_MS','60000'))
        provenance['provider_max_tokens']=int(os.getenv('OCR_VISION_MAX_TOKENS','1200'))
        for name in ['target-selection.ts','evaluate-target-selection.ts']:
            (dest/name).write_bytes((REPO_ROOT/'services/api/src/input/ocr'/name).read_bytes())
    if (dest/'provenance.json').exists():
        raise RuntimeError('Output already exists; use a fresh directory to keep provenance immutable')
    save_json(dest/'provenance.json',provenance)
    (dest/'generalized.py').write_bytes(Path(__file__).with_name('generalized.py').read_bytes())
    (dest/'generalized_run.py').write_bytes(Path(__file__).read_bytes())
    rows=[]
    for index,(src,label,baseline_path) in enumerate(samples(args.images_dir.expanduser().resolve(),args.reddit_images_dir.expanduser().resolve(),args.baseline_dir, args.reddit_baseline_dir),1):
        sid=f'{index:02d}';out=dest/sid;out.mkdir(exist_ok=True)
        if not src.is_file():raise FileNotFoundError(f'Input photo not found: {src}; check --images-dir / --reddit-images-dir')
        if not baseline_path.is_file():raise FileNotFoundError(f'Cached OCR result not found: {baseline_path}; run tools/ocr_experiment/run.py first or supply the matching --baseline-dir')
        old=json.loads(baseline_path.read_text());expected_hash=old.get('sha256',old.get('source_sha256'))
        if sha(src)!=expected_hash:raise RuntimeError('Input changed from frozen run')
        raw=old.get('variants',{}).get('raw',old.get('raw'))
        im=np.array(ImageOps.exif_transpose(Image.open(src)).convert('RGB'))[:,:,::-1].copy()
        if engine:raw=recognize(engine,im)
        screen=old.get('variants',{}).get('screen',old.get('screen',{}))
        supplemental=transform_lines(screen.get('lines',[]),np.array(screen.get('to_original',np.eye(3))))
        start=time.perf_counter();prediction=select(im,raw['lines'],args.intent,selector,supplemental,include_alternates=args.all_views);elapsed=time.perf_counter()-start
        # Labels are first referenced here, after inference has returned.
        target=next(t for t in label['targets'] if t['role']=='primary');prediction['primary_evaluation']=target
        selection=prediction['selection'];baseline_selection=old['selection'];baseline_text=baseline_selection.get('text_before_reread',baseline_selection.get('selected_text',''))
        if not baseline_text:baseline_text=baseline_selection.get('candidate_text','')
        if not baseline_text and 'lines' in baseline_selection:baseline_text=text(baseline_selection['lines'])
        prediction.update(id=sid,filename=src.name,sha256=sha(src),ocr_seconds=raw['ocr_seconds'],screen_ocr_seconds=screen.get('ocr_seconds',0),end_to_end_seconds=raw['ocr_seconds']+screen.get('ocr_seconds',0)+elapsed,baseline=dict(status=baseline_selection['status'],text=baseline_text,metrics=metrics(target['text'],baseline_text)),raw_target_metrics=metrics(target['text'],text(in_target(raw['lines'],target['bbox_norm'],im.shape))),candidate_metrics=metrics(target['text'],selection['text']))
        prediction['expected_status']='needs_target' if target.get('ambiguous') else ('incomplete' if target.get('truncated') else 'selected')
        prediction['status_matches_annotation']=selection['status']==prediction['expected_status']
        known={l['id']:l for l in prediction['observations']}
        candidate_diagnostics=[dict(id=c['id'],metrics=metrics(target['text'],text([known[i] for i in c['line_ids']]))) for c in selection.get('candidates',[])]
        prediction['best_candidate_diagnostic']=min(candidate_diagnostics,key=lambda c:c['metrics']['cer']) if candidate_diagnostics else None
        if args.reread and (selection.get('selected_line_ids') or selection.get('reread_region')):
            if reread_engine is None:reread_engine=RapidOCR(**options)
            ls=[l for l in prediction['observations'] if l['id'] in selection['selected_line_ids']]
            if selection.get('reread_region'):
                region=np.array(selection['reread_region'])*[im.shape[1],im.shape[0],im.shape[1],im.shape[0]]
                ls=in_target(prediction['observations'],selection['reread_region'],im.shape)
            else:
                bs=np.array([box(l) for l in ls]);region=[bs[:,0].min(),bs[:,1].min(),bs[:,2].max(),bs[:,3].max()]
            area=(region[2]-region[0])*(region[3]-region[1])/(im.shape[0]*im.shape[1])
            if area<=.6:
                crop,_,actual=crop_rect(im,region,pad=12);scale=min(3,1536/max(crop.shape[:2]));crop=cv2.resize(crop,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
                reread=recognize(reread_engine,crop);prediction['reread_diagnostic']=dict(region_original=actual,text=reread['text'],seconds=reread['ocr_seconds'],requested_by_model=bool(selection.get('reread_region')),comparison=disagreements(text(ls),reread['text']))
                cv2.imwrite(str(out/'reread.png'),crop)
        overlay=im.copy()
        for b in prediction['blocks']:
            if not b['candidate']:continue
            x1,y1,x2,y2=map(int,b['box']);cv2.rectangle(overlay,(x1,y1),(x2,y2),(0,200,255),2);cv2.putText(overlay,b['id'],(x1,y1-3),cv2.FONT_HERSHEY_SIMPLEX,.45,(0,200,255),1)
        for l in prediction['observations']:
            if l['id'] in selection['selected_line_ids']:cv2.polylines(overlay,[np.array(l['box'],np.int32)],True,(0,255,0),2)
        cv2.imwrite(str(out/'selection.png'),overlay);save_json(out/'result.json',prediction)
        rows.append(prediction);print(sid,prediction['mode'],selection['status'],repr(selection['text'][:160]),flush=True)
    save_json(dest/'results.json',rows)
    summary=dict(total=len(rows),accepted=sum(r['selection']['status']=='selected' for r in rows),statuses={s:sum(r['selection']['status']==s for r in rows) for s in ['selected','needs_target','unreadable','incomplete','no_text']},candidate_cer=float(np.mean([r['candidate_metrics']['cer'] for r in rows])),candidate_wer=float(np.mean([r['candidate_metrics']['wer'] for r in rows])),raw_target_cer=float(np.mean([r['raw_target_metrics']['cer'] for r in rows])),mean_selection_seconds=float(np.mean([r['selection_seconds'] for r in rows])),provider_errors=sum(bool(r['provider_error']) for r in rows))
    accepted=[r for r in rows if r['selection']['status']=='selected']
    summary['accepted_cer']=float(np.mean([r['candidate_metrics']['cer'] for r in accepted])) if accepted else None
    summary['accepted_wer']=float(np.mean([r['candidate_metrics']['wer'] for r in accepted])) if accepted else None
    summary['raw_target_wer']=float(np.mean([r['raw_target_metrics']['wer'] for r in rows]))
    summary['status_matches_annotation']=sum(r['status_matches_annotation'] for r in rows)
    summary['best_candidate_cer_oracle_diagnostic']=float(np.mean([r['best_candidate_diagnostic']['metrics']['cer'] if r['best_candidate_diagnostic'] else 1 for r in rows]))
    if args.mode=='production':
        route_statuses={}
        route_seconds=[]
        for row in rows:
            response=row['selection'].get('production_response')
            diagnostic=row.get('provider_diagnostic')
            status=response['status'] if response else (diagnostic.get('status','bridge_error') if diagnostic else 'bridge_error')
            route_statuses[status]=route_statuses.get(status,0)+1
            if response:route_seconds.append(row['selection']['route_seconds'])
            elif diagnostic and 'elapsed_ms' in diagnostic:route_seconds.append(diagnostic['elapsed_ms']/1000)
        summary['production_route_statuses']=route_statuses
        summary['mean_production_route_seconds']=float(np.mean(route_seconds)) if route_seconds else None
    save_json(dest/'summary.json',summary);print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Run the generalized selector against the 11 manually annotated regression photos.')
    parser.add_argument('--images-dir',type=Path,required=True,help='Directory containing the nine original glasses photos.')
    parser.add_argument('--reddit-images-dir',type=Path,required=True,help='Directory containing the two Reddit regression photos.')
    parser.add_argument('--baseline-dir',type=Path,default=REPO_ROOT/'artifacts/ocr-experiment/iteration-3-english',help='Cached OCR result root for the nine original photos.')
    parser.add_argument('--reddit-baseline-dir',type=Path,default=REPO_ROOT/'artifacts/ocr-experiment/reddit-unseen',help='Cached OCR result root for the two Reddit photos.')
    parser.add_argument('--output',required=True);parser.add_argument('--mode',choices=['local','multimodal','production'],default='local');parser.add_argument('--intent',default='');parser.add_argument('--reuse-raw',action='store_true');parser.add_argument('--reread',action='store_true');parser.add_argument('--all-views',action='store_true',help='Send original and all mapped crop observations, including overlapping alternatives, as native does');parser.add_argument('--rec-model',default=str(REPO_ROOT/'artifacts/ocr-experiment/models/en_PP-OCRv3_rec_infer.onnx'));parser.add_argument('--rec-keys',default=str(REPO_ROOT/'artifacts/ocr-experiment/models/en_dict.txt'));run(parser.parse_args())
