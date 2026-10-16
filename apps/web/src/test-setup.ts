/**
 * Test environment, for every suite in this app.
 *
 * Configuration is set directly rather than fetched: load() is tested on its
 * own, and making every other test stub a fetch to get past boot is how a suite
 * ends up testing its own harness.
 */
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { __setConfig } from './config.ts';
import { initI18n } from './i18n/index.ts';

__setConfig({
  apiBaseUrl: 'http://api.test',
  mercureUrl: '',
  environment: 'test',
  google: {
    authorizeUrl: 'http://sandbox.test/google/authorize',
    tokenUrl: 'http://sandbox.test/google/token',
    clientId: 'soirely-web.test',
  },
});

await initI18n();

// Registered here because auto-cleanup only happens with `globals: true`, and
// without it one test's DOM leaks into the next — where the symptom is a
// duplicate-element error in a test that is perfectly correct.
afterEach(() => {
  cleanup();
});
