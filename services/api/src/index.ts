import { readFile } from 'node:fs/promises';
import { buildServer } from './transport/server.js';
import { fixtureAdapters } from './runtime/fixtures.js';
import { createJevClient } from './providers/jev/client.js';
import { createClassifier } from './providers/jev/classification.js';
import { createJudge } from './providers/jev/judgment.js';
import { createRetriever } from './providers/exa/retrieval.js';

const mode = process.env.PIPELINE_MODE ?? 'fixture';
if (mode !== 'fixture' && mode !== 'live') throw new Error('PIPELINE_MODE must be fixture or live.');
if (mode === 'live' && (!process.env.JEV_API_KEY || !process.env.EXA_API_KEY)) throw new Error('Live mode requires JEV_API_KEY and EXA_API_KEY.');
const client = createJevClient({ apiKey: process.env.JEV_API_KEY ?? '' });
const adapters = mode === 'fixture' ? fixtureAdapters() : { classify: createClassifier(client), retrieve: createRetriever({ apiKey: process.env.EXA_API_KEY! }), judge: createJudge(client) };
const cert = process.env.TLS_CERT_PATH; const key = process.env.TLS_KEY_PATH;
if (!!cert !== !!key) throw new Error('Set both TLS_CERT_PATH and TLS_KEY_PATH.');
const { app } = await buildServer({ adapters, mode, joinCode: process.env.DEMO_JOIN_CODE ?? '', joinExpiresAt: Date.parse(process.env.DEMO_JOIN_EXPIRES_AT ?? ''),
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()), tls: cert && key ? { cert: await readFile(cert), key: await readFile(key) } : undefined });
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? '3000') });
console.info(`Actually API listening (${mode} mode). No alert does not mean verified.`);
const stop = async () => { await app.close(); process.exit(0); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
