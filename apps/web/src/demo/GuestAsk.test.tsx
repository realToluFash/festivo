import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const QUESTION = 'When should we ask you again?';

async function guest(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] })}
    />,
  );
  await screen.findByRole('banner', undefined, { timeout: 15000 });
}

const group = () => screen.getByRole('group', { name: QUESTION });
const options = () => within(group()).getAllByRole('radio');
const save = () => screen.getByRole('button', { name: 'Save' });
const wait = (ms = 1000) => act(() => vi.advanceTimersByTimeAsync(ms));

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
  vi.useRealTimers();
});

describe('When should we ask you again? (sc-1363)', { timeout: 20000 }, () => {
  it('asks under Not sure yet, a radio group with each date under its label', async () => {
    await guest('maybe_recorded');

    expect(options().map((one) => one.closest('label')?.textContent)).toEqual([
      'In a weekTuesday, October 13',
      'In two weeksTuesday, October 20',
      'A week before the eventThursday, October 29',
      'Don’t ask me again',
    ]);
    expect(options().some((one) => (one as HTMLInputElement).checked)).toBe(false);
  });

  it.each(['maybe_too_close', 'maybe_days_5', 'maybe_reply_by_none', 'maybe_reply_by_closed'])(
    '%s has no question',
    async (state) => {
      await guest(state);

      expect(screen.queryByRole('group', { name: QUESTION })).toBeNull();
    },
  );

  it('offers Three days before answers close under a Reply by', async () => {
    await guest('maybe_reply_by');

    expect(options()).toHaveLength(3);
    expect(within(group()).getByText('Three days before answers close')).toBeDefined();
  });

  it('asks the guest to choose on Save with nothing chosen, and clears it on a choice', async () => {
    await guest('maybe_recorded');
    fireEvent.click(save());

    expect(screen.getByText('Choose when we should ask you, or Don’t ask me again.')).toBeDefined();
    expect(group().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(options()[0]);
    fireEvent.click(options()[1]!);
    expect(screen.queryByText('Choose when we should ask you, or Don’t ask me again.')).toBeNull();
  });

  it('saves, busy while it does, then says the date and takes focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('maybe_recorded');
    fireEvent.click(options()[0]!);
    fireEvent.click(save());

    expect(save().getAttribute('aria-busy')).toBe('true');
    await wait();
    const said = screen.getByRole('status', { name: '' });
    expect(said.textContent).toBe('We’ll ask you on Tuesday, October 13.');
    expect(document.activeElement).toBe(said);
  });

  it('says a Save that did not reach us, keeping the choice', async () => {
    await guest('maybe_not_saved');

    expect(
      screen.getByText('Not saved. Check your connection and press Save again.'),
    ).toBeDefined();
    expect((options()[0] as HTMLInputElement).checked).toBe(true);
  });

  it('offers the new choices after a 422, and says too close when none is left', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('maybe_dates_moved');
    fireEvent.click(save());
    await wait();

    expect(
      screen.getByText(
        'Not saved. The choices have changed since you opened this page. Choose again.',
      ),
    ).toBeDefined();
    expect(options().some((one) => (one as HTMLInputElement).checked)).toBe(false);
  });

  it('moves focus to the too-close line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('maybe_too_close_now');
    fireEvent.click(save());
    await wait();

    expect(document.activeElement?.textContent).toContain(
      'Not saved. It is now too close to the event to ask you again.',
    );
  });

  it('shows the answer from another device after a 409', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('maybe_reply_changed');
    fireEvent.click(save());
    await wait();

    expect(document.activeElement?.textContent).toMatch(/^You answered Coming on /u);
    expect(screen.queryByRole('group', { name: QUESTION })).toBeNull();
  });

  it.each([
    ['maybe_coming_back_saved', 'We’ll ask you on Tuesday, October 13.'],
    ['maybe_coming_back_wont', 'We won’t ask again.'],
  ])('%s says where the ask stands, without a status', async (state, line) => {
    await guest(state);

    expect(screen.getByText(line).closest('p')?.getAttribute('role')).toBeNull();
  });

  it('shows neither once the ask has gone', async () => {
    await guest('maybe_coming_back_sent');

    expect(screen.queryByRole('group', { name: QUESTION })).toBeNull();
    expect(screen.queryByText(/^We/u)).toBeNull();
  });
});
