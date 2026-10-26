import { describe, expect, it } from 'vitest';

import { servicesAfterMigrations, servicesToWait } from './stack-services.mjs';

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
