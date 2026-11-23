#!/usr/bin/env node
/*
 * Creates the test database and brings it up to the current migrations.
 *
 * Separate from the development database by a suffix rather than a different
 * name, so nobody points the suite at the real one by editing a single word.
 * Safe to re-run: it drops and recreates, which is the only way to be sure a
 * removed migration is actually gone. `--processes N` adds ParaTest's `_test1` to `_testN`.
 */
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { processes: { type: 'string', default: '0' } } });
const processes = Number(values.processes);
if (!Number.isInteger(processes) || processes < 0) {
  console.error(`--processes takes a whole number, not "${values.processes}".`);
  process.exit(1);
}

const steps = [
  ['doctrine:database:drop', ['--env=test', '--if-exists', '--force']],
  ['doctrine:database:create', ['--env=test']],
  ['doctrine:migrations:migrate', ['--env=test', '--no-interaction', '--allow-no-migration']],
];

const tokens = ['', ...Array.from({ length: processes }, (_, i) => String(i + 1))];

for (const token of tokens) {
  for (const [command, args] of steps) {
    process.stdout.write(`▸ ${command}${token ? ` (_test${token})` : ''}\n`);
    const r = spawnSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        '--env',
        `TEST_TOKEN=${token}`,
        'api',
        'php',
        'bin/console',
        command,
        ...args,
      ],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) {
      console.error(`\n${command} failed.`);
      process.exit(r.status ?? 1);
    }
  }
}
console.log(`\nTest database${tokens.length > 1 ? 's' : ''} ready.`);
