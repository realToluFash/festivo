import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const REFUSED = 'The currency cannot change once amounts are recorded against this event.';

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  resetSample();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
});

async function currency(): Promise<HTMLElement> {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: ['/demo/events/evt-wed-4?state=currencyRefused'],
      })}
    />,
  );
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });

  const found = screen
    .getAllByRole('group', { name: 'Currency' })
    .find((group) => group.classList.contains('ev-opened'));

  if (found == null) throw new Error('Currency is not open');

  return found;
}

describe('the demo’s refused currency (sc-74701)', () => {
  it('shows the refusal on arrival without taking focus', SLOW, async () => {
    const part = await currency();

    expect(within(part).getByRole('alert').textContent).toContain(REFUSED);
    expect(document.activeElement?.hasAttribute('data-notice-landing')).toBe(false);
  });

  it('lands focus on the notice at each refused Save, as the product does', SLOW, async () => {
    const part = await currency();
    const save = within(part).getByRole('button', { name: 'Save' });

    for (let times = 0; times < 2; times += 1) {
      fireEvent.click(save);

      const landed = document.activeElement as HTMLElement;

      expect(landed.textContent).toContain(REFUSED);
      expect(landed.classList.contains('ev-notice')).toBe(true);
      expect(landed.hasAttribute('data-notice-landing')).toBe(true);
      expect(within(part).queryByRole('alert')).toBeNull();
    }
  });

  it('keeps a landed notice 12px clear of its scroller on both edges', () => {
    const sheet = readFileSync(join(__dirname, 'events.css'), 'utf8');

    expect(sheet).toMatch(
      /\.ev-notice\[data-notice-landing\]\s*\{\s*scroll-margin-block: var\(--spaceLg\);\s*\}/,
    );
  });
});
