/**
 * Test environment, for every suite in this app.
 *
 * Configuration is set directly rather than fetched: load() is tested on its
 * own, and making every other test stub a fetch to get past boot is how a suite
 * ends up testing its own harness.
 */
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

import { __setConfig } from './config.ts';
import { initI18n } from './i18n/index.ts';
import { __setSessionState } from './session.ts';

__setConfig({
  apiBaseUrl: 'http://api.test',
  mercureUrl: '',
  environment: 'test',
  google: {
    authorizeUrl: 'http://sandbox.test/google/authorize',
    clientId: 'soirely-web.test',
  },
  apple: {
    authorizeUrl: 'http://sandbox.test/apple/authorize',
    clientId: 'soirely-web.test',
  },
});

await initI18n();

// A loaded CI runner can take more than testing-library's default second to settle a screen.
configure({ asyncUtilTimeout: 3000 });

// jsdom lays nothing out, so it has neither of these; a step that takes focus asks both.
Element.prototype.scrollIntoView = function scrollIntoView() {};
window.matchMedia = (query) =>
  ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as never;

// Registered here because auto-cleanup only happens with `globals: true`, and
// without it one test's DOM leaks into the next — where the symptom is a
// duplicate-element error in a test that is perfectly correct.
// The session resets only after the unmount: a suite's own afterEach runs first.
afterEach(() => {
  cleanup();
  __setSessionState({ status: 'unknown' });
});
