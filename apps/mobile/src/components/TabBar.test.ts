import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

interface Drawn {
  children?: ReactNode;
  size?: number;
  style?: unknown;
  onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
}

const drawn = vi.hoisted(() => ({ texts: [] as Drawn[], width: 320, windowWidth: 320 }));

vi.mock('react-native', () => {
  const box = ({ children }: { children?: ReactNode }) => children ?? null;

  return {
    Animated: {},
    PixelRatio: { get: () => 2 },
    Pressable: box,
    StyleSheet: { create: <T>(styles: T) => styles, absoluteFill: {}, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: drawn.windowWidth, height: 700, fontScale: 1 }),
    View: box,
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: drawn.width, height: 700 }),
  useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
}));
vi.mock('react-native-svg', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./Text.tsx', async () => {
  const react = await import('react');

  return {
    Text: (props: Drawn) => {
      drawn.texts.push(props);
      return null;
    },
    TitleCap: react.createContext(null),
  };
});
vi.mock('./BandLiveLine.tsx', () => ({}));
vi.mock('./CapsuleLabels.tsx', () => ({}));
vi.mock('./Cover.tsx', () => ({}));
vi.mock('./EventMesh.tsx', () => ({}));
vi.mock('./Glass.tsx', () => ({ Glass: () => null }));
vi.mock('./Glyph.tsx', () => ({ Glyph: () => null }));
vi.mock('./OrgMark.tsx', () => ({}));
vi.mock('./TodayRun.tsx', () => ({}));
vi.mock('./OrgPill.tsx', () => ({ OPENER: {} }));
vi.mock('./todayShell.ts', () => ({}));
vi.mock('./usePillFit.tsx', () => ({}));

const { TabBar } = await import('./TodayCover.tsx');

const WORDS = ['Today', 'Convidados'];

/** The bar's first render alone, as a new mount draws it: no layout or effect has run. */
function firstRender(width: number, windowWidth = width) {
  drawn.width = width;
  drawn.windowWidth = windowWidth;
  drawn.texts = [];
  renderToStaticMarkup(
    createElement(TabBar<string>, {
      tabs: WORDS.map((word) => [word, 'today'] as never),
      bottom: 0,
      at: 'Today',
      onTab: () => {},
      stepsBelowDefault: true,
    }),
  );

  return {
    measuring: drawn.texts.filter((text) => text.onLayout != null),
    labels: drawn.texts
      .filter((text) => text.onLayout == null)
      .map(({ size, style }) => ({ size, hidden: JSON.stringify(style).includes('"opacity":0') })),
  };
}

describe('the phone’s tab bar from its first frame (sc-99214)', () => {
  it('hides unmeasured labels, then a new bar draws them fitted to its own window at once', () => {
    const first = firstRender(320);
    expect(first.labels).toEqual(WORDS.map(() => ({ size: 12, hidden: true })));

    for (const text of first.measuring) {
      text.onLayout?.({ nativeEvent: { layout: { width: text.children === 'Today' ? 34 : 180 } } });
    }

    // (320 - 2 × (8 + 1 + 3)) / 2 = 148 a tab, so a word 180 wide at 12 fits at 9.9 and the floor holds it at 10.
    expect(firstRender(320).labels).toEqual(WORDS.map(() => ({ size: 10, hidden: false })));
    // (700 - 2 × (18 + 1 + 5) - 2) / 2 = 325 a tab.
    expect(firstRender(700).labels).toEqual(WORDS.map(() => ({ size: 12, hidden: false })));
    // Turned back upright: the frame is here with the insets, the window's width is still the sideways one.
    expect(firstRender(320, 700).labels).toEqual(WORDS.map(() => ({ size: 10, hidden: false })));
  });
});
