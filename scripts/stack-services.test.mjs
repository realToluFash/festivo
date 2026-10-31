import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { servicesAfterMigrations, servicesToWait } from './qa-env.mjs';

const services = {
  postgres: { restart: 'unless-stopped' },
  'storage-init': { restart: 'no' },
  'notification-worker': {
    restart: 'unless-stopped',
    labels: { 'soirely.after-migrations': 'true' },
  },
  web: { restart: 'unless-stopped', labels: { other: 'true' } },
};

describe('the services a stack waits on', () => {
  it('leaves out one-shot containers and those that need the migrations', () => {
    expect(servicesToWait(services)).toEqual(['postgres', 'web']);
  });

  it('waits on the ones that need the migrations after migrating', () => {
    expect(servicesAfterMigrations(services)).toEqual(['notification-worker']);
  });
});

describe('compose.yaml', () => {
  const { services: stack } = parse(
    readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8'),
  );

  it('brings every lasting service back after Docker restarts', () => {
    const lasting = [...servicesToWait(stack), ...servicesAfterMigrations(stack)];

    expect(lasting.filter((name) => stack[name].restart !== 'unless-stopped')).toEqual([]);
  });
});
