import { acquire, loadCohort, run, cohortPath } from './src/provider-eval/benchmark.js';
import { HELP, loadPacks, parseCli } from './src/provider-eval/cli.js';
async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.kind === 'help') { console.log(HELP); return; }
  if (cli.kind === 'acquire') { await acquire((await loadCohort(cli.casesPath ?? cohortPath)).slice(0, cli.limit), cli.evidenceOut); return; }
  const result = await run({ ...cli.options, packs: await loadPacks(cli.packFiles) });
  console.log(JSON.stringify(result.summary, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'evaluation_failed'); process.exitCode = 1; });
