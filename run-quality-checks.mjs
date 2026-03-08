import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'Formatting', command: 'npm run format' },
  { name: 'Lint', command: 'npm run lint' },
  { name: 'Typecheck', command: 'npm run typecheck' },
  { name: 'Tests', command: 'npm run test' },
];

const results = [];
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const color = {
  green: useColor ? '\x1b[32m' : '',
  red: useColor ? '\x1b[31m' : '',
  reset: useColor ? '\x1b[0m' : '',
};

for (const step of steps) {
  console.log(`\n=== ${step.name}: ${step.command} ===`);
  const startedAt = process.hrtime.bigint();

  const run = spawnSync(step.command, {
    stdio: 'inherit',
    shell: true,
  });
  const finishedAt = process.hrtime.bigint();
  const elapsedMs = Number(finishedAt - startedAt) / 1_000_000;
  const elapsedSeconds = elapsedMs / 1000;

  const success = run.status === 0;
  results.push({ name: step.name, success, elapsedSeconds });
  console.log(
    `--- ${step.name} completed in ${elapsedSeconds.toFixed(2)}s (${success ? 'PASS' : 'FAIL'}) ---`,
  );
}

console.log('\n=== Summary ===');
for (const result of results) {
  if (result.success) {
    console.log(
      `[${color.green}✓${color.reset}] ${result.name} (${result.elapsedSeconds.toFixed(2)}s)`,
    );
  } else {
    console.log(
      `[${color.red}✗${color.reset}] ${result.name} Failed (${result.elapsedSeconds.toFixed(2)}s)`,
    );
  }
}

const hasFailures = results.some((result) => !result.success);
if (hasFailures) {
  process.exitCode = 1;
}
