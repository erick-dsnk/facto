import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

async function main() {
// Public development evidence only. No providers, sessions or held-out loaders.
const usage = 'Usage: node --import tsx replay-citation-fallback.ts --old-root PATH --fixed-root PATH --input RUN06_JSON --json-output PATH --markdown-output PATH';
const { values } = parseArgs({ options: {
  'old-root': { type: 'string' }, 'fixed-root': { type: 'string' }, input: { type: 'string' },
  'json-output': { type: 'string' }, 'markdown-output': { type: 'string' }, help: { type: 'boolean' },
}, strict: true, allowPositionals: false });
if (values.help) { console.log(usage); return; }
for (const key of ['old-root', 'fixed-root', 'input', 'json-output', 'markdown-output'] as const) {
  assert.ok(values[key], `Missing --${key}. ${usage}`);
}
const oldRoot = resolve(values['old-root']!);
const fixedRoot = resolve(values['fixed-root']!);
const inputPath = resolve(values.input!);
const jsonOutput = resolve(values['json-output']!);
const markdownOutput = resolve(values['markdown-output']!);
assert.notEqual(jsonOutput, markdownOutput, 'Output paths must be distinct');
assert.notEqual(jsonOutput, inputPath, 'Do not overwrite captured input');
assert.notEqual(markdownOutput, inputPath, 'Do not overwrite captured input');
const scriptPath = fileURLToPath(import.meta.url);
const expectedOldSHA = '7e278906bd20e4460c431eeef4b6dd93f76a0acb';
const expectedFixedSHA = '893e95965e12a60ab3f94558b7b0806493291a3b';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const git = (root: string, args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
for (const [root, expected] of [[oldRoot, expectedOldSHA], [fixedRoot, expectedFixedSHA]]) {
  assert.equal(git(root, ['rev-parse', 'HEAD']), expected, `Unexpected source revision: ${root}`);
  assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no']), '', `Tracked source changes: ${root}`);
}

const inputText = await readFile(inputPath, 'utf8');
const input = JSON.parse(inputText);
const publicCase = input.cases.find((record: { label: string }) => record.label === 'L1-opera');
assert.ok(publicCase, 'Public L1-opera case missing');
const captured = publicCase.evidence.find((stage: { stage: string }) => stage.stage === 'judgment');
const answers = publicCase.attempts.find((attempt: { answers?: { verdict?: unknown } }) => attempt.answers?.verdict).answers;
const judgment = {
  label: answers.verdict.choice,
  probabilities: answers.verdict.probabilities,
  evidence: captured.records,
  selectedEvidenceIds: captured.selectedEvidenceIds,
  checkedText: publicCase.admittedPublic[0],
  sourceAssessments: captured.sourceAssessments,
  claimRisk: captured.claimRisk,
  originAssessments: captured.originAssessments,
  misleadingReason: null,
  misleadingEvidenceIds: [],
};
assert.equal(judgment.label, 'supported');
assert.equal(judgment.checkedText, 'The Sydney Opera House opened in 1973.');
const oldPolicy = await import(pathToFileURL(`${oldRoot}/services/api/src/policy/verdict.ts`).href);
const fixedPolicy = await import(pathToFileURL(`${fixedRoot}/services/api/src/policy/verdict.ts`).href);
const oldDecision = oldPolicy.decideVerdict(structuredClone(judgment));
const fixedDecision = fixedPolicy.decideVerdict(structuredClone(judgment));
assert.equal(oldDecision.reasonCode, 'no_agreeing_citation');
assert.equal(fixedDecision.verdict, 'supported');
assert.deepEqual(fixedDecision.selectedEvidenceIds, ['ev-98bba1d289c45e2bce3a', 'ev-c6ef4b33746b6e519887']);

function replaySelection(selectedEvidenceIds: string[]) {
  const variant = { ...structuredClone(judgment), selectedEvidenceIds };
  const result = (policy: typeof oldPolicy) => {
    try { return { outcome: 'decision', decision: policy.decideVerdict(structuredClone(variant)) }; }
    catch (error) {
      assert.ok(error instanceof Error);
      return { outcome: 'error', errorCode: 'code' in error ? String(error.code) : error.name };
    }
  };
  return { syntheticMutation: true, mutation: 'Only preferred selection is replaced; captured evidence and scores are unchanged.', selectedEvidenceIds, old: result(oldPolicy), fixed: result(fixedPolicy) };
}
const none = replaySelection([]);
const invalid = replaySelection(['synthetic-not-retained-id']);
assert.equal(none.old.decision?.reasonCode, 'no_agreeing_citation');
assert.equal(none.fixed.decision?.reasonCode, 'no_agreeing_citation');
assert.equal(invalid.old.errorCode, 'invalid_citation');
assert.equal(invalid.fixed.errorCode, 'invalid_citation');

async function policyFiles(root: string) {
  return Object.fromEntries(await Promise.all(['verdict.ts', 'sources.ts', 'assessment.ts'].map(async name => [name, sha256(await readFile(`${root}/services/api/src/policy/${name}`, 'utf8'))])));
}
const oldFiles = await policyFiles(oldRoot);
const fixedFiles = await policyFiles(fixedRoot);
assert.equal(oldFiles['sources.ts'], fixedFiles['sources.ts']);
assert.equal(oldFiles['assessment.ts'], fixedFiles['assessment.ts']);
const artifact = {
  schemaVersion: 1,
  kind: 'offline_captured_public_judgment_replay',
  generatedAt: new Date().toISOString(),
  code: { old: { commit: expectedOldSHA, worktree: oldRoot, policyFilesSHA256: oldFiles }, fixed: { commit: expectedFixedSHA, worktree: fixedRoot, policyFilesSHA256: fixedFiles }, sourceQualityAndAssessmentFilesIdentical: true },
  input: { path: inputPath, sha256: sha256(inputText), caseLabel: publicCase.label, stage: 'first_judgment', capturedProviderCallsReplayed: 0 },
  reproduction: { scriptPath, scriptSHA256: sha256(await readFile(scriptPath, 'utf8')), arguments: { oldRoot, fixedRoot, inputPath, jsonOutput, markdownOutput }, exactRevisionAndCleanTrackedWorktreeGuards: true },
  capturedPublicJudgment: judgment,
  capturedNamedProviderAnswers: answers,
  decisions: { old: oldDecision, fixed: fixedDecision },
  qualifiedCitationsSelectedByFixedPolicy: fixedDecision.selectedEvidenceIds.map((id: string) => {
    const evidence = judgment.evidence.find((source: { id: string }) => source.id === id);
    return { id, url: evidence.url, stance: evidence.stance, stanceProbability: evidence.stanceProbability, directlyAddressesClaim: evidence.directlyAddressesClaim, matchesTimePlaceAndPopulation: evidence.matchesTimePlaceAndPopulation, sourceAssessment: judgment.sourceAssessments[id] };
  }),
  syntheticNegativeSelectionMutations: { none, invalid },
  limitations: [
    'Offline replay of one captured public development judgment; no provider or fresh end-to-end calls were made.',
    'Provider judgments and retrieval passages are held fixed. This isolates deterministic citation selection and does not establish general provider accuracy.',
    'The Queen Elizabeth memorial citation returned HTTP 403 in the separate prior citation review. Passing captured model/policy gates is not independent verification of that page and supplies no new citation-access evidence.',
    'Fixed policy uses only existing retained citations after all existing evidence, conflict, source-quality and risk-specific gates pass; thresholds and source registry are unchanged.',
    'None and invalid-selection variants are explicitly synthetic mutations, not observed provider outcomes.',
    'No held-out or sealed evaluation material is read by this script.',
  ],
};
await mkdir(dirname(jsonOutput), { recursive: true });
await mkdir(dirname(markdownOutput), { recursive: true });
await writeFile(jsonOutput, `${JSON.stringify(artifact, null, 2)}\n`);
const citations = artifact.qualifiedCitationsSelectedByFixedPolicy.map((source: { id: string; url: string; sourceAssessment: { confidence: number } }) => `- \`${source.id}\`: ${source.url}; substantive probability ${source.sourceAssessment.confidence}.`).join('\n');
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const invocation = `node --import tsx ${quote(scriptPath)} --old-root ${quote(oldRoot)} --fixed-root ${quote(fixedRoot)} --input ${quote(inputPath)} --json-output ${quote(jsonOutput)} --markdown-output ${quote(markdownOutput)}`;
const markdown = `# Offline citation fallback replay\n\nPublic run06 L1-opera first judgment is replayed unchanged against old policy \`${expectedOldSHA}\` and fixed #17 policy \`${expectedFixedSHA}\`. Source-quality and assessment implementation hashes match.\n\nThe captured preferred citation \`ev-a38cbdd50b89785e9ddf\` has substantive probability 0.84, below the existing 0.85 source gate. Two other retained sources pass all unchanged gates. Old policy returns \`insufficient_evidence / no_agreeing_citation\`; fixed policy returns \`supported / qualifying_evidence\`, selecting only:\n\n${citations}\n\nThe Queen Elizabeth memorial URL returned HTTP 403 in the separate prior citation review. Passing these captured model/policy gates is not independent verification of that page and provides no new citation-access evidence. This known access limitation remains unresolved by the replay.\n\nSynthetic selection-only mutations preserve fail-closed behavior: explicit none returns \`no_agreeing_citation\` under both versions; an invalid retained ID raises \`invalid_citation\` under both. Captured evidence and scores are unchanged in these mutations.\n\nCreate exact detached checkouts from a clone containing both commits (choose any available worktree paths):\n\n\`\`\`sh\ngit worktree add --detach /tmp/citation-old ${expectedOldSHA}\ngit worktree add --detach /tmp/citation-fixed ${expectedFixedSHA}\nnpm ci --prefix /tmp/citation-old\nnpm ci --prefix /tmp/citation-fixed\n\`\`\`\n\nRun from the fixed checkout so Node can resolve its installed tsx loader. Every path is an explicit CLI argument; the script has no workspace-path defaults:\n\n\`\`\`sh\ncd /tmp/citation-fixed\nnode --import tsx /path/to/replay-citation-fallback.ts --old-root /tmp/citation-old --fixed-root /tmp/citation-fixed --input /path/to/live-development-06.json --json-output /path/to/citation-fallback-replay.json --markdown-output /path/to/citation-fallback-replay.md\n\`\`\`\n\nInvocation used for this artifact (run from a checkout with tsx installed):\n\n\`\`\`sh\n${invocation}\n\`\`\`\n\nThe script requires clean tracked source at both exact revisions; revision guards remain fixed. Output directories are created as needed, and captured input cannot be overwritten. The JSON includes script/input/code hashes, actual public retained records, named model answers, decisions, and negative mutations.\n\nThis is captured-judgment replay, not fresh end-to-end or provider success. It isolates a deterministic citation-selection defect; it does not establish general fact-checking accuracy or a live coverage gain. No providers, original private input, secrets, or sealed material are accessed.\n`;
await writeFile(markdownOutput, markdown);
console.log(JSON.stringify({ old: oldDecision, fixed: fixedDecision, negativeNone: none.fixed, negativeInvalid: invalid.fixed, artifacts: [jsonOutput, markdownOutput] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
