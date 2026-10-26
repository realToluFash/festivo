#!/usr/bin/env node
// Prints the services `just up` waits on, or with --after-migrations the ones it waits on
// after migrating. The stack scripts import the same choice.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AFTER_MIGRATIONS = 'soirely.after-migrations';

const lasting = (service) => service.restart !== 'no';
const afterMigrating = (service) => service.labels?.[AFTER_MIGRATIONS] === 'true';

/** --wait fails when a one-shot init container exits 0, and on a service waiting for migrations. */
export function servicesToWait(services) {
  return Object.entries(services ?? {})
    .filter(([, service]) => lasting(service) && !afterMigrating(service))
    .map(([name]) => name);
}

export function servicesAfterMigrations(services) {
  return Object.entries(services ?? {})
    .filter(([, service]) => lasting(service) && afterMigrating(service))
    .map(([name]) => name);
}

export function composeServices(cwd) {
  const result = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`docker compose config failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout).services;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const services = composeServices(process.cwd());
  const chosen = process.argv.includes('--after-migrations')
    ? servicesAfterMigrations(services)
    : servicesToWait(services);
  if (chosen.length === 0) {
    console.error('stack-services: no services found in `docker compose config`');
    process.exit(1);
  }
  console.log(chosen.join(' '));
}
