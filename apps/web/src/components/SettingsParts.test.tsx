import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLanguage } from '../i18n/index.ts';
import { Card, CardStep, Menu, type MenuItem, OnCard, Says } from './SettingsParts.tsx';

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
  vi.unstubAllGlobals();
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

describe('a card step', () => {
  it('wraps a long label inside its card, as the demo’s step-wraps rule draws it', () => {
    const css = readFileSync(join(import.meta.dirname, 'SettingsParts.css'), 'utf8');
    const rule = /^\.desk-step \{([^}]*)\}/mu.exec(css)?.[1] ?? '';

    expect(rule).toContain('min-height: var(--sizeHit);');
    expect(rule).toContain('max-width: 100%;');
    expect(rule).toContain('white-space: normal;');
    expect(rule).toContain('overflow-wrap: anywhere;');
    expect(rule).not.toMatch(/^\s*height:/mu);
    expect(css).toMatch(/^\.desk-step > svg \{\s*flex: none;\s*\}/mu);
  });
});

describe('p6 on a summary card (sc-77292)', () => {
  function place(bottoms: Record<string, number>) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const bottom = bottoms[this.className] ?? 0;
      return { top: 0, bottom } as DOMRect;
    });
  }

  function drawCard() {
    const { container } = render(
      <Card>
        <Says>Regras de entrada</Says>
        <OnCard>Uma linha por baixo</OnCard>
        <CardStep label="Mudar" onClick={() => {}} />
      </Card>,
    );

    return container.querySelector('.desk-summary');
  }

  it('is hidden once any of the words reaches below 145 px from the card’s top', () => {
    place({ 'desk-says': 120, 'desk-on-card': 146, 'desk-step': 190 });

    expect(drawCard()?.classList.contains('is-words-low')).toBe(true);
  });

  it('stays when the words end above it, whatever the step does', () => {
    place({ 'desk-says': 120, 'desk-on-card': 145, 'desk-step': 190 });

    expect(drawCard()?.classList.contains('is-words-low')).toBe(false);
  });

  it('looks past a step held in a wrapper, as General’s read-only card holds it', () => {
    place({ 'desk-says': 120, 'desk-on-card': 140, held: 190, 'desk-step': 190 });
    const { container } = render(
      <Card>
        <Says>Regras de entrada</Says>
        <div className="held">
          <OnCard>Só o organizador muda isto</OnCard>
          <CardStep label="Mudar" onClick={() => {}} />
        </div>
      </Card>,
    );

    expect(container.querySelector('.desk-summary')?.classList.contains('is-words-low')).toBe(
      false,
    );
  });

  it('is decided again when the words change height, without reloading', () => {
    const bottoms = { 'desk-says': 120, 'desk-on-card': 140, 'desk-step': 190 };
    place(bottoms);
    const seen: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          seen.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const card = drawCard();
    const resize = () => act(() => seen.forEach((callback) => callback([], {} as ResizeObserver)));

    expect(card?.classList.contains('is-words-low')).toBe(false);
    bottoms['desk-on-card'] = 170;
    resize();
    expect(card?.classList.contains('is-words-low')).toBe(true);
    bottoms['desk-on-card'] = 130;
    resize();
    expect(card?.classList.contains('is-words-low')).toBe(false);
  });

  it('is decided again when a box mounts above the words and moves them without a resize', async () => {
    const bottoms: Record<string, number> = {
      'desk-says': 120,
      'desk-on-card': 140,
      'desk-step': 190,
    };
    place(bottoms);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const draw = (tags: boolean) => (
      <Card>
        {tags && <div className="desk-glass-tags">Fornecedor</div>}
        <Says>Regras de entrada</Says>
        <OnCard>Uma linha por baixo</OnCard>
      </Card>
    );
    const { container, rerender } = render(draw(false));
    const card = container.querySelector('.desk-summary');
    await act(async () => {});

    expect(card?.classList.contains('is-words-low')).toBe(false);
    bottoms['desk-glass-tags'] = 40;
    bottoms['desk-on-card'] = 180;
    rerender(draw(true));
    await act(async () => {});
    expect(card?.classList.contains('is-words-low')).toBe(true);
  });

  it('is hidden only by its own rule, on a card 560 px or wider', () => {
    const css = readFileSync(join(import.meta.dirname, 'SettingsParts.css'), 'utf8');
    const wide = css.slice(css.indexOf('@container desk-summary (width >= 560px)'));

    expect(wide).toMatch(/\.desk-summary\.is-words-low > \.p6 \{\s*display: none;\s*\}/u);
  });
});
