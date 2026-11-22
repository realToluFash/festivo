import { describe, expect, it } from 'vitest';

import { holdLeaving, keptEditing, leaveThen, leaveWithoutAsking } from './leaveHeld.ts';

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

describe('one ask at a time (sc-82245)', () => {
  it('does nothing for a second way out while the ask is open, and tells it so', () => {
    const went: string[] = [];
    const stayed: string[] = [];
    const asked: (() => void)[] = [];
    const release = holdLeaving((go) => asked.push(go));

    leaveThen(() => went.push('/events'));
    leaveThen(
      () => went.push('/settings'),
      () => stayed.push('/settings'),
    );

    expect(asked).toHaveLength(1);
    expect(stayed).toEqual(['/settings']);
    asked[0]?.();
    expect(went).toEqual(['/events']);
    release();
  });

  it('keeps editing: the way out stays put, and taking it again asks again', () => {
    const went: string[] = [];
    const stayed: string[] = [];
    const asked: (() => void)[] = [];
    const release = holdLeaving((go) => asked.push(go));

    leaveThen(
      () => went.push('/events'),
      () => stayed.push('/events'),
    );
    keptEditing();
    leaveThen(() => went.push('/events'));

    expect(went).toEqual([]);
    expect(stayed).toEqual(['/events']);
    expect(asked).toHaveLength(2);
    release();
  });

  it('lets the screen go before going, so leaving does not ask twice', () => {
    const order: string[] = [];
    const release = holdLeaving(
      (go) => go(),
      () => order.push('dropped'),
    );

    leaveThen(() => order.push('went'));

    expect(order).toEqual(['dropped', 'went']);
    release();
  });

  it('does not ask when the session ended without the reader choosing it', () => {
    const went: string[] = [];
    const dropped: string[] = [];
    holdLeaving(
      () => went.push('asked'),
      () => dropped.push('dropped'),
    );

    leaveWithoutAsking();
    leaveThen(() => went.push('/welcome'));

    expect(dropped).toEqual(['dropped']);
    expect(went).toEqual(['/welcome']);
  });
});
