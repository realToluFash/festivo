import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { GUEST_ASK_PAGES } from './guestAskStates.ts';

const SLOW = { timeout: 15000 };
const QUESTION = 'When should we ask you again?';

const tested = config();

async function guest(query: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guest?${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner');

  return router;
}

const ask = () => screen.queryByRole('group', { name: QUESTION });
const options = () =>
  within(screen.getByRole('group', { name: QUESTION }))
    .getAllByRole('radio')
    .map((one) => one.closest('label')?.textContent);

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  // The demo sends nothing: no state, no tap and no Save reaches the network.
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  cleanup();
  __setConfig(tested);
  vi.useRealTimers();
});

describe('when a guest who isn’t sure yet is asked again (sc-1363)', () => {
  it('is linked from the demo home, every link once', SLOW, async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole(
      'heading',
      { level: 3, name: /^Not sure yet, when to ask again/u },
      SLOW,
    );
    const links = screen
      .getAllByRole('link')
      .map((one) => one.getAttribute('href'))
      .filter((href) => href != null && /[?&]state=maybe_/u.test(href));

    expect(links).toEqual(GUEST_ASK_PAGES.flatMap((page) => page.states.map((one) => one.to)));
  });

  it('offers the three dates with no Reply by', SLOW, async () => {
    await guest('state=maybe_recorded');

    expect(options()).toEqual([
      'In a weekTuesday, October 13',
      'In two weeksTuesday, October 20',
      'A week before the eventThursday, October 29',
      'Don’t ask me again',
    ]);
  });

  it('keeps to Reply by in 12 days', SLOW, async () => {
    await guest('state=maybe_recorded&replyBy=in12');

    expect(options()).toEqual([
      'In a weekTuesday, October 13',
      'Three days before answers closeThursday, October 15',
      'Don’t ask me again',
    ]);
  });

  it('asks nothing with Reply by in 3 days, and as with none once reopened', SLOW, async () => {
    await guest('state=maybe_recorded&replyBy=in3');
    expect(ask()).toBeNull();
    cleanup();

    await guest('state=maybe_recorded&replyBy=reopened');
    expect(options()).toHaveLength(4);
  });

  it('shows the closed view alone once Reply by has passed', SLOW, async () => {
    await guest('state=maybe_recorded&replyBy=passed');

    expect(ask()).toBeNull();
    expect(
      screen.getByText(/^Answers closed on .+\. Contact your host if you can still come\.$/u),
    ).toBeTruthy();
  });

  it('asks for a choice on Save with nothing chosen, then saves the one made', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('state=maybe_recorded');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Choose when we should ask you, or Don’t ask me again.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /^In two weeks/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(screen.getByRole('status').textContent).toBe('We’ll ask you on Tuesday, October 20.');
  });

  it('says answers close too soon in place of the question under a Reply by', SLOW, async () => {
    await guest('state=maybe_too_close_now&replyBy=in12');

    expect(ask()).toBeNull();
    expect(
      screen.getByText('Not saved. Answers close too soon for us to ask you again.'),
    ).toBeTruthy();
  });

  const focused = () => document.activeElement;
  const save = () => screen.getByRole('button', { name: 'Save' });
  const alertText = () =>
    screen
      .getAllByRole('alert')
      .map((one) => one.textContent)
      .filter((text) => text !== '')
      .join(' | ');

  it('keeps the choice and Save’s focus when a save doesn’t reach us', SLOW, async () => {
    await guest('state=maybe_not_saved');

    expect(alertText()).toBe('Not saved. Check your connection and press Save again.');
    expect(screen.getByRole('radio', { name: /^In a week/u })).toHaveProperty('checked', true);
    expect(focused()).toBe(save());
  });

  it(
    'says the choices changed, clears the choice and keeps focus on Save (422)',
    SLOW,
    async () => {
      await guest('state=maybe_dates_moved');

      expect(alertText()).toBe(
        'Not saved. The choices have changed since you opened this page. Choose again.',
      );
      expect(ask()).not.toBeNull();
      expect(screen.getAllByRole('radio').some((one) => (one as HTMLInputElement).checked)).toBe(
        false,
      );
      expect(focused()).toBe(save());
    },
  );

  it('replaces the question with the 422 line and moves focus to it', SLOW, async () => {
    await guest('state=maybe_too_close_now');
    const line = screen.getByText('Not saved. It is now too close to the event to ask you again.');

    expect(ask()).toBeNull();
    expect(line.closest('[role="status"]')).toBeNull();
    expect(focused()).toBe(line.closest('[data-focus="askClose"]'));
  });

  it('drops the ask for the answer made on another device (409)', SLOW, async () => {
    await guest('state=maybe_reply_changed');

    expect(ask()).toBeNull();
    expect(screen.getByText(/^You answered Coming on /u)).toBeTruthy();
    expect(screen.queryByText(/^You answered Not sure yet/u)).toBeNull();
    expect(screen.queryByText(/We’ll ask you on|We won’t ask again/u)).toBeNull();
    expect(focused()?.getAttribute('data-focus')).toBe('greeting');
  });

  it('shows a saved date on coming back, quietly and without the question', SLOW, async () => {
    await guest('state=maybe_coming_back');
    const line = screen.getByText(/^We’ll ask you on .+\.$/u);

    expect(ask()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(focused()).not.toBe(line.closest('p'));
  });

  it('shows Don’t ask me again on coming back, quietly', SLOW, async () => {
    await guest('state=maybe_coming_back_wont');

    expect(screen.getByText('We won’t ask again.')).toBeTruthy();
    expect(ask()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('asks again on coming back with nothing saved', SLOW, async () => {
    await guest('state=maybe_coming_back_none');

    expect(ask()).not.toBeNull();
    expect(
      screen
        .queryAllByRole('alert')
        .map((one) => one.textContent)
        .join(''),
    ).toBe('');
  });

  it('shows nothing of the ask on coming back once it was sent', SLOW, async () => {
    await guest('state=maybe_coming_back_sent');

    expect(ask()).toBeNull();
    expect(screen.queryByText(/We’ll ask you on|We won’t ask again|Not saved/u)).toBeNull();
  });

  async function pressSave() {
    fireEvent.click(save());
    await act(() => vi.advanceTimersByTimeAsync(3000));
  }

  it('fails the first Save live with &save=net, then saves', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('state=maybe_recorded&save=net');
    fireEvent.click(screen.getByRole('radio', { name: /^In two weeks/u }));
    await pressSave();

    expect(alertText()).toBe('Not saved. Check your connection and press Save again.');
    expect(focused()).toBe(save());

    await pressSave();
    expect(screen.getByRole('status').textContent).toBe('We’ll ask you on Tuesday, October 20.');
  });

  it('meets the 422 live with &save=moved and &save=close', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('state=maybe_recorded&save=moved');
    fireEvent.click(screen.getByRole('radio', { name: /^In a week/u }));
    await pressSave();

    expect(alertText()).toMatch(/^Not saved\. The choices have changed/u);
    expect(focused()).toBe(save());
    cleanup();

    await guest('state=maybe_recorded&save=close');
    fireEvent.click(screen.getByRole('radio', { name: /^In a week/u }));
    await pressSave();

    expect(ask()).toBeNull();
    expect(focused()?.getAttribute('data-focus')).toBe('askClose');
  });

  it('meets the 409 live with &save=changed', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('state=maybe_recorded&save=changed');
    fireEvent.click(screen.getByRole('radio', { name: /^In a week/u }));
    await pressSave();

    expect(ask()).toBeNull();
    expect(screen.getByText(/^You answered Coming on /u)).toBeTruthy();
    expect(screen.queryByText(/^You answered Not sure yet/u)).toBeNull();
    expect(focused()?.getAttribute('data-focus')).toBe('greeting');
  });
});
