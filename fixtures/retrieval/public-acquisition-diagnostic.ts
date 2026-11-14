/** Explicitly authorized public acquisition diagnostic; no judgment calls. */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AcceptedClaim, ProviderKind } from '../../packages/contracts/src/index.js';
import { buildAlternateQuery, buildHighlightQuery, mergeRetainedEvidence, normalizeUrl, RETRIEVAL_OBJECTIVE } from '../../services/api/src/evidence/normalize.js';
import { createRetriever } from '../../services/api/src/providers/exa/retrieval.js';

const [reportPath, outputPath, resumePath] = process.argv.slice(2);
if (!reportPath || !outputPath || !process.env.EXA_API_KEY) throw new Error('diagnostic_configuration_missing');
const output = resolve(outputPath);
const reportBytes = await readFile(reportPath);
const report = JSON.parse(reportBytes.toString('utf8'));
const labels = ['L2-lightning', 'L4-mixed', 'L8-first-person'];
const cases = labels.map(label => {
  const sample = report.cases.find((item: { label: string }) => item.label === label);
  const event = sample?.events.find((item: { type: string; checkedPublicText?: string }) => item.type === 'claim.result' && item.checkedPublicText);
  if (!event || !sample.admittedPublic.includes(event.checkedPublicText)) throw new Error('public_report_span_missing');
  return { label, checkedText: event.checkedPublicText as string };
});
const limits = { search: 6, contents: 9, jev: 0, perClaimSearch: 2, perClaimContents: 3,
  requestBytes: 256 * 1024, responseBytes: 256 * 1024, totalRequestBytes: 1024 * 1024, wallMs: 60_000 };
const priorPlan = resumePath ? JSON.parse(await readFile(`${resumePath}/plan.json`, 'utf8')) : null;
const priorSummary = resumePath ? JSON.parse(await readFile(`${resumePath}/summary.json`, 'utf8')) : null;
const remainingMs = limits.wallMs - (priorPlan ? Date.now() - Date.parse(priorPlan.startedAt) : 0);
if (remainingMs <= 0) throw new Error('diagnostic_deadline');
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
if (resumePath && (priorPlan.reportSHA256 !== hash(reportBytes) || JSON.stringify(priorPlan.cases) !== JSON.stringify(cases)
  || priorSummary.attempts.length !== 1 || priorSummary.attempts[0].httpStatus !== 200
  || priorSummary.totals.search !== 1 || priorSummary.totals.contents !== 0 || priorSummary.totals.jev !== 0)) throw new Error('diagnostic_resume_rejected');
