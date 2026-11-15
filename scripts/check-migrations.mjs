#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'services/api/migrations';

/** One quoted statement: a single- or double-quoted string handed straight to addSql. */
const QUOTED = /addSql\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

/** What writing-migrations says is too long to read on one line. */
const TOO_LONG = [
  { pattern: /^\s*CREATE TABLE\s+\S+\s*\(/i, what: 'a CREATE TABLE column list' },
  {
    pattern: /^\s*ALTER TABLE\s+\S+\s+.*,\s*(ADD|ALTER|DROP|RENAME)\b/i,
    what: 'a multi-clause ALTER',
  },
  { pattern: /^\s*(UPDATE|INSERT INTO)\b/i, what: 'a backfill' },
];

export function problemsIn(source) {
  const found = [];

  for (const [, , sql] of source.matchAll(QUOTED)) {
    const rule = TOO_LONG.find(({ pattern }) => pattern.test(sql));
    if (rule != null) found.push(`${rule.what}: ${sql.slice(0, 60)}…`);
  }

  return found;
}

function main() {
  const problems = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.php'))
    .flatMap((file) =>
      problemsIn(readFileSync(join(MIGRATIONS, file), 'utf8')).map(
        (problem) => `${file}: ${problem}`,
      ),
    );

  if (problems.length === 0) return;

  console.error('✗ A migration statement too long for one line is in a quoted string.');
  for (const problem of problems) console.error(`    - ${problem}`);
  console.error(
    "  Put it in a nowdoc, <<<'SQL', one column per line. See .claude/skills/writing-migrations.",
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
