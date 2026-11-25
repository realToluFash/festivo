import { readdirSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, mediaBlock, stylesheet } from '../test-styles.ts';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const SHEET = stylesheet(import.meta.dirname, 'deskReflow.css');
const AT_320 = mediaBlock('(width <= 40rem)', SHEET);
const DESK = '.today.desk:not(.dp-fit)';

async function shellOf(path: string): Promise<HTMLElement> {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  const main = await screen.findByRole('main', {}, WAIT);
  const shell = main.parentElement;
  if (shell == null) throw new Error(`no shell around the page on ${path}`);

  return shell;
}

describe('every desk page at 400% zoom, 320 CSS px (sc-32279)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  it('changes nothing from 641 px up: every rule sits in the one narrow block', () => {
    expect(AT_320).not.toBe('');
    expect(SHEET.match(/@media/gu)).toHaveLength(1);
  });

  it('stacks the sidebar above the page, both the window’s width, the page scrolling with the window', () => {
    expect(cssRule(DESK, AT_320)).toMatch(/flex-direction: column;\s+height: auto;/u);
    expect(cssRule(`${DESK} > .today-side`, AT_320)).toMatch(/width: auto;\s+height: auto;/u);
    expect(cssRule(`${DESK} > .desk-main`, AT_320)).toContain('overflow: visible;');
    expect(cssRule(`${DESK} .desk-page`, AT_320)).toContain('overflow: visible;');
  });

  it('runs the page flat to the window, its column at the product shell’s 16 px phone gutter (sc-91763)', () => {
    expect(cssRule(`${DESK} > .desk-main`, AT_320)).toMatch(/margin: 0;[\s\S]+box-shadow: none;/u);
    expect(cssRule(`${DESK} > .desk-main`, AT_320)).not.toContain('border-top');
    expect(cssRule('.today.desk:not(.dp-fit, .dp-bar) > .desk-main', AT_320)).toContain(
      'border-top: var(--borderCard);',
    );
    expect(cssRule(`${DESK} .desk-page`, AT_320)).toContain(
      'padding: var(--spaceXl) var(--spaceXl) var(--space3xl);',
    );
    expect(cssRule(`${DESK} > .desk-main > .st`, AT_320)).toContain(
      'margin-inline: var(--spaceXl);',
    );
    expect(cssRule(`${DESK} .st-top`, AT_320)).toContain('padding-inline: 0;');
    expect(cssRule(`${DESK} .mg-list`, AT_320)).toContain('padding-inline: var(--spaceXl);');
    expect(cssRule(`${DESK} .mg-in`, AT_320)).toContain('padding-inline: var(--spaceXl);');
  });

  it('wraps Seating’s switches inside the room, each word whole on its 44 px option, and steps what floats under the views down a row (sc-91763)', () => {
    expect(cssRule(`${DESK} .st-seg`, AT_320)).toMatch(
      /flex-wrap: wrap;\s+max-width: 100%;\s+height: auto;/u,
    );
    expect(cssRule(`${DESK} .st-views`, AT_320)).toContain(
      'max-width: calc(100% - 2 * var(--spaceLg));',
    );
    expect(cssRule(`${DESK} .st-views > .st-seg-one:last-child`, AT_320)).toContain(
      'flex-basis: 100%;',
    );
    expect(cssRule(`${DESK} .st-print`, AT_320)).toContain('top: 116px;');
    expect(
      cssRule(`${DESK} :is(.st-float.st-bar, .st-under-views, .st-view-wrap)`, AT_320),
    ).toContain('top: 118px;');
    expect(cssRule(`${DESK} .is-row-down .st-top-right`, AT_320)).toContain('top: 118px;');
    expect(cssRule(`${DESK} .is-row-down .st-print`, AT_320)).toContain('top: 176px;');
    expect(cssRule(`${DESK} .is-row-down :is(.st-under-views, .st-view-wrap)`, AT_320)).toContain(
      'top: 178px;',
    );
    expect(cssRule('.st-seg-one', SHEET)).toBe('');
    expect(cssRule('.st-seg-one', stylesheet(import.meta.dirname, 'seating.css'))).toMatch(
      /height: var\(--sizeHit\);[\s\S]+white-space: nowrap;/u,
    );
  });

  it('lets the open conversation’s header wrap, its name breaking inside its own line (sc-91763)', () => {
    expect(cssRule(`${DESK} .mg-head`, AT_320)).toContain('flex-wrap: wrap;');
    expect(cssRule(`${DESK} .mg-head-words`, AT_320)).toMatch(
      /flex: 1 1 10rem;\s+overflow-wrap: anywhere;/u,
    );
  });

  it('is the only copy: no area stacks the desk itself', () => {
    const copies = readdirSync(import.meta.dirname)
      .filter((file) => file.endsWith('.css') && file !== 'deskReflow.css')
      .filter((file) =>
        /\.today\.desk:has\([^)]+\) \.today-side \{\s+width: auto;/u.test(
          stylesheet(import.meta.dirname, file),
        ),
      );

    expect(copies).toEqual([]);
  });

  it.each([
    ['an event’s shell', '/demo/events/evt-wed-4?area=budget'],
    ['Settings’ shell', '/demo/settings/account'],
  ])('holds %s: the sidebar, then the page, straight inside the desk', SLOW, async (_, path) => {
    const shell = await shellOf(path);
    const parts = [...shell.children].map((part) => part.className);

    expect(shell.className.split(' ')).toEqual(expect.arrayContaining(['today', 'desk']));
    expect(shell.classList.contains('dp-fit')).toBe(false);
    expect(parts.indexOf('desk-main')).toBeGreaterThan(
      parts.findIndex((name) => name.split(' ').includes('today-side')),
    );
    expect(parts.findIndex((name) => name.split(' ').includes('today-side'))).toBe(0);
  });
});
