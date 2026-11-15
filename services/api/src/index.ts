import { readFile } from 'node:fs/promises';
import { buildServer } from './transport/server.js';
import { fixtureAdapters } from './runtime/fixtures.js';
import { createJevClient } from './providers/jev/client.js';
import { DEFAULT_MIN_CAPTURE_CONFIDENCE, createClassifier } from './providers/jev/classification.js';
import { createJudge } from './providers/jev/judgment.js';
import { createRetriever } from './providers/exa/retrieval.js';
import { createDeepgramAdapter } from './input/asr/deepgram-adapter.js';
import { DebugFeed } from './runtime/debug-feed.js';
import { createVisionTargetSelector } from './input/ocr/target-selection.js';

const mode = process.env.PIPELINE_MODE ?? 'fixture';
if (mode !== 'fixture' && mode !== 'live') throw new Error('PIPELINE_MODE must be fixture or live.');
if (mode === 'live' && (!process.env.JEV_API_KEY || !process.env.EXA_API_KEY)) throw new Error('Live mode requires JEV_API_KEY and EXA_API_KEY.');
const client = createJevClient({ apiKey: process.env.JEV_API_KEY ?? '' });
const minCaptureConfidence = Number(process.env.MIN_CAPTURE_CONFIDENCE || DEFAULT_MIN_CAPTURE_CONFIDENCE);
if (!Number.isFinite(minCaptureConfidence) || minCaptureConfidence < 0 || minCaptureConfidence > 1) throw new Error('MIN_CAPTURE_CONFIDENCE must be a number from 0 to 1.');
// Debug only: logs every final Deepgram result, including what bystanders said. Off unless set to 1.
const debugTranscripts = process.env.DEBUG_TRANSCRIPTS === '1';
// The in-memory feed needs a separate operator key of 16+ characters. The join code never opens it, and without the key nothing is recorded.
const debugFeedKey = process.env.DEBUG_FEED_KEY ?? '';
if (debugTranscripts && debugFeedKey.length < 16) console.warn('DEBUG_FEED_KEY is unset or shorter than 16 characters: the debug feed is off.');
const debugFeed = debugTranscripts && debugFeedKey.length >= 16 ? new DebugFeed() : undefined;
const adapters = mode === 'fixture' ? fixtureAdapters() : { classify: createClassifier(client, { minCaptureConfidence }), retrieve: createRetriever({ apiKey: process.env.EXA_API_KEY! }), retrieveAlternate: createRetriever({ apiKey: process.env.EXA_API_KEY!, queryStrategy: 'balanced_evidence' }), judge: createJudge(client) };
const cert = process.env.TLS_CERT_PATH; const key = process.env.TLS_KEY_PATH;
if (!!cert !== !!key) throw new Error('Set both TLS_CERT_PATH and TLS_KEY_PATH.');
// Railway routes every request through one edge proxy and needs the server on all interfaces for its healthcheck.
const onRailway = !!(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT);
const trustProxy = Number(process.env.TRUST_PROXY || (onRailway ? '1' : '0'));
if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY must be the number of proxy hops in front of the server (0 when clients connect directly).');
const deepgramKey = process.env.DEEPGRAM_API_KEY;
const visionBaseURL = process.env.OCR_VISION_BASE_URL;
const visionModel = process.env.OCR_VISION_MODEL;
if (!!visionBaseURL !== !!visionModel) throw new Error('Set both OCR_VISION_BASE_URL and OCR_VISION_MODEL to enable remote OCR selection.');
const targetSelector = visionBaseURL && visionModel ? createVisionTargetSelector({ baseURL: visionBaseURL, model: visionModel, apiKey: process.env.OCR_VISION_API_KEY,
  timeoutMs: Number(process.env.OCR_VISION_TIMEOUT_MS || '12000'), maxTokens: Number(process.env.OCR_VISION_MAX_TOKENS || '1200') }) : undefined;
// Text and OCR checks still work without ASR, so a missing key is loud at startup rather than fatal.
if (mode === 'live' && !deepgramKey) console.warn('DEEPGRAM_API_KEY is not set: live mode has no speech recognition and audio.start fails with asr_unavailable.');
const { app } = await buildServer({ adapters, mode, joinCode: process.env.DEMO_JOIN_CODE ?? '', joinExpiresAt: Date.parse(process.env.DEMO_JOIN_EXPIRES_AT ?? ''),
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()), tls: cert && key ? { cert: await readFile(cert), key: await readFile(key) } : undefined, trustProxy,
  debugFeed, debugFeedKey,
  targetSelector,
  asr: deepgramKey ? createDeepgramAdapter({ apiKey: deepgramKey, transcriptLog: debugTranscripts ? entry => console.info(`[asr:final] ${JSON.stringify(entry)}`) : undefined }) : undefined });
await app.listen({ host: process.env.HOST || (onRailway ? '0.0.0.0' : '127.0.0.1'), port: Number(process.env.PORT ?? '3000') });
console.info(`Actually API listening (${mode} mode, audio ${deepgramKey ? 'on' : 'off'}, min capture confidence ${minCaptureConfidence}${debugTranscripts ? ', transcript debug log ON' : ''}). No alert does not mean verified.`);
const stop = async () => { await app.close(); process.exit(0); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
