#!/usr/bin/env node
/*
 * Creates the test database and brings it up to the current migrations.
 *
 * Separate from the development database by a suffix rather than a different
 * name, so nobody points the suite at the real one by editing a single word.
 * Safe to re-run: it drops and recreates, which is the only way to be sure a
 * removed migration is actually gone.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['doctrine:database:drop', ['--env=test', '--if-exists', '--force']],
  ['doctrine:database:create', ['--env=test']],
  ['doctrine:migrations:migrate', ['--env=test', '--no-interaction', '--allow-no-migration']],
];

for (const [command, args] of steps) {
  process.stdout.write(`▸ ${command}\n`);
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'api', 'php', 'bin/console', command, ...args],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(`\n${command} failed.`);
    process.exit(r.status ?? 1);
  }
}
console.log('\nTest database ready.');
