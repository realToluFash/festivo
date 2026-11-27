#!/usr/bin/env node
// LocalStack checks signatures only for test/test. An .env copied before sc-1055 still says
// soirely / soirely-dev-secret, and .env wins over the compose defaults, so `just up` moves
// that exact pair across. Any other pair is somebody's choice and stays.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function migrateStorageKey(env) {
  const key = /^STORAGE_KEY=soirely(\s*(#.*)?)$/m;
  const secret = /^STORAGE_SECRET=soirely-dev-secret(\s*(#.*)?)$/m;
  if (!key.test(env) || !secret.test(env)) return env;
  return env.replace(key, 'STORAGE_KEY=test$1').replace(secret, 'STORAGE_SECRET=test$1');
}

if (process.argv[1] === new URL(import.meta.url).pathname && existsSync('.env')) {
  const before = readFileSync('.env', 'utf8');
  const after = migrateStorageKey(before);
  if (after !== before) {
    writeFileSync('.env', after);
    console.log(
      '.env: STORAGE_KEY and STORAGE_SECRET are now test/test, which LocalStack signs against.',
    );
  }
}
