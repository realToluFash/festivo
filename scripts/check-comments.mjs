#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

export const MAX_BLOCK_LINES = 3;
export const MAX_PER_FILE = 8;

export const CHECKED = /\.(ts|tsx|js|jsx|mjs|php|css)$/;

export const ANNOTATION =
  /@(param|return|var|extends|implements|template|throws|deprecated|psalm|phpstan|mago-expect|ts-expect-error|ts-ignore|type|see|link)\b|eslint-disable|stylelint-disable|prettier-ignore/;

const SLASH = /^\s*(\{\s*)?(\/\/|\/\*|\*(?!\/)|\*\/)/;

/** `#` opens a comment in PHP and nothing else here: it is a CSS id and a JS private field. */
const HASH = /^\s*#(?!\[)/;

export const EXEMPT = [
  { path: 'services/api/config/reference.php', because: 'generated from the bundle configuration' },
];

export function isChecked(file) {
  return CHECKED.test(file) && !EXEMPT.some((exemption) => exemption.path === file);
}

export function isComment(line, file = '') {
  return SLASH.test(line) || (file.endsWith('.php') && HASH.test(line));
}

export function isCounted(line, file = '') {
  return isComment(line, file) && !ANNOTATION.test(line);
}

export function blocks(lines, file = '') {
  const found = [];
  let run = [];

  for (const line of lines) {
    if (isCounted(line, file)) {
      run.push(line);
      continue;
    }

    if (run.length > 0) found.push(run);
    run = [];
  }

  if (run.length > 0) found.push(run);

  return found;
}

export function problemsFor(file, added) {
  const problems = [];
  const counted = added.filter((line) => isCounted(line, file));

  if (counted.length > MAX_PER_FILE) {
    problems.push(`${file}: ${counted.length} added comment lines (at most ${MAX_PER_FILE})`);
  }

  for (const block of blocks(added, file)) {
    if (block.length > MAX_BLOCK_LINES) {
      problems.push(`${file}: a ${block.length}-line comment — "${(block[1] ?? block[0]).trim()}"`);
    }
  }

  return problems;
}

function changedFiles(ref) {
  const args = ref
    ? ['diff', '--name-only', '--diff-filter=ACMR', `${ref}...HEAD`]
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];

  return git(args).split('\n').filter(Boolean);
}

function addedLines(file, ref) {
  const args = ref
    ? ['diff', '-U0', `${ref}...HEAD`, '--', file]
    : ['diff', '--cached', '-U0', '--', file];

  return git(args)
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function resolves(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);

    return true;
  } catch {
    return false;
  }
}

function argument(flag) {
  const at = process.argv.indexOf(flag);

  return at === -1 ? null : (process.argv[at + 1] ?? null);
}

if (process.argv[1] != null && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const against = argument('--against');

  if (against != null && !resolves(against)) {
    process.stderr.write(`\n  No commit named ${against}; nothing compared.\n\n`);
    process.exit(0);
  }

  const problems = changedFiles(against)
    .filter(isChecked)
    .flatMap((file) => problemsFor(file, addedLines(file, against)));

  if (problems.length > 0) {
    process.stderr.write('\n  ✗ Too much comment in this change.\n\n');

    for (const problem of problems) process.stderr.write(`    - ${problem}\n`);

    process.stderr.write(
      '\n  A comment earns its place by preventing a mistake. Design rationale goes\n' +
        '  in the pull request; the history of the work goes in the commit message.\n' +
        '  See .claude/skills/code-comments.\n\n',
    );
    process.exit(1);
  }
}
