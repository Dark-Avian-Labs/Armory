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

  const run = spawnSync(step.command, {
    stdio: 'inherit',
    shell: true,
  });

  const success = run.status === 0;
  results.push({ name: step.name, success });
}

console.log('\n=== Summary ===');
for (const result of results) {
  if (result.success) {
    console.log(`[${color.green}✓${color.reset}] ${result.name}`);
  } else {
    console.log(`[${color.red}✗${color.reset}] ${result.name} Failed`);
  }
}

const hasFailures = results.some((result) => !result.success);
if (hasFailures) {
  process.exitCode = 1;
}
