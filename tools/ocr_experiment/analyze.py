#!/usr/bin/env python3
"""Derive selection-without-reread ablation and safe report excerpts from saved observations."""
import argparse,json,hashlib
from pathlib import Path
import cv2
import numpy as np
from run import select_target,text,metrics,normalize,transform_lines,in_target,save_json

def aggregate(records):
 return {name:dict(target_token_recall=float(np.mean([r[name]['target_token_recall'] for r in records])),
                   cer=float(np.mean([r[name]['cer'] for r in records])),wer=float(np.mean([r[name]['wer'] for r in records])),
                   output_tokens=sum(r[name]['output_tokens'] for r in records)) for name in records[0]}

def analyze(output):
 out=Path(output);results=json.loads((out/'results.json').read_text())['samples'];derived=[];rows=[];accepted=[]
 for r in results:
  screen=cv2.imread(str(out/r['id']/'screen.png'));s=select_target(screen,r['variants']['screen']['lines']);ls=s['lines'];candidate=text(ls)
  before=metrics(r['primary']['text'],candidate)
  original=transform_lines(ls,np.array(r['variants']['screen']['to_original']))
  spatial=1-sum(len(normalize(l['text']).split()) for l in in_target(original,r['primary']['bbox_norm'],r['shape']))/max(1,len(normalize(candidate).split()))
  derived.append(dict(id=r['id'],status=s['status'],kind=s['kind'],text=candidate,metrics=before,spatial_clutter_token_fraction=spatial))
  record={name:variants['target_region_metrics'] for name,variants in r['variants'].items() if name not in {'selected','oracle'}}
  record['selected_existing']=before;record['selected_reread']=r['variants']['selected']['metrics'];record['oracle']=r['variants']['oracle']['metrics'];rows.append(record)
  if s['status']=='selected':accepted.append(record)
 summary=dict(all9=aggregate(rows),automatic_accepted=aggregate(accepted),accepted_ids=[r['id'] for r in derived if r['status']=='selected'],
              ambiguity_ids=[r['id'] for r in derived if r['status']=='ambiguous'],truncated_ids=[r['id'] for r in derived if r['status']=='truncated'],
              mean_selected_existing_spatial_clutter=float(np.mean([r['spatial_clutter_token_fraction'] for r in derived])),
              screen_detected_ids=[r['id'] for r in results if r['screen_detection']['found']])
 manifest=[dict(id=r['id'],filename=r['filename'],sha256=r['sha256'],shape=r['shape']) for r in results]
 save_json(out/'manifest.json',manifest)
 (out/'manifest.sha256').write_text(hashlib.sha256((out/'manifest.json').read_bytes()).hexdigest()+'  manifest.json\n')
 save_json(out/'selection-only.json',dict(samples=derived,summary=summary))
 # Public target snippets only: never export full-screen rail/account transcripts into documentation.
 report=['## Final measured results','', '| Variant | Mean target token recall | Mean target CER | Mean target WER |','|---|---:|---:|---:|']
 for name,m in summary['all9'].items():report.append(f"| {name} | {m['target_token_recall']:.1%} | {m['cer']:.1%} | {m['wer']:.1%} |")
 report+=['','For raw/screen/image ablations these columns score the annotated target region. For selection-only/reread/oracle they score the entire candidate transcript, so added clutter is penalized. The selection-only variant reuses existing recognized lines; it adds no OCR pass. All-nine candidate quality includes the two ambiguous homepage candidates and the truncated post, whose text is withheld from automatic fact checking.','', '| Image | Automatic decision | Raw target excerpt | Selected reread excerpt | Raw target CER | Selected CER |','|---|---|---|---|---:|---:|']
 for r,s in zip(results,derived):
  a=r['variants']['raw']['target_region_text'].replace('\n',' / ').replace('|','\\|');b=r['variants']['selected']['text'].replace('\n',' / ').replace('|','\\|')
  report.append(f"| {r['id']} | {s['kind']}; {s['status']} | {a} | {b} | {r['variants']['raw']['target_region_metrics']['cer']:.1%} | {r['variants']['selected']['metrics']['cer']:.1%} |")
 (out/'report-results.md').write_text('\n'.join(report)+'\n')
 print(json.dumps(summary,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('output');analyze(p.parse_args().output)
