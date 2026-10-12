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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The repository root, from this file's own location rather than from the
 * caller's working directory.
 *
 * Earlier it was `process.cwd()`, which quietly made every invocation
 * depend on where you were standing: run from services/api, composer mounted
 * services/api as the root and created a second, empty composer.json beside the
 * real one. Derived from the script path, it is the same answer from anywhere.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const API_DIR = 'services/api';

/*
 * Each tool, with the directory it has to run in.
 *
 * They differ, and that is the whole reason this lives here rather than at the
 * call sites. composer needs the directory holding composer.json; php-cs-fixer
 * needs the repository root, because its config is there and its finder points
 * down into services/api from it.
 *
 * Getting that wrong is not loud: `npm run setup` ran composer at the
 * repository root, where there is no composer.json, so the documented
 * one-command setup of a fresh clone failed — and the error named composer
 * rather than the working directory. CI found it.
 */
const TOOLS = {
  'php-cs-fixer': { image: 'ghcr.io/php-cs-fixer/php-cs-fixer:3-php8.4', workdir: '.' },
  composer: { image: 'composer:2', workdir: API_DIR },
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

if (!tool || !TOOLS[tool]) {
  console.error(`usage: php-tool <${Object.keys(TOOLS).join('|')}> [args...]`);
  process.exit(2);
}

if (tool === 'php-cs-fixer' && !hasPhpSources(join(ROOT, API_DIR))) {
  console.log(`php-cs-fixer: no PHP sources in ${API_DIR} yet — nothing to check.`);
  process.exit(0);
}

if (!dockerAvailable()) {
  console.error('Docker is not running, and PHP tooling runs in a container.');
  console.error('Start Docker and try again.');
  process.exit(1);
}

// php-cs-fixer refuses multiple paths without an explicit config, and looks for
// a composer.json in the working directory to infer a PHP version — the
// repository root has neither. Both are supplied here rather than at every call
// site, so the hook and the npm script cannot drift apart.
const toolArgs =
  tool === 'php-cs-fixer' ? [args[0], '--config=.php-cs-fixer.dist.php', ...args.slice(1)] : args;

// The repository root is mounted whatever the tool, so a relative path in a
// config resolves the same way it does on the host. Only the working directory
// inside it differs, and that comes from TOOLS rather than from wherever the
// caller happened to be standing.
const dockerArgs = [
  'run',
  '--rm',
  '--volume',
  `${ROOT}:/work`,
  '--workdir',
  join('/work', TOOLS[tool].workdir),
  '--user',
  `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  TOOLS[tool].image,
  ...toolArgs,
];

const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
