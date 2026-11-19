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

  return screen.getByRole('region', { name: 'Add guest' });
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
    'opens in the column beside the list, Guests lit, the answer under Companions and above Add guest',
    SLOW,
    async () => {
      const column = await open('decide_rise');

      expect(screen.getByRole('heading', { level: 1, name: 'Guests' })).toBeDefined();
      const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(crumb).getByText('Guests')).toBeDefined();
      expect(within(column).getByRole('textbox', { name: 'Full name' })).toHaveProperty(
        'value',
        'Marta Silva',
      );
      expect(document.activeElement).toBe(
        within(column).getByRole('textbox', { name: 'Full name' }),
      );

      const answer = within(column).getByRole('status');
      expect(answer.getAttribute('aria-busy')).toBe('false');
      expect(answer.textContent).toContain('+£270 if all come');
      expect(answer.textContent).toContain(
        'Once they are invited, it would be £23,330 if everyone comes. Settled, it stays £19,730 until they reply.',
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
    const column = await open('decide_rise');
    vi.useFakeTimers();

    fireEvent.click(within(column).getByRole('button', { name: 'Remove Rui Silva' }));
    const answer = within(column).getByRole('status');
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(answer.textContent).toBe('What adding them would cost');

    act(() => vi.advanceTimersByTime(1000));
    expect(answer.getAttribute('aria-busy')).toBe('false');
    expect(answer.textContent).toContain('+£180 if all come');
    expect(answer.textContent).toContain('133 → 135 if all come');

    fireEvent.click(within(column).getByRole('button', { name: 'Add a companion' }));
    expect(answer.getAttribute('aria-busy')).toBe('true');
    act(() => vi.advanceTimersByTime(1000));
    expect(answer.textContent).toContain('+£270 if all come');
    expect(document.activeElement).toBe(
      within(column).getByRole('textbox', { name: 'Companion’s full name, 2 of 2' }),
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

  it(
    'says Not known if all come, with no figure, when no cost it moves has a price',
    SLOW,
    async () => {
      const answer = within(await open('decide_unpriced')).getByRole('status');
      const big = answer.querySelector('.dec-big');

      expect(big?.textContent).toBe('Not known if all come');
      expect(big?.querySelector('.bud-dashed')).not.toBeNull();
      expect(big?.querySelector('.dec-up')).toBeNull();
      expect(answer.textContent).toContain(
        'Full cost not known: 2 costs it moves have no price yet.',
      );
      expect(answer.textContent).not.toMatch(/[+]£/u);
    },
  );

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
        const column = await open(state);
        expect(within(column).queryByRole('status')).toBeNull();
        expect(within(column).queryByText('What adding them would cost')).toBeNull();
        expect(within(column).getByRole('button', { name: 'Remove Rui Silva' })).toBeDefined();
        cleanup();
      }
    },
  );

  it(
    'closes on Done, the focus back on the page’s Add guest, and opens again from there',
    SLOW,
    async () => {
      const column = await open('decide_rise');

      fireEvent.click(within(column).getByRole('button', { name: 'Done' }));
      expect(within(column).queryByRole('textbox', { name: 'Full name' })).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
      const again = screen.getByRole('button', { name: 'Add guest' });
      expect(document.activeElement).toBe(again);

      fireEvent.click(again);
      expect(within(column).getByRole('textbox', { name: 'Full name' })).toBeDefined();
    },
  );

  it(
    'keeps the column on Add guest, as sc-1468 does: the guest said, the form cleared, the answer for one guest',
    SLOW,
    async () => {
      const column = await open('decide_rise');
      vi.useFakeTimers();

      fireEvent.click(within(column).getByRole('button', { name: 'Add guest' }));
      const name = within(column).getByRole('textbox', { name: 'Full name' });
      expect(within(column).getByText('Marta Silva added.')).toBeDefined();
      expect(name).toHaveProperty('value', '');
      expect(document.activeElement).toBe(name);
      expect(within(column).queryByRole('button', { name: /^Remove / })).toBeNull();

      const answer = within(column).getByRole('status', { name: 'What adding them would cost' });
      expect(answer.getAttribute('aria-busy')).toBe('true');
      act(() => vi.advanceTimersByTime(1000));
      expect(answer.getAttribute('aria-busy')).toBe('false');
      expect(answer.textContent).toContain('+£90 if all come');
      expect(answer.textContent).toContain('133 → 134 if all come');
    },
  );

  it(
    'reads the huge event exactly, in English and in Spanish, never splitting a group (sc-72618)',
    SLOW,
    async () => {
      const column = await open('decide_huge');
      const answer = within(column).getByRole('status');

      expect(answer.textContent).toContain('+£1,000,000,000,000,000 if all come');
      expect(answer.textContent).toContain(
        'If everyone comes, it would be £100,999,999,999,999,999. Settled, it stays £99,999,999,999,999,999',
      );
      expect(answer.textContent).toContain(
        '£99,999,999,999,999,999 → £100,999,999,999,999,999 · 100 → 101 if all come',
      );
      expect(answer.querySelector('.bud-amount')?.textContent).toBe('+£1,000,000,000,000,000');
      expect(answer.querySelectorAll('.dec-figure').length).toBe(6);
      for (const figure of answer.querySelectorAll('.dec-figure'))
        for (const group of figure.childNodes)
          if (group.nodeType === Node.TEXT_NODE)
            expect(group.textContent).toMatch(/^[+]?£?\d{1,3}[,]?$/u);
      cleanup();

      const spanish = within(await open('decide_huge&lang=es')).getByRole('status');
      expect(spanish.textContent).toContain('+1.000.000.000.000.000\u00a0GBP si vienen todos');
      expect(spanish.textContent).toContain(
        'Si vienen todos, sería 100.999.999.999.999.999\u00a0GBP.',
      );
      expect(spanish.textContent).toContain('99.999.999.999.999.999\u00a0GBP');
      expect(spanish.textContent).not.toContain('100.000.000.000.000.000');
      expect(spanish.textContent).not.toContain('101.000.000.000.000.000');
    },
  );
});
