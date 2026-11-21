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
  type Line = { top: number; bottom: number; right: number };

  /** The card is 600 px wide, so p6's box runs from 381 to 395 px in from its left edge. */
  function place(lines: Record<string, Line[]>) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      right: 600,
    } as DOMRect);
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
      const word = this.startContainer.parentElement?.className ?? '';
      return (lines[word] ?? []) as unknown as DOMRectList;
    });
  }

  function line(top: number, right: number): Line {
    return { top, bottom: top + 20, right };
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

  it('is hidden once a line of the words reaches into its box', () => {
    place({ 'desk-says': [line(100, 420)], 'desk-on-card': [line(126, 300), line(146, 382)] });

    expect(drawCard()?.classList.contains('is-p6-covered')).toBe(true);
  });

  it('stays when the low line ends left of its box, as Payment reminders reads in Portuguese', () => {
    place({ 'desk-says': [line(100, 420)], 'desk-on-card': [line(110, 464), line(146, 380)] });

    expect(drawCard()?.classList.contains('is-p6-covered')).toBe(false);
  });

  it('stays when the words end above its box, whatever the step does', () => {
    place({
      'desk-says': [line(80, 420)],
      'desk-on-card': [line(125, 464)],
      'desk-step': [line(150, 500)],
    });

    expect(drawCard()?.classList.contains('is-p6-covered')).toBe(false);
  });

  it('stays when the words start below its box', () => {
    place({ 'desk-says': [line(100, 420)], 'desk-on-card': [line(163, 464)] });

    expect(drawCard()?.classList.contains('is-p6-covered')).toBe(false);
  });

  it('looks past a step held in a wrapper, as General’s read-only card holds it', () => {
    place({ 'desk-on-card': [line(100, 420)], 'desk-step': [line(150, 500)] });
    const { container } = render(
      <Card>
        <Says>Regras de entrada</Says>
        <div className="held">
          <OnCard>Só o organizador muda isto</OnCard>
          <CardStep label="Mudar" onClick={() => {}} />
        </div>
      </Card>,
    );

    expect(container.querySelector('.desk-summary')?.classList.contains('is-p6-covered')).toBe(
      false,
    );
  });

  it('is decided again when the words change height, without reloading', () => {
    const lines = { 'desk-says': [line(100, 420)], 'desk-on-card': [line(120, 464)] };
    place(lines);
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

    expect(card?.classList.contains('is-p6-covered')).toBe(false);
    lines['desk-on-card'] = [line(120, 464), line(140, 400)];
    resize();
    expect(card?.classList.contains('is-p6-covered')).toBe(true);
    lines['desk-on-card'] = [line(110, 464)];
    resize();
    expect(card?.classList.contains('is-p6-covered')).toBe(false);
  });

  it('is decided again when a box mounts above the words and moves them without a resize', async () => {
    const lines: Record<string, Line[]> = {
      'desk-says': [line(100, 420)],
      'desk-on-card': [line(120, 464)],
    };
    place(lines);
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

    expect(card?.classList.contains('is-p6-covered')).toBe(false);
    lines['desk-glass-tags'] = [line(20, 200)];
    lines['desk-on-card'] = [line(150, 464)];
    rerender(draw(true));
    await act(async () => {});
    expect(card?.classList.contains('is-p6-covered')).toBe(true);
  });

  it('is hidden only by its own rule, on a card 560 px or wider', () => {
    const css = readFileSync(join(import.meta.dirname, 'SettingsParts.css'), 'utf8');
    const wide = css.slice(css.indexOf('@container desk-summary (width >= 560px)'));

    expect(wide).toMatch(/\.desk-summary\.is-p6-covered > \.p6 \{\s*display: none;\s*\}/u);
  });
});
