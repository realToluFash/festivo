import { describe, expect, it } from 'vitest';

import { createServerClock } from './serverClock.ts';

describe('createServerClock', () => {
  const device = Date.parse('2026-11-14T15:10:00Z');

  it('reads the device clock until a response says otherwise', () => {
    expect(
      createServerClock(() => device)
        .now()
        .toISOString(),
    ).toBe('2026-11-14T15:10:00.000Z');
  });

  it('corrects a device ten minutes fast by the Date header', () => {
    const clock = createServerClock(() => device);

    clock.observe('Sat, 14 Nov 2026 15:00:00 GMT');

    expect(clock.now().toISOString()).toBe('2026-11-14T15:00:00.000Z');
  });

  it('re-measures on every response', () => {
    let at = device;
    const clock = createServerClock(() => at);

    clock.observe('Sat, 14 Nov 2026 15:00:00 GMT');
    at += 60_000;
    clock.observe('Sat, 14 Nov 2026 15:20:00 GMT');

    expect(clock.now().toISOString()).toBe('2026-11-14T15:20:00.000Z');
  });

  it.each([null, '', 'not a date'])('keeps the last offset when the header is %j', (header) => {
    const clock = createServerClock(() => device);

    clock.observe('Sat, 14 Nov 2026 15:00:00 GMT');
    clock.observe(header);

    expect(clock.now().toISOString()).toBe('2026-11-14T15:00:00.000Z');
  });
});
