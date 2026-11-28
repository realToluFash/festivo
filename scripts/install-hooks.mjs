#!/usr/bin/env node
/*
 * Installs the git hooks, when there are git hooks to install.
 *
 * `npm ci` runs `prepare`, and it runs it inside Docker images and CI
 * containers that have no `.git` directory. `lefthook install` exits non-zero
 * there, which fails the whole install for a reason that has nothing to do
 * with the dependencies — and the error names lefthook rather than the missing
 * directory, so it reads as a broken tool.
 *
 * Skipped explicitly rather than with `|| true`, so a lefthook that fails for
 * a real reason still fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.git')) {
  console.log('lefthook: no .git directory here — skipping hook installation.');
  process.exit(0);
}

const result = spawnSync('lefthook', ['install'], { stdio: 'inherit', shell: true });

process.exit(result.status ?? 1);
