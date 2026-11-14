import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 15000 };
const AT = '/demo/events/evt-wed-4?area=budget&state=';

async function open(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return screen.getByRole('dialog', { name: 'Add guest' });
}

describe('What a decision costs, in Add guest (sc-86)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it(
    'opens over the Guests page, Guests lit, with the answer beside the change',
    SLOW,
    async () => {
      const dialog = await open('decide_rise');

      expect(screen.getByRole('heading', { level: 1, name: 'Guests' })).toBeDefined();
      const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(crumb).getByText('Guests')).toBeDefined();
      expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveProperty(
        'value',
        'Marta Silva',
      );
      expect(document.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Name' }));

      const answer = within(dialog).getByRole('status');
      expect(answer.getAttribute('aria-busy')).toBe('false');
      expect(answer.textContent).toContain('+£270 if all come');
      expect(answer.textContent).toContain(
        'On the upper figure only, now £23,330. New guests have not replied, so the settled £19,730 stays.',
      );
      expect(answer.textContent).toContain('£9,044.00 → £9,248.00 · 133 → 136 if all come');
      expect(answer.textContent).toContain('+£204.00');
      expect(answer.textContent).toContain('+£66.00');
      expect(answer.textContent).toContain('This would take the event over its ceiling.');
      expect(answer.textContent).toContain(
        'If everyone comes, it would be £23,330 against £22,000.',
      );
    },
  );

  it('goes through updating to the new answer when a companion leaves or joins', SLOW, async () => {
    const dialog = await open('decide_rise');
    vi.useFakeTimers();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Rui Silva' }));
    const answer = within(dialog).getByRole('status');
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(answer.textContent).toBe('What adding them would cost');

    act(() => vi.advanceTimersByTime(1000));
    expect(answer.getAttribute('aria-busy')).toBe('false');
    expect(answer.textContent).toContain('+£180 if all come');
    expect(answer.textContent).toContain('133 → 135 if all come');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add a companion' }));
    expect(answer.getAttribute('aria-busy')).toBe('true');
    act(() => vi.advanceTimersByTime(1000));
    expect(answer.textContent).toContain('+£270 if all come');
    expect(document.activeElement).toBe(
      within(dialog).getByRole('textbox', { name: 'Companion’s full name, 2 of 2' }),
    );
  });

  it('says Not known with the dashed ring, never £0, for a cost with no price', SLOW, async () => {
    const answer = within(await open('decide_unknown')).getByRole('status');

    expect(answer.textContent).toContain('+£204 if all come');
    expect(answer.textContent).toContain('Full cost not known: 1 cost it moves has no price yet.');
    expect(answer.textContent).toContain('Not priced yet, so its cost is not known');
    expect(answer.querySelector('.bud-dashed')).not.toBeNull();
    expect(answer.textContent).not.toContain('£0');
  });

  it('says No change where nothing is counted per guest', SLOW, async () => {
    const answer = within(await open('decide_nochange')).getByRole('status');

    expect(answer.textContent).toContain('No change');
    expect(answer.textContent).toContain('Nothing in this budget is counted per guest.');
  });

  it('holds the answer’s place while it updates, announcing nothing', SLOW, async () => {
    const answer = within(await open('decide_updating')).getByRole('status');

    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(answer.textContent).not.toContain('£');
  });

  it(
    'draws the form with no answer at all, as Can edit or when it did not load',
    SLOW,
    async () => {
      for (const state of ['decide_none', 'decide_rise&as=kemi', 'decide_rise&fetch=failed']) {
        const dialog = await open(state);
        expect(within(dialog).queryByRole('status')).toBeNull();
        expect(within(dialog).queryByText('What adding them would cost')).toBeNull();
        expect(within(dialog).getByRole('button', { name: 'Remove Rui Silva' })).toBeDefined();
        cleanup();
      }
    },
  );

  it('closes on Add guest and says nothing, and opens again from the page', SLOW, async () => {
    const dialog = await open('decide_rise');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add guest' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));
    expect(screen.getByRole('dialog', { name: 'Add guest' })).toBeDefined();
  });
});
