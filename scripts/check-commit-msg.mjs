#!/usr/bin/env node
/*
 * Checks the subject line only.
 *
 * The body is where the reasoning goes and no machine should have opinions
 * about it. The subject is what shows up in a log, a blame and a release note,
 * so it is worth holding to a shape.
 */
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'chore', 'refactor', 'test', 'docs', 'perf', 'build', 'ci', 'revert'];
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: .{1,}$`);
const MAX = 72;

const path = process.argv[2];
if (!path) process.exit(0);

const subject = readFileSync(path, 'utf8').split('\n')[0].trim();

// Merges, reverts and fixups are git's wording, not ours.
if (/^(Merge|Revert|fixup!|squash!)/.test(subject)) process.exit(0);
if (subject === '') process.exit(0);

const problems = [];
if (!PATTERN.test(subject)) {
  problems.push(`must look like "type(scope): outcome" — type is one of: ${TYPES.join(', ')}`);
}
if (subject.length > MAX) {
  problems.push(`subject is ${subject.length} characters; keep it to ${MAX}`);
}
if (/\.$/.test(subject)) {
  problems.push('no full stop at the end of the subject');
}
const afterColon = subject.split(': ')[1];
if (afterColon && /^[A-Z][a-z]/.test(afterColon)) {
  problems.push('start the description lowercase');
}

if (problems.length) {
  console.error(`\n  ✗ ${subject}\n`);
  for (const p of problems) console.error(`    - ${p}`);
  console.error('\n  Name the outcome, not the mechanism.');
  console.error('  e.g. feat(api): refuse a route with no access policy\n');
  process.exit(1);
}
