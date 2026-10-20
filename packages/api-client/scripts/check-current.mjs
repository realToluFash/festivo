#!/usr/bin/env node
/*
 * Fails when the committed types no longer match what the API serves.
 *
 * The generated file is committed so a client can build without the stack
 * running — which also means it can go stale, silently, while every client
 * typechecks perfectly against a shape the server stopped sending.
 *
 * So CI regenerates and compares. This is the "assert the two agree" half of
 * generating from one source.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const generated = resolve(here, '../src/schema.d.ts');

const before = readFileSync(generated, 'utf8');

const result = spawnSync('node', [resolve(here, 'generate.mjs')], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

const after = readFileSync(generated, 'utf8');

if (before !== after) {
  console.error('\nsrc/schema.d.ts is out of date with the API.');
  console.error('Run `npm run generate -w @soirely/api-client` and commit the result.\n');
  process.exit(1);
}

console.log('Generated types match the API.');
