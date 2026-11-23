import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { reportHeight, tallestAt } from './oneHeight.ts';

const screen = vi.hoisted(() => ({ fontScale: 1.6, width: 320, language: 'en' }));

vi.mock('react', async (actual) => ({
  ...(await actual<typeof import('react')>()),
  useContext: () => null,
  useMemo: <T>(make: () => T) => make(),
  useState: <T>(initial: T) => [initial, () => undefined],
}));
vi.mock('react-native', () => ({
  View: 'View',
  useWindowDimensions: () => ({ fontScale: screen.fontScale, width: screen.width }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: screen.language } }),
}));

const { OneHeight } = await import('./OneHeight.tsx');

/** The view holding the buttons: its key changing is what remounts each one, so each reports its height again. */
function buttonsKey(): string | null {
  const provider = OneHeight({ children: null }) as ReactElement<{ children: unknown }>;
  const inner = provider.props.children;
  if (!isValidElement(inner)) throw new Error('OneHeight no longer wraps its buttons in one view');

  return inner.key;
}

describe('OneHeight', () => {
  it('remounts its buttons under a new language, so the tallest, whose frame did not change, reports again', () => {
    screen.language = 'en';
    const english = buttonsKey();
    screen.language = 'fr';

    expect(buttonsKey()).not.toBe(english);
  });

  it('remounts its buttons under a new text size or width', () => {
    const before = buttonsKey();
    screen.fontScale = 2;
    const larger = buttonsKey();
    screen.width = 375;

    expect(larger).not.toBe(before);
    expect(buttonsKey()).not.toBe(larger);
  });

  it('keeps its buttons mounted while nothing changes', () => {
    expect(buttonsKey()).toBe(buttonsKey());
  });
});

describe('reportHeight', () => {
  it('keeps the tallest at one text size', () => {
    const now = [48, 90, 60].reduce((tallest, h) => reportHeight(tallest, 'a', h), {
      at: 'a',
      height: 0,
    });

    expect(tallestAt(now, 'a')).toBe(90);
  });

  it('forgets the tallest once the text size changes, so the buttons can shrink', () => {
    const now = reportHeight({ at: 'a', height: 90 }, 'b', 48);

    expect(tallestAt({ at: 'a', height: 90 }, 'b')).toBeUndefined();
    expect(tallestAt(now, 'b')).toBe(48);
  });
});
