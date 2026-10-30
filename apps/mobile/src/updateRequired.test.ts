import { describe, expect, test, vi } from 'vitest';

const store = vi.hoisted(() => ({ notified: 0 }));

vi.mock('react', () => ({
  useSyncExternalStore: (
    subscribe: (listener: () => void) => () => void,
    snapshot: () => boolean,
  ) => {
    subscribe(() => {
      store.notified += 1;
    });
    return snapshot();
  },
}));

const {
  ANSWER_WINDOW_MS,
  cameToForeground,
  createUpdateGate,
  isBelow,
  setUpdateRequired,
  storeUrl,
  useModalOpen,
} = await import('./updateRequired.ts');

describe('isBelow', () => {
  test.each([
    ['1.9.0', '1.10.0', true],
    ['1.10.0', '1.9.0', false],
    ['1.4.0', '1.4.0', false],
    ['1.4.0', '1.4.1', true],
    ['2.0.0', '1.99.99', false],
    ['0.0.0', '0.0.1', true],
  ])('%s against a minimum of %s is below: %s', (build, minimum, below) => {
    expect(isBelow(build, minimum)).toBe(below);
  });

  test('no minimum is never below', () => {
    expect(isBelow('0.0.0', null)).toBe(false);
  });

  test.each(['1.2', 'v1.2.0', 'latest', '', '1.2.0\n'])(
    'a minimum of %j is not a version, so a failed check',
    (minimum) => {
      expect(isBelow('0.0.0', minimum)).toBeNull();
    },
  );

  test.each([null, undefined, '', 'dev'])(
    'a build version of %j is treated as at the minimum',
    (build) => {
      expect(isBelow(build, '9.0.0')).toBe(false);
    },
  );
});

describe('storeUrl', () => {
  test('Android opens Google Play for com.soirely.app', () => {
    expect(storeUrl('android', undefined)).toBe(
      'https://play.google.com/store/apps/details?id=com.soirely.app',
    );
  });

  test("iOS opens Soirely's App Store page", () => {
    expect(storeUrl('ios', '1234567890')).toBe('https://apps.apple.com/app/id1234567890');
  });

  test("an iOS build made without an App Store id opens the store's search for Soirely", () => {
    expect(storeUrl('ios', undefined)).toBe('https://apps.apple.com/search?term=Soirely');
  });
});

describe('createUpdateGate', () => {
  function gate() {
    const onChange = vi.fn();
    return { gate: createUpdateGate(onChange), onChange };
  }

  test('a below answer within the window shows the state', () => {
    const { gate: g, onChange } = gate();
    g.opened(0);
    g.answered(true, g.check, ANSWER_WINDOW_MS);

    expect(g.showing).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('a below answer after the window never covers the screen in use', () => {
    const { gate: g } = gate();
    g.opened(0);
    g.answered(true, g.check, ANSWER_WINDOW_MS + 1);

    expect(g.showing).toBe(false);
  });

  test('a late below answer shows the state at once on the next return', () => {
    const { gate: g } = gate();
    g.opened(0);
    g.answered(true, g.check, 5000);
    g.opened(60_000);

    expect(g.showing).toBe(true);
  });

  test("the kept state goes only when that return's check answers at or above", () => {
    const { gate: g } = gate();
    g.opened(0);
    g.answered(true, g.check, 5000);
    g.opened(60_000);
    g.answered(null, g.check, 60_100);
    expect(g.showing).toBe(true);

    g.answered(false, g.check, 60_200);
    expect(g.showing).toBe(false);
  });

  test('a failed check changes nothing', () => {
    const { gate: g } = gate();
    g.opened(0);
    g.answered(null, g.check, 10);

    expect(g.showing).toBe(false);
  });

  test("an at-or-above answer to an earlier opening's check does not take the state away", () => {
    const { gate: g } = gate();
    g.opened(0);
    const earlier = g.check;
    g.answered(true, earlier, 10);
    g.opened(60_000);
    g.answered(false, earlier, 60_010);

    expect(g.showing).toBe(true);
  });

  test("a below answer to an earlier opening's check is kept, not shown", () => {
    const { gate: g } = gate();
    g.opened(0);
    const earlier = g.check;
    g.opened(1000);
    g.answered(true, earlier, 1100);
    expect(g.showing).toBe(false);

    g.opened(60_000);
    expect(g.showing).toBe(true);
  });
});

describe('cameToForeground', () => {
  test('background to active is a return', () => {
    expect(cameToForeground('background', 'active')).toBe(true);
  });

  test('inactive to active, Control Center or a notification pulled down and back, is not', () => {
    expect(cameToForeground('inactive', 'active')).toBe(false);
  });

  test('going to the background is not', () => {
    expect(cameToForeground('active', 'background')).toBe(false);
  });
});

describe('useModalOpen', () => {
  test('an open sheet gives way while the state shows, and comes back when it goes', () => {
    expect(useModalOpen(true)).toBe(true);

    const before = store.notified;
    const g = createUpdateGate(setUpdateRequired);
    g.opened(0);
    g.answered(true, g.check, 10);

    expect(store.notified).toBeGreaterThan(before);
    expect(useModalOpen(true)).toBe(false);

    g.opened(60_000);
    g.answered(false, g.check, 60_010);

    expect(useModalOpen(true)).toBe(true);
  });

  test('a closed sheet stays closed', () => {
    expect(useModalOpen(false)).toBe(false);
  });
});
