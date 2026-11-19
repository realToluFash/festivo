import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLanguage } from '../i18n/index.ts';
import { Menu, type MenuItem } from './SettingsParts.tsx';

const NARROW = ' ';
const NO_BREAK = ' ';

function items(count: number): MenuItem[] {
  return [
    { key: 'all', word: 'All', count },
    { key: 'coming', word: 'Coming', count: 0 },
  ];
}

function counts(): string[] {
  return screen
    .getAllByRole('menuitemradio')
    .map((row) => row.querySelector('.desk-menu-count')?.textContent ?? '');
}

function draw(count: number, open = true) {
  return render(
    <Menu
      items={items(count)}
      picked="all"
      open={open}
      onOpen={() => {}}
      onClose={() => {}}
      onPick={() => {}}
    />,
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await setLanguage(null);
});

describe("the filter menu writes its counts in the language's number format (sc-47250)", () => {
  it.each([
    ['en', '1,384', '13,840'],
    ['es', '1384', '13.840'],
    ['fr', `1${NARROW}384`, `13${NARROW}840`],
    ['pt', '1384', `13${NO_BREAK}840`],
  ])('in %s, the button and every row', async (language, four, five) => {
    await setLanguage(language);

    const { rerender } = draw(1384);

    expect(screen.getByRole('button', { name: /All/u }).textContent).toBe(`All · ${four}`);
    expect(counts()).toEqual([four, '0']);

    rerender(
      <Menu
        items={items(13_840)}
        picked="all"
        open
        onOpen={() => {}}
        onClose={() => {}}
        onPick={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /All/u }).textContent).toBe(`All · ${five}`);
    expect(counts()).toEqual([five, '0']);
  });

  it('keeps a count below a thousand as it is', async () => {
    await setLanguage('fr');
    draw(384);

    expect(counts()).toEqual(['384', '0']);
  });

  it("writes Portuguese's grouping on a browser whose region is Brazil", async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pt-BR');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
    await setLanguage('pt');

    const { rerender } = draw(1384);

    expect(counts()).toEqual(['1384', '0']);

    rerender(
      <Menu
        items={items(13_840)}
        picked="all"
        open
        onOpen={() => {}}
        onClose={() => {}}
        onPick={() => {}}
      />,
    );

    expect(counts()).toEqual([`13${NO_BREAK}840`, '0']);
  });

  it('rewrites the button and the open menu when the language changes', async () => {
    await setLanguage('en');
    draw(1384);

    expect(counts()).toEqual(['1,384', '0']);

    await act(() => setLanguage('fr'));

    expect(screen.getByRole('button', { name: /All/u }).textContent).toBe(`All · 1${NARROW}384`);
    expect(counts()).toEqual([`1${NARROW}384`, '0']);
  });
});
