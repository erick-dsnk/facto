// Bake the Blender frames (blender/raw/<variant>/0000.png ...) onto the stage
// colour and encode one scrub-friendly MP4 per variant, plus the lens JSON.
// Short keyframe interval and no B-frames keep seeking cheap in every browser.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const EXPECTED = 360;
// #3B0E00 decodes to the page's #380C00 after BT.709 limited-range conversion.
const BAKE = '0x3B0E00';
const variants = { desktop: '1920x1080', mobile: '900x1600' };

mkdirSync(join(root, 'public/video'), { recursive: true });
for (const [name, size] of Object.entries(variants)) {
  const src = join(root, 'blender/raw', name);
  if (!existsSync(src)) {
    console.warn(`skip ${name}: no renders in ${src}`);
    continue;
  }
  const pngs = readdirSync(src).filter((f) => f.endsWith('.png'));
  if (pngs.length !== EXPECTED) console.warn(`${name}: expected ${EXPECTED} frames, found ${pngs.length}`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `color=c=${BAKE}:s=${size}:r=30`,
    '-framerate', '30', '-i', join(src, '%04d.png'),
    '-filter_complex', '[0][1]overlay=shortest=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
    '-g', '4', '-keyint_min', '4', '-sc_threshold', '0', '-bf', '0',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', '-an', join(root, 'public/video', `${name}.mp4`),
  ]);
  const lens = {};
  for (const f of readdirSync(src).filter((f) => f.startsWith('lens-') && f.endsWith('.json'))) {
    Object.assign(lens, JSON.parse(readFileSync(join(src, f), 'utf8')));
  }
  if (Object.keys(lens).length) writeFileSync(join(root, 'src/data', `lens-${name}.json`), JSON.stringify(lens));
  console.log(`${name}: ${pngs.length} frames -> public/video/${name}.mp4`);
}
