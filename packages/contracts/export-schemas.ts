import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { textInputSchema } from './src/index.js';
import { claimResultSchema, eventEnvelopeSchema } from './src/wire.js';

const directory = fileURLToPath(new URL('./schemas/', import.meta.url));
await mkdir(directory, { recursive: true });
const input = z.toJSONSchema(textInputSchema);
const text = input.properties?.text;
if (text && typeof text === 'object') { text.minLength = 1; text.maxLength = 800; }
const context = input.properties?.context;
if (context && typeof context === 'object') {
  context.description = 'At most two utterances; combined length <= 1200 Unicode code points. Server enforces the combined limit.';
  if (context.items && typeof context.items === 'object' && !Array.isArray(context.items)) context.items.maxLength = 1200;
}
input.description = 'Version 1 text input. Lengths and spans use Unicode code points (Swift unicodeScalars). Blank text is rejected.';
const result = z.toJSONSchema(claimResultSchema);
result.description = 'Version 1 result. Additional semantic invariants: checkedText equals the code-point sourceSpan of originalText; selectedEvidenceIds exist in unique retained evidence; definitive verdicts have a citation; expiry >= checkedAt. Validated by wire.ts.';
const envelope = z.toJSONSchema(eventEnvelopeSchema);
envelope.description = 'Version 1 server envelope. A claim.result payload conforms to claim-result.schema.json and includes requestId, claimId, revision. claim.waiting carries admissionAction=wait, reasonCode and ISO waitExpiresAt. capture.request carries reasonCode (voice_trigger) and asks the app to take one photo for OCR.';
for (const [name, schema] of Object.entries({ 'text-input': input, 'claim-result': result, 'event-envelope': envelope })) {
  await writeFile(`${directory}/${name}.schema.json`, `${JSON.stringify(schema, null, 2)}\n`);
}
