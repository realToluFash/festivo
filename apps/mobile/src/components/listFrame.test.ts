import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { LIST_GAP, PANE_TITLE_ROW, SETTINGS_PAGE, titleFoot } from './listFrame.ts';

vi.mock('react', () => ({ useMemo: vi.fn() }));
vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T>(styles: T) => styles,
    flatten: (style: unknown) => (Array.isArray(style) ? Object.assign({}, ...style) : style),
  },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: vi.fn() }));

const settings = join('app', 'settings');
const pages = readdirSync(settings).filter(
  (file) =>
    file.endsWith('.tsx') &&
    readFileSync(join(settings, file), 'utf8').includes('alone && <FrameTop'),
);

describe("a Settings page's title", () => {
  it('stands 16 above the first block on every page that scrolls its own top (sc-49170)', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages)
      expect(readFileSync(join(settings, page), 'utf8')).toMatch(
        /alone && <FrameTop style=\{titleFoot\(/,
      );
  });

  it("stands 16 above Members' card too, whose top ListAndPage draws (sc-49170)", () => {
    expect(readFileSync(join(settings, 'members.tsx'), 'utf8')).toMatch(/settingsTitle: true/);
    expect(readFileSync(join('src', 'components', 'ListAndPage.tsx'), 'utf8')).toMatch(
      /<FrameTop style=\{topStyle\} \/>/,
    );
  });
});

describe("a Settings page's title in the pane on its side (sc-39471, #88680)", () => {
  const panes = [
    'organisation',
    'sign-in-rules',
    'account',
    'security',
    'notifications',
    'personalisation',
  ];

  it('stands 40 from the pane’s top and 34 above the first block, as SummaryPage draws it', () => {
    const top = SETTINGS_PAGE.tabletLandscape.paddingTop + PANE_TITLE_ROW.paddingTop;
    const under = PANE_TITLE_ROW.paddingBottom + SETTINGS_PAGE.tabletLandscape.gap;

    expect([top, under]).toEqual([40, 34]);
  });

  it.each(panes)('%s puts its pane title in that row', (page) => {
    expect(readFileSync(join(settings, `${page}.tsx`), 'utf8')).toContain(
      '<View style={[besideRow.row, PANE_TITLE_ROW]}>',
    );
  });

  it('leaves Members out: its title heads the list column, and a person’s page has none', () => {
    expect(readFileSync(join(settings, 'members.tsx'), 'utf8')).not.toContain('PANE_TITLE_ROW');
  });
});

describe('titleFoot', () => {
  it("takes the page's gap from 16, so the title stands 16 above the first block (sc-49170)", () => {
    expect(titleFoot(SETTINGS_PAGE.phone)).toEqual({ marginBottom: 4 });
    expect(titleFoot({ gap: LIST_GAP })).toEqual({ marginBottom: -2 });
    expect(titleFoot({ paddingTop: 4 })).toEqual({ marginBottom: 16 });
  });
});
