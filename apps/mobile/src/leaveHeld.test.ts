import { describe, expect, it } from 'vitest';

import { holdLeaving, leaveThen } from './leaveHeld.ts';

describe('leaving a screen with unsaved work', () => {
  it('goes at once when nothing holds it', () => {
    const went: string[] = [];

    leaveThen(() => went.push('/events'));

    expect(went).toEqual(['/events']);
  });

  it('asks the holding screen, and goes only when it calls go', () => {
    const went: string[] = [];
    const asked: (() => void)[] = [];
    const release = holdLeaving((go) => asked.push(go));

    leaveThen(() => went.push('/'));
    expect(went).toEqual([]);

    asked[0]?.();
    expect(went).toEqual(['/']);
    release();
  });

  it('tells the destination the screen was discarded only when it asked', () => {
    const discarding: boolean[] = [];

    leaveThen((discarded) => discarding.push(discarded));
    const release = holdLeaving((go) => go());
    leaveThen((discarded) => discarding.push(discarded));
    release();

    expect(discarding).toEqual([false, true]);
  });

  it('goes at once after the reader has left, though the screen is still mounted', () => {
    const went: string[] = [];
    const asked: (() => void)[] = [];
    holdLeaving((go) => asked.push(go));

    leaveThen(() => went.push('/'));
    asked[0]?.();
    leaveThen(() => went.push('/settings'));

    expect(asked).toHaveLength(1);
    expect(went).toEqual(['/', '/settings']);
  });

  it('goes at once again once the screen lets go', () => {
    const went: string[] = [];
    const release = holdLeaving(() => {});

    release();
    leaveThen(() => went.push('/settings'));

    expect(went).toEqual(['/settings']);
  });

  it('keeps a newer hold when an older one lets go', () => {
    const went: string[] = [];
    const releaseOlder = holdLeaving(() => {});
    const releaseNewer = holdLeaving(() => {});

    releaseOlder();
    leaveThen(() => went.push('/'));

    expect(went).toEqual([]);
    releaseNewer();
  });
});
