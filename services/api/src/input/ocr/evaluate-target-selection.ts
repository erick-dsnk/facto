/** Local evaluation bridge through the real authenticated HTTP boundary. No photos are saved. */
import { readFile, writeFile } from 'node:fs/promises';
import { buildServer } from '../../transport/server.js';
import { fixtureAdapters } from '../../runtime/fixtures.js';
import { createVisionTargetSelector } from './target-selection.js';

const path = process.argv[2];
if (!path) throw new Error('Usage: tsx services/api/src/input/ocr/evaluate-target-selection.ts input.json');
const baseURL = process.env.OCR_VISION_BASE_URL;
const model = process.env.OCR_VISION_MODEL;
if (!baseURL || !model) throw new Error('Set OCR_VISION_BASE_URL and OCR_VISION_MODEL');
// Evaluation-only diagnostic tap: response content, never request image or credentials.
// Pass an ignored local artifact path as argv[3]; production startup has no such tap.
const diagnosticPath = process.argv[3];
const diagnosticFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  if (diagnosticPath) {
    const reader = response.clone().body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (reader) {
      try {
        while (bytes < 65_536) { const next = await reader.read(); if (next.done) break; const chunk = next.value.subarray(0, 65_536 - bytes); chunks.push(chunk); bytes += chunk.length; }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    await writeFile(diagnosticPath, JSON.stringify({ status: response.status, body: raw }, null, 2));
  }
  return response;
};
const server = await buildServer({ adapters: fixtureAdapters(), mode: 'fixture', joinCode: 'local-evaluation-only', joinExpiresAt: Date.now() + 300_000,
  targetSelector: createVisionTargetSelector({ baseURL, model, apiKey: process.env.OCR_VISION_API_KEY, timeoutMs: Number(process.env.OCR_VISION_TIMEOUT_MS || 60000), maxTokens: Number(process.env.OCR_VISION_MAX_TOKENS || 1200), fetch: diagnosticFetch }) });
try {
  const payload = await readFile(path, 'utf8');
  const sessionResponse = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode: 'local-evaluation-only' } });
  const session = sessionResponse.json<{ sessionId: string; token: string }>();
  const start = performance.now();
  const response = await server.app.inject({ method: 'POST', url: `/v1/sessions/${session.sessionId}/ocr/select-target`, headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' }, payload });
  console.log(JSON.stringify({ statusCode: response.statusCode, elapsedMs: Math.round(performance.now() - start), result: response.json() }));
} finally { await server.app.close(); }
