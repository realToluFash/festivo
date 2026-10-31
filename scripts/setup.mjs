#!/usr/bin/env node
/*
 * One command to get a clone ready to work on, whichever surface you are here for.
 *
 * It reports what it did and what it skipped, because a setup script that runs
 * silently leaves you guessing whether it worked.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const steps = [];

function run(label, command, args, { optional = false } = {}) {
  process.stdout.write(`\n▸ ${label}\n`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  const ok = result.status === 0;
  steps.push({ label, ok, optional });
  if (!ok && !optional) process.exitCode = 1;
  return ok;
}

function skip(label, why) {
  steps.push({ label, skipped: why });
  process.stdout.write(`\n▸ ${label}\n  skipped — ${why}\n`);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

run('Node dependencies', npm, ['install']);

if (existsSync('services/api/composer.json')) {
  run('PHP dependencies', 'node', ['scripts/php-tool.mjs', 'composer', 'install']);
} else {
  skip('PHP dependencies', 'services/api has no composer.json yet');
}

run('Git hooks', 'npx', ['lefthook', 'install'], { optional: true });

if (!existsSync('.env')) {
  if (existsSync('.env.example')) {
    run('Local environment', 'cp', ['.env.example', '.env'], { optional: true });
  } else {
    skip('Local environment', 'no .env.example yet');
  }
} else {
  skip('Local environment', '.env already exists');
}

/*
 * The JWT signing keypair, which is gitignored on purpose: a key committed to a
 * repository is a key every clone can sign tokens with. Each environment makes
 * its own, so this has to run on a fresh clone and in CI.
 *
 * Needs the api container, so it is optional here — `npm run setup` is also the
 * command somebody runs before the stack is up, and failing the whole setup for
 * this would be the wrong trade. `just keypair` does it afterwards.
 */
if (existsSync('services/api/config/jwt/private.pem')) {
  skip('JWT keypair', 'already generated');
} else {
  run(
    'JWT keypair',
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'api',
      'php',
      'bin/console',
      'lexik:jwt:generate-keypair',
      '--skip-if-exists',
    ],
    { optional: true },
  );
}

console.log('\n──────────────────────────────────────────');
for (const step of steps) {
  const mark = step.skipped ? '–' : step.ok ? '✓' : '✗';
  const note = step.skipped ? ` (${step.skipped})` : '';
  console.log(`  ${mark} ${step.label}${note}`);
}
console.log('──────────────────────────────────────────');
console.log(
  process.exitCode
    ? '\nSetup finished with errors. See above.\n'
    : '\nReady. `docker compose up -d` brings the stack up.\n',
);