await mkdir(output, { recursive: false });
const sources = ['services/api/src/providers/exa/retrieval.ts', 'services/api/src/providers/exa/client.ts', 'services/api/src/evidence/normalize.ts'];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async path => [path, hash(await readFile(path))])));
await writeFile(`${output}/plan.json`, JSON.stringify({ kind: 'public_acquisition_diagnostic', startedAt: new Date().toISOString(),
  resumePath: resumePath ? resolve(resumePath) : null, originalStartedAt: priorPlan?.startedAt ?? null, reportPath: resolve(reportPath), reportSHA256: hash(reportBytes), cases, limits, sourceHashes,
  interpretation: 'Acquisition only. No engine verdicts or judgments; indexed content is not proof of current origin accessibility.' }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ phase: 'limits_recorded_before_dispatch', limits, output }));
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(new Error('diagnostic_deadline')), remainingMs);
const began = performance.now();
const totals = priorSummary?.totals ?? { search: 0, contents: 0, jev: 0, requestBytes: 0, responseBytes: 0 };
let replayed = false;
const attempts: Record<string, unknown>[] = priorSummary?.attempts ?? [];
const outcomes: Record<string, unknown>[] = [];
try {
  for (const sample of cases) {
    const counts = { search: 0, contents: 0 };
    const urls = new Set<string>();
    const highlightOptions = { query: buildHighlightQuery(sample.checkedText), maxCharacters: 4000 };
    const trackedFetch: typeof fetch = async (url, init) => {
      controller.signal.throwIfAborted();
      const endpoint = String(url);
      const kind = endpoint === 'https://api.exa.ai/search' ? 'search' : endpoint === 'https://api.exa.ai/contents' ? 'contents' : null;
      if (!kind || init?.method !== 'POST' || typeof init.body !== 'string') throw new Error('diagnostic_operation_rejected');
      const body = JSON.parse(init.body);
      if (kind === 'search') {
        const alternate = body.query === buildAlternateQuery(sample.checkedText, 'balanced_evidence');
        const expected = { query: alternate ? buildAlternateQuery(sample.checkedText, 'balanced_evidence') : sample.checkedText,
          type: 'auto', numResults: alternate ? 8 : 5, objective: RETRIEVAL_OBJECTIVE, contents: { highlights: highlightOptions } };
        if (JSON.stringify(body) !== JSON.stringify(expected)) throw new Error('diagnostic_query_rejected');
      } else {
        const expected = { urls: body.urls, text: { maxCharacters: 12000 }, highlights: highlightOptions, livecrawl: 'preferred', livecrawlTimeout: 1500 };
        if (!Array.isArray(body.urls) || body.urls.length !== 1 || !urls.has(normalizeUrl(body.urls[0]) ?? '')
          || JSON.stringify(body) !== JSON.stringify(expected)) throw new Error('diagnostic_contents_rejected');
      }
      if (resumePath && !replayed && sample.label === labels[0] && kind === 'search' && body.query === sample.checkedText) {
        replayed = true;
        const bytes = await readFile(`${resumePath}/01-search-response.json`);
        if (hash(bytes) !== priorSummary.attempts[0].responseSHA256) throw new Error('diagnostic_resume_rejected');
        for (const page of JSON.parse(bytes.toString('utf8')).results ?? []) {
          const normalized = normalizeUrl(page.url);
          if (normalized) urls.add(normalized);
        }
        return new Response(bytes, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const requestBytes = Buffer.byteLength(init.body);
      if (requestBytes > limits.requestBytes || totals.requestBytes + requestBytes > limits.totalRequestBytes
        || totals[kind] >= limits[kind]) throw new Error('diagnostic_budget_exhausted');
      totals[kind]++; totals.requestBytes += requestBytes;
      const ordinal = attempts.length + 1;
      const prefix = `${String(ordinal).padStart(2, '0')}-${kind}`;
      const attempt: Record<string, unknown> = { ordinal, label: sample.label, kind, startedMs: performance.now() - began,
        requestBytes, requestSHA256: hash(init.body), requestFile: `${prefix}-request.json`, outcome: 'reserved' };
      attempts.push(attempt);
      await writeFile(`${output}/${prefix}-request.json`, init.body, { flag: 'wx' });
      await appendFile(`${output}/attempts.jsonl`, `${JSON.stringify(attempt)}\n`);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        attempt.httpStatus = response.status;
        if (!response.body || Number(response.headers.get('content-length')) > limits.responseBytes) {
          await response.body?.cancel(); throw new Error('diagnostic_response_limit');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const item = await reader.read();
            if (item.done) break;
            size += item.value.byteLength;
            if (size > limits.responseBytes) { await reader.cancel(); throw new Error('diagnostic_response_limit'); }
            chunks.push(item.value);
          }
        } finally { reader.releaseLock(); }
        const bytes = Buffer.concat(chunks);
        totals.responseBytes += bytes.byteLength;
        attempt.responseBytes = bytes.byteLength;
        attempt.responseSHA256 = hash(bytes);
        if (bytes.includes(process.env.EXA_API_KEY!)) throw new Error('diagnostic_response_redacted');
        await writeFile(`${output}/${prefix}-response.json`, bytes, { flag: 'wx' });
        attempt.responseFile = `${prefix}-response.json`;
        attempt.outcome = 'response';
        if (kind === 'search' && response.ok) {
          for (const page of JSON.parse(bytes.toString('utf8')).results ?? []) {
            const normalized = normalizeUrl(page.url);
            if (normalized) urls.add(normalized);
          }
        }
        return new Response(bytes, { status: response.status, headers: { 'content-type': 'application/json' } });
      } catch {
        attempt.outcome = controller.signal.aborted ? 'deadline' : 'failure';
        throw new Error('diagnostic_provider_failed');
      } finally {
        attempt.durationMs = performance.now() - began - Number(attempt.startedMs);
        await appendFile(`${output}/attempts.jsonl`, `${JSON.stringify(attempt)}\n`);
      }
    };
    const context = { signal: controller.signal, now: () => Date.now(),
      canConsume: (kind: 'contents') => counts[kind] < limits.perClaimContents,
      consume: (kind: ProviderKind) => {
        controller.signal.throwIfAborted();
        if (kind === 'jev' || counts[kind] >= (kind === 'search' ? limits.perClaimSearch : limits.perClaimContents)) throw new Error('diagnostic_claim_budget');
        counts[kind]++;
      } };
    const claim: AcceptedClaim = { id: sample.label, checkedText: sample.checkedText, originalText: sample.checkedText,
      sourceSpan: { start: 0, end: Array.from(sample.checkedText).length },
      admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'public_fact' } };
    const initial = await createRetriever({ apiKey: process.env.EXA_API_KEY, fetch: trackedFetch })(claim, context);
    const alternate = await createRetriever({ apiKey: process.env.EXA_API_KEY, fetch: trackedFetch, queryStrategy: 'balanced_evidence' })(claim, context);
    const retained = mergeRetainedEvidence(initial, alternate, sample.checkedText);
    outcomes.push({ ...sample, initial, alternate, retained, consumed: counts });
    await writeFile(`${output}/${sample.label}-evidence.json`, JSON.stringify(outcomes.at(-1), null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ phase: 'case_complete', label: sample.label, consumed: counts, retained: retained.length }));
  }
} catch {
  outcomes.push({ status: 'stopped', reason: controller.signal.aborted ? 'deadline' : 'diagnostic_failure' });
} finally {
  clearTimeout(timer);
  await writeFile(`${output}/summary.json`, JSON.stringify({ completed: outcomes.length === 3 && outcomes.every(item => Array.isArray(item.retained)) && !controller.signal.aborted,
    campaignDurationMs: Date.now() - Date.parse(priorPlan?.startedAt ?? new Date(Date.now() - (performance.now() - began)).toISOString()),
    durationMs: performance.now() - began, totals, attempts, outcomes }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ phase: 'finished', totals, durationMs: performance.now() - began }));
}
