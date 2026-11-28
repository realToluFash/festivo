import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, mediaBlock, stylesheet } from '../test-styles.ts';
import { menuEdge } from './vendors.ts';

const tested = config();
const WIDE = mediaBlock('(width > 40rem)', stylesheet(import.meta.dirname, 'vendorsMenu.css'));
const PANE = { left: 100, right: 700 };

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  __setConfig(tested);
});

function lay(button: { left: number; right: number }) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(220);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const box = this.classList.contains('desk-filter') ? button : PANE;

    return {
      ...box,
      top: 0,
      bottom: 48,
      x: box.left,
      y: 0,
      width: box.right - box.left,
      height: 48,
      toJSON: () => box,
    };
  });
}

describe('Vendors’ menus open wholly inside the Settings pane above 40rem (sc-102661)', () => {
  it('keeps the button’s end edge when the whole menu fits there, and otherwise takes its start edge', () => {
    expect(menuEdge({ left: 500, right: 640 }, 220, PANE)).toBe('end');
    expect(menuEdge({ left: 180, right: 320 }, 220, PANE)).toBe('end');
    expect(menuEdge({ left: 100, right: 240 }, 220, PANE)).toBe('start');
    expect(menuEdge({ left: 140, right: 300 }, 220, PANE)).toBe('start');
  });

  it('opens from the start edge only above 40rem, leaving the column-wide menu of 40rem and under', () => {
    expect(cssRule('.vd-tools.is-start .desk-menu', WIDE)).toMatch(
      /^\s*right: auto;\s+left: 0;\s*$/u,
    );
  });

  it('takes the start edge for a button at the start of a wrapped line, and the end edge beside the search', async () => {
    lay({ left: 100, right: 260 });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/settings/vendors?state=category_menu'],
    });
    render(<RouterProvider router={router} />);
    const tools = (await screen.findByRole('search', {}, { timeout: 8000 })).parentElement;
    await screen.findByRole('menu');

    expect(tools?.classList.contains('is-start')).toBe(true);

    vi.restoreAllMocks();
    lay({ left: 480, right: 640 });
    const [, inUse] = tools?.querySelectorAll<HTMLElement>('.desk-filter') ?? [];
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    fireEvent.click(inUse as HTMLElement);
    await screen.findByRole('menu');

    expect(tools?.classList.contains('is-start')).toBe(false);
  });
});
