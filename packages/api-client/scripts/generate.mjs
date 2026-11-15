#!/usr/bin/env node
/*
 * Generates the wire types from the API's own OpenAPI document.
 *
 * Not hand-written, and not written twice. A client type maintained alongside
 * the server's serialisation is a second copy of a fact, and two copies of a
 * fact diverge — silently, because both sides typecheck perfectly while
 * disagreeing about what is on the wire.
 *
 * The previous build's version of this bug: a mobile test asserted against a
 * hand-written fixture, the fixture was shaped like what somebody expected, the
 * server sent something else. Every test passed and the screen was empty.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/schema.d.ts');
const url = process.env.OPENAPI_URL ?? 'http://localhost:8080/api/docs.json';

const response = await fetch(url).catch(() => null);

if (response == null || !response.ok) {
  console.error(`Could not read the OpenAPI document at ${url}`);
  console.error('Is the stack up?  docker compose up -d');
  process.exit(1);
}

const document = await response.text();
const temp = resolve(here, '../.openapi.json');
mkdirSync(dirname(temp), { recursive: true });
writeFileSync(temp, document);

const result = spawnSync('npx', ['openapi-typescript', temp, '-o', out], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${out}`);
