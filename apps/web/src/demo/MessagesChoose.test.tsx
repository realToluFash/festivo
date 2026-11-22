import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';

async function messages(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function picker(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Choose guests' });
}

function box(name: string): HTMLInputElement {
  return within(picker()).getByRole<HTMLInputElement>('checkbox', { name });
}

function chip(): HTMLElement {
  return screen.getByRole('button', { name: /^Choose guests/u });
}

async function focused(element: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(document.activeElement).toBe(element));
}

describe('Choose guests, one by one, at a desk (sc-3942)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  it(
    'opens from the Choose guests choice in To, nobody chosen, focus in Find a guest',
    SLOW,
    async () => {
      await messages('to');
      fireEvent.click(screen.getByRole('radio', { name: 'Choose guests' }));

      expect(within(picker()).getByText('142 guests')).toBeDefined();
      expect(within(picker()).getByText('0 chosen')).toBeDefined();
      expect(within(picker()).getAllByRole('checkbox')).toHaveLength(142);
    },
  );

  it(
    'searches names, says how many show, and offers Clear when nothing matches',
    SLOW,
    async () => {
      await messages('chooseSearch');

      expect(within(picker()).getByRole('searchbox', { name: 'Find a guest' })).toHaveProperty(
        'value',
        'ade',
      );
      expect(within(picker()).getByText(/^\d+ of 142 shown$/u)).toBeDefined();
      fireEvent.change(within(picker()).getByRole('searchbox'), { target: { value: 'Zainab' } });
      expect(within(picker()).getByText('No guests match')).toBeDefined();
      fireEvent.click(within(picker()).getByRole('button', { name: 'Clear' }));
      expect(within(picker()).getAllByRole('checkbox')).toHaveLength(142);
    },
  );

  it('ticks guests into To at once, and keeps them on Escape', SLOW, async () => {
    await messages('chooseOpen');
    fireEvent.click(box('Abena Mensah'));
    fireEvent.click(box('Ama Owusu'));

    expect(within(picker()).getByText('2 chosen')).toBeDefined();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chip().textContent).toContain('Choose guests · 2');
    expect(screen.getByRole('list', { name: 'Chosen guests' }).textContent).toContain('Ama Owusu');
    await focused(chip());
  });

  it(
    'shows each flag as a mark with its words, and keeps the flagged choosable',
    SLOW,
    async () => {
      await messages('chooseFlags');

      expect(box('Dayo Amoah').checked).toBe(true);
      expect(box('Dayo Gomez').checked).toBe(true);
      expect(box('Dayo Amoah').getAttribute('aria-describedby')).toBeTruthy();
      expect(within(picker()).getByText('dayo.amoah@gmial.com')).toBeDefined();
      expect(within(picker()).getAllByText('Address is bouncing').length).toBeGreaterThan(0);
      expect(within(picker()).getAllByText('No email address').length).toBeGreaterThan(0);
      fireEvent.change(within(picker()).getByRole('searchbox'), {
        target: { value: 'Diego Amoah' },
      });
      expect(within(picker()).getByText('Reported an earlier email as spam')).toBeDefined();
      fireEvent.change(within(picker()).getByRole('searchbox'), {
        target: { value: 'Dayo Moreau' },
      });
      expect(within(picker()).queryByText('Address is bouncing')).toBeNull();
    },
  );

  it('shows no address without guests.manage, and searches names only', SLOW, async () => {
    await messages('chooseNoAddresses');

    expect(within(picker()).queryByText(/@/u)).toBeNull();
    expect(within(picker()).getAllByText('No email address').length).toBeGreaterThan(0);
    fireEvent.change(within(picker()).getByRole('searchbox'), { target: { value: 'gmail' } });
    expect(within(picker()).getByText('No guests match')).toBeDefined();
  });

  it('refuses Done with nobody chosen, beside To, with focus on it', SLOW, async () => {
    await messages('chooseOpen');
    fireEvent.click(within(picker()).getByRole('button', { name: 'Done' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Choose at least one guest.')).toBeDefined();
    await focused(chip());
  });

  it('moves with the arrows, Home and End, one tab stop for the list', SLOW, async () => {
    await messages('chooseLong');
    const kemi = box('Kemi Bankole');

    await focused(kemi);
    expect(
      within(picker())
        .getAllByRole('checkbox')
        .filter((one) => one.tabIndex === 0),
    ).toHaveLength(1);
    fireEvent.keyDown(kemi, { key: 'ArrowDown' });
    expect(document.activeElement).not.toBe(kemi);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect((document.activeElement as HTMLElement).getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.activeElement).toBe(within(picker()).getAllByRole('checkbox').at(-1));
  });

  it('says the list is loading, with the search held', SLOW, async () => {
    await messages('chooseLoading');

    expect(within(picker()).getByText('Loading guests…')).toBeDefined();
    expect(within(picker()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('shows six chosen in To and the rest as more, which opens the picker', SLOW, async () => {
    await messages('chosenMany');
    const list = screen.getByRole('list', { name: 'Chosen guests' });

    expect(within(list).getAllByRole('button', { name: /^Remove /u })).toHaveLength(6);
    fireEvent.click(within(list).getByRole('button', { name: 'Remove Abena Mensah' }));
    expect(chip().textContent).toContain('Choose guests · 8');
    fireEvent.click(within(list).getByRole('button', { name: '2 more' }));
    expect(within(picker()).getByText('8 chosen')).toBeDefined();
  });
});
