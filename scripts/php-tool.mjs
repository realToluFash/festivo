#!/usr/bin/env node
/*
 * Runs PHP tooling in Docker.
 *
 * Nobody should need a local PHP to work on this repository. The API runs in a
 * container, so its tooling does too — which also means every developer and CI
 * run uses the same version rather than whatever Homebrew last installed.
 *
 * Exits 0 with a message when there is no PHP to act on yet, so this is safe to
 * wire into lint and the pre-commit hook before the Symfony skeleton lands.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = 'services/api';

const IMAGES = {
  'php-cs-fixer': 'ghcr.io/php-cs-fixer/php-cs-fixer:3-php8.3',
  composer: 'composer:2',
};

function hasPhpSources(dir) {
  if (!existsSync(dir)) return false;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'vendor' || entry.name === 'var' || entry.name.startsWith('.')) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name.endsWith('.php')) return true;
    }
  }
  return false;
}

function dockerAvailable() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

const [tool, ...args] = process.argv.slice(2);

if (!tool || !IMAGES[tool]) {
  console.error(`usage: php-tool <${Object.keys(IMAGES).join('|')}> [args...]`);
  process.exit(2);
}

if (tool === 'php-cs-fixer' && !hasPhpSources(API_DIR)) {
  console.log(`php-cs-fixer: no PHP sources in ${API_DIR} yet — nothing to check.`);
  process.exit(0);
}

if (!dockerAvailable()) {
  console.error('Docker is not running, and PHP tooling runs in a container.');
  console.error('Start Docker and try again.');
  process.exit(1);
}

const cwd = process.cwd();
const dockerArgs = [
  'run',
  '--rm',
  '--volume',
  `${cwd}:/work`,
  '--workdir',
  '/work',
  '--user',
  `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  IMAGES[tool],
  ...args,
];

const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
