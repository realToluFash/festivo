import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, mediaBlock, stylesheet } from '../test-styles.ts';

const tested = config();
const NARROW = '(width <= 40rem)';
const PHONE = mediaBlock(NARROW, stylesheet(import.meta.dirname, 'phone.css'));

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

describe('Vendors leaves 16 px at 320 CSS px (sc-91795)', () => {
  it('runs its column to the frame’s 16 px gutter, with no padding or end margin of its own', () => {
    expect(cssRule('.dp-fit .desk-main:has(> .desk-list)', PHONE)).toContain(
      'padding-inline: var(--spaceXl);',
    );
    expect(cssRule('.dp-fit .desk-main > .desk-page:has(> .vd-column)', PHONE)).toMatch(
      /^\s*padding-inline: 0;\s+overflow: visible;\s*$/u,
    );
    expect(cssRule('.dp-fit .desk-page > .vd-column', PHONE)).toMatch(
      /^\s*margin-inline-end: 0;\s*$/u,
    );
  });

  it('opens each menu under the tools at the column’s width, inside the window', () => {
    expect(cssRule('.dp-fit .vd-tools', PHONE)).toContain('position: relative;');
    expect(cssRule('.dp-fit .vd-tools > .desk-menu-at', PHONE)).toContain('position: static;');
    expect(cssRule('.dp-fit .vd-tools .desk-menu', PHONE)).toMatch(
      /right: 0;\s+left: 0;\s+width: auto;/u,
    );
  });

  it('finds Vendors’ column and menus where the rules name them', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings/vendors'] });
    render(<RouterProvider router={router} />);
    const main = await screen.findByRole('main', {}, { timeout: 8000 });

    expect(main.closest('.today.desk.dp-fit')).not.toBeNull();
    expect(main.classList.contains('desk-main')).toBe(true);
    expect(main.querySelector(':scope > .desk-list')).not.toBeNull();
    const column = main.querySelector(':scope > .desk-page > .vd-column');
    expect(column).not.toBeNull();
    const tools = await screen.findByRole('search', {}, { timeout: 8000 });
    expect(tools.parentElement?.matches('.vd-column .vd-tools')).toBe(true);
    expect(tools.parentElement?.querySelectorAll(':scope > .desk-menu-at')).toHaveLength(2);
  });
});
