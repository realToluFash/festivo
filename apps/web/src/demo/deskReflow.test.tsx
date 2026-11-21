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
