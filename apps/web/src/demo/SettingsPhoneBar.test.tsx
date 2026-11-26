import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { mediaBlock } from '../test-styles.ts';
import { atPhoneWidth } from '../test-widths.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT_PHONE = mediaBlock(
  '(width <= 40rem)',
  readFileSync(join(import.meta.dirname, 'phone.css'), 'utf8'),
);

async function open(path: string): Promise<HTMLElement> {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  const main = await screen.findByRole('main', {}, WAIT);
  const shell = main.parentElement;
  if (shell == null) throw new Error(`no shell around the page on ${path}`);

  return shell;
}

describe('Settings and Your account at a phone’s width, under the product shell’s bar (sc-13413, sc-85513)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    atPhoneWidth();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    '/demo/settings/sign-in-rules',
    '/demo/settings/members',
    '/demo/settings/account',
    '/demo/settings/sign-in-rules?switcher=paused',
    '/demo/settings/account?switcher=paused-alone',
  ])('heads %s with the pill, Menu and the bell, and keeps the desk page', SLOW, async (path) => {
    const shell = await open(path);
    const bar = screen.getByRole('navigation', { name: 'Soirely' });

    expect(shell.classList.contains('dp-bar')).toBe(true);
    expect(shell.classList.contains('dp-fit')).toBe(false);
    expect(within(bar).getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /notification/iu })).toBeTruthy();
  });

  it('shows the bar’s pieces only, its name cut short, and the title row’s bell gone', () => {
    expect(AT_PHONE).toMatch(/\.dp-bar \.today-side > :not\(\.sw, \.dp-menu, \.desk-bell\),/u);
    expect(AT_PHONE).toMatch(/\.dp-bar \.today-side \.sw-opener-name,/u);
    expect(AT_PHONE).toMatch(/\.dp-bar \.desk-main \.desk-bell \{\s+display: none;/u);
  });

  it('runs the page flat to the window’s edges under the bar by the one desk rule, one line under the bar', () => {
    const reflow = mediaBlock(
      '(width <= 40rem)',
      readFileSync(join(import.meta.dirname, 'deskReflow.css'), 'utf8'),
    );

    expect(AT_PHONE).not.toMatch(/\.dp-bar:not\(\.dp-fit\) > \.desk-main/u);
    expect(AT_PHONE).toMatch(/\.dp-bar \.today-side,[\s\S]*?border-bottom: var\(--borderCard\);/u);
    expect(reflow).toMatch(
      /\.today\.desk:not\(\.dp-fit\) > \.desk-main \{[^}]*margin: 0;[^}]*border-radius: 0;[^}]*box-shadow: none;/u,
    );
    expect(reflow).toMatch(
      /\.today\.desk:not\(\.dp-fit, \.dp-bar\) > \.desk-main \{\s+border-top/u,
    );
  });
});
