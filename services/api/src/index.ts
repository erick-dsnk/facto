import { readFile } from 'node:fs/promises';
import { buildServer } from './transport/server.js';
import { fixtureAdapters } from './runtime/fixtures.js';
import { createJevClient } from './providers/jev/client.js';
import { createClassifier } from './providers/jev/classification.js';
import { createJudge } from './providers/jev/judgment.js';
import { createRetriever } from './providers/exa/retrieval.js';
import { createDeepgramAdapter, parseKeyterms } from './input/asr/deepgram-adapter.js';
import { DebugFeed } from './runtime/debug-feed.js';

const mode = process.env.PIPELINE_MODE ?? 'fixture';
if (mode !== 'fixture' && mode !== 'live') throw new Error('PIPELINE_MODE must be fixture or live.');
if (mode === 'live' && (!process.env.JEV_API_KEY || !process.env.EXA_API_KEY)) throw new Error('Live mode requires JEV_API_KEY and EXA_API_KEY.');
const client = createJevClient({ apiKey: process.env.JEV_API_KEY ?? '' });
// Debug only: logs every final Deepgram result, including what bystanders said. Off unless set to 1.
const debugTranscripts = process.env.DEBUG_TRANSCRIPTS === '1';
const debugFeed = debugTranscripts ? new DebugFeed() : undefined;
const adapters = mode === 'fixture' ? fixtureAdapters() : { classify: createClassifier(client), retrieve: createRetriever({ apiKey: process.env.EXA_API_KEY! }), retrieveAlternate: createRetriever({ apiKey: process.env.EXA_API_KEY!, queryStrategy: 'balanced_evidence' }), judge: createJudge(client) };
const cert = process.env.TLS_CERT_PATH; const key = process.env.TLS_KEY_PATH;
if (!!cert !== !!key) throw new Error('Set both TLS_CERT_PATH and TLS_KEY_PATH.');
// Railway routes every request through one edge proxy and needs the server on all interfaces for its healthcheck.
const onRailway = !!(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT);
const trustProxy = Number(process.env.TRUST_PROXY || (onRailway ? '1' : '0'));
if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY must be the number of proxy hops in front of the server (0 when clients connect directly).');
const deepgramKey = process.env.DEEPGRAM_API_KEY;
// Text and OCR checks still work without ASR, so a missing key is loud at startup rather than fatal.
if (mode === 'live' && !deepgramKey) console.warn('DEEPGRAM_API_KEY is not set: live mode has no speech recognition and audio.start fails with asr_unavailable.');
const { app } = await buildServer({ adapters, mode, joinCode: process.env.DEMO_JOIN_CODE ?? '', joinExpiresAt: Date.parse(process.env.DEMO_JOIN_EXPIRES_AT ?? ''),
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()), tls: cert && key ? { cert: await readFile(cert), key: await readFile(key) } : undefined, trustProxy,
  debugFeed,
  asr: deepgramKey ? createDeepgramAdapter({ apiKey: deepgramKey, keyterms: parseKeyterms(process.env.DEEPGRAM_KEYTERMS), transcriptLog: debugFeed ? entry => { console.info(`[asr:final] ${JSON.stringify(entry)}`); debugFeed.push('asr.final', entry); } : undefined }) : undefined });
await app.listen({ host: process.env.HOST || (onRailway ? '0.0.0.0' : '127.0.0.1'), port: Number(process.env.PORT ?? '3000') });
console.info(`Actually API listening (${mode} mode, audio ${deepgramKey ? 'on' : 'off'}${debugTranscripts ? ', transcript debug log ON' : ''}). No alert does not mean verified.`);
const stop = async () => { await app.close(); process.exit(0); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
