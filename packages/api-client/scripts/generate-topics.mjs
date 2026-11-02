#!/usr/bin/env node
/** Writes src/topics.ts from the API's RealtimeTopic; --check fails when the committed copy differs. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/topics.ts');

/** @param {Record<string, string>} declared the API's topics, by name */
export function render(declared) {
  const entries = Object.entries(declared).map(([name, template]) => `  ${name}: '${template}',`);

  return [
    "/** Generated from the API's App\\Enum\\RealtimeTopic by `npm run generate:topics`: never edit it. */",
    'export const REALTIME_TOPICS = {',
    ...entries,
    '} as const;',
    '',
    'export type RealtimeTopicName = keyof typeof REALTIME_TOPICS;',
    '',
    'export function realtimeTopic(name: RealtimeTopicName, id: string): string {',
    "  return REALTIME_TOPICS[name].replace('{id}', id);",
    '}',
    '',
  ].join('\n');
}

function declared() {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'api', 'php', 'bin/console', 'app:realtime:topics'],
    { encoding: 'utf8', cwd: resolve(here, '../../..') },
  );

  if (result.status !== 0) {
    console.error(result.stderr);
    console.error("Could not read the API's topics. Is the stack up?  docker compose up -d");
    process.exit(1);
  }

  return JSON.parse(result.stdout);
}

if (process.argv[1] != null && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const generated = render(declared());

  if (!process.argv.includes('--check')) {
    writeFileSync(out, generated);
    console.log(`Wrote ${out}`);
  } else if (readFileSync(out, 'utf8') !== generated) {
    console.error("\nsrc/topics.ts is out of date with the API's RealtimeTopic.");
    console.error('Run `npm run generate:topics -w @soirely/api-client` and commit the result.\n');
    process.exit(1);
  } else {
    console.log('src/topics.ts matches the API.');
  }
}
