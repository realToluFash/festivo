#!/usr/bin/env node
// Prints the services `just up` waits on, or with --after-migrations the ones it waits on
// after migrating. The choice lives in qa-env.mjs, which the QA harness copies alone.
import { composeServices, servicesAfterMigrations, servicesToWait } from './qa-env.mjs';

const services = composeServices(process.cwd());
const chosen = process.argv.includes('--after-migrations')
  ? servicesAfterMigrations(services)
  : servicesToWait(services);
if (chosen.length === 0) {
  console.error('stack-services: no services found in `docker compose config`');
  process.exit(1);
}
console.log(chosen.join(' '));
