import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { STYLES, cssRule, mediaBlock, stylesheet } from '../test-styles.ts';

const tested = config();
const NARROW = '(width <= 40rem)';
const PEOPLE = mediaBlock(NARROW, stylesheet(import.meta.dirname, 'people.css'));
const REFLOW = mediaBlock(NARROW, stylesheet(import.meta.dirname, 'deskReflow.css'));
const SHELL = '.today.desk:has(.event-page.is-people)';

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

describe('People leaves the product’s 16 px at 320 CSS px (sc-91747)', () => {
  it('gives the page the shell’s gutter, flat to the window’s edges', () => {
    expect(cssRule(`${SHELL} > .desk-main`, PEOPLE)).toMatch(
      /margin: 0;\s+border-radius: 0;\s+box-shadow: none;/u,
    );
    expect(cssRule(`${SHELL} .desk-page`, PEOPLE)).toMatch(
      /^\s*padding-inline: var\(--spaceXl\);\s*$/u,
    );
  });

  it('is the gutter the product’s shell gives every page at this width, which stays as it is', () => {
    expect(STYLES).toMatch(
      /\n {2}\.shell \{\s+--shellBlock: var\(--spaceXl\);\s+--shellInline: var\(--spaceXl\);/u,
    );
  });

  it('is the gutter the general rule now gives every other desk page (sc-91763)', () => {
    expect(cssRule('.today.desk:not(.dp-fit) > .desk-main', REFLOW)).toMatch(
      /margin: 0;[\s\S]*border-radius: 0;\s+box-shadow: none;/u,
    );
    expect(cssRule('.today.desk:not(.dp-fit) .desk-page', REFLOW)).toContain(
      'padding: var(--spaceXl) var(--spaceXl) var(--space3xl);',
    );
  });

  it('finds People inside the desk the rule names', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/people'] });
    render(<RouterProvider router={router} />);
    const main = await screen.findByRole('main', {}, { timeout: 8000 });
    const shell = main.parentElement;

    expect(shell?.matches('.today.desk:not(.dp-fit)')).toBe(true);
    expect(main.classList.contains('desk-main')).toBe(true);
    expect(main.querySelector(':scope > .desk-page .event-page.is-people')).not.toBeNull();
  });
});
