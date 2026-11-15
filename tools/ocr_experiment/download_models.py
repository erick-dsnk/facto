#!/usr/bin/env python3
"""Download the exact English recognition model/charset used by this development run."""
import argparse,hashlib,urllib.request
from pathlib import Path
FILES={
 'en_PP-OCRv3_rec_infer.onnx':('https://huggingface.co/spaces/RapidAI/RapidOCR/resolve/main/models/text_rec/en_PP-OCRv3_rec_infer.onnx?download=true','ef7abd8bd3629ae57ea2c28b425c1bd258a871b93fd2fe7c433946ade9b5d9ea'),
 'en_dict.txt':('https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.6/ppocr/utils/en_dict.txt','5662df9d2d03f0e8ca0d3b0649d6acbab904b6a14b3d3521463c71c37c668ce3'),
}
def download(destination):
 destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
 for name,(url,expected) in FILES.items():
  path=destination/name
  if not path.exists():
   with urllib.request.urlopen(url,timeout=120) as response:path.write_bytes(response.read())
  actual=hashlib.sha256(path.read_bytes()).hexdigest()
  if actual!=expected:raise RuntimeError(f'{name}: hash differs; refusing a different model: {actual}')
  print(path)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/junction-ocr-models');download(p.parse_args().output)
