// Live eval over HTTP and WebSocket against any running server: npm run evaluate:live -- --help
import { main } from './src/eval-live/cli.js';

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
