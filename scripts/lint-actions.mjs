#!/usr/bin/env node
/*
 * Lints the GitHub Actions workflows, in Docker.
 *
 * Same reasoning as the PHP tooling: nobody should need actionlint installed,
 * and everyone should get the same version. It runs shellcheck over every
 * `run:` block, which is the part worth having — a CI script is shell nobody
 * reviews as carefully as the code it checks, and the first draft of this
 * repository's workflow had an `A && B || C` that is not if-then-else and would
 * have written two different values into the same output.
 *
 * Exits 0 with a message when there are no workflows yet, so this is safe to
 * wire into lint before one exists.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const IMAGE = 'rhysd/actionlint:1.7.7';
const DIR = '.github/workflows';

if (!existsSync(DIR) || readdirSync(DIR).every((f) => !/\.ya?ml$/.test(f))) {
  console.log(`actionlint: no workflows in ${DIR} yet — nothing to check.`);
  process.exit(0);
}

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker is not running, and actionlint runs in a container.');
  console.error('Start Docker and try again.');
  process.exit(1);
}

const result = spawnSync(
  'docker',
  ['run', '--rm', '--volume', `${process.cwd()}:/repo`, '--workdir', '/repo', IMAGE],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
