// Section stills: trim transparent margins, then encode at 1600px wide.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Section stills: trim transparent margins, then encode at 1600px wide.
const stills = { 'inside.png': 'glasses-inside.webp', 'product.png': 'glasses-product.webp' };
const stillDir = join(root, 'blender/raw/stills');
if (existsSync(stillDir)) {
  mkdirSync(join(root, 'public/img'), { recursive: true });
  for (const [src, dst] of Object.entries(stills)) {
    const input = join(stillDir, src);
    if (!existsSync(input)) continue;
    const trimmed = join(stillDir, `trim-${src}`);
    execFileSync('magick', [input, '-trim', '+repage', '-bordercolor', 'none', '-border', '4%', trimmed]);
    execFileSync('cwebp', ['-quiet', '-q', '84', '-alpha_q', '90', '-m', '6', '-resize', '1600', '0', trimmed, '-o', join(root, 'public/img', dst)]);
    console.log(`still: ${dst}`);
  }
}
