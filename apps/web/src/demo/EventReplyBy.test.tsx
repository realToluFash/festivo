import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { EVENTS_PAGES, resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WEDDING = 'Adaeze & Tunde’s wedding';
const SENTENCE =
  'On the guests’ page: “Please answer by Wednesday, November 4. You can change your answer any time before then.”';

async function page(state: string, id = 'evt-wed-4', name = WEDDING) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/${id}?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name }, { timeout: 8000 });
}

const part = () => screen.getByRole('group', { name: 'Reply by' });
const field = () => within(part()).getByLabelText(/^Reply by/u);

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Reply by on the event’s Details (sc-3780)', () => {
  it('is linked from the demo home, every state once', () => {
    const group = EVENTS_PAGES.find((one) => one.name === 'Reply by, in place (sc-3780)');

    expect(group?.states.map((one) => /state=(\w+)/u.exec(one.to)?.[1])).toEqual([
      'replyBy',
      'replyByEmpty',
      'replyByError',
      'replyBySooner',
      'replyByNow',
      'replyBySaved',
      'replyByRemoved',
    ]);
    const dates = EVENTS_PAGES.flatMap((one) => one.states).filter((one) =>
      one.to.endsWith('state=datesReplyBy'),
    );
    expect(dates).toHaveLength(1);
  });

  it('sits after Dates, the date over its line, and opens in place', SLOW, async () => {
    await page('replyBy');
    const rows = [...document.querySelectorAll('.ev-details .ev-detail')].map(
      (one) => one.textContent,
    );

    expect(rows[1]).toContain('Wed, Nov 4, 2026');
    expect(rows[1]).toContain('Reply by · Replies close at 23:59, Europe/London time.');
    expect(document.activeElement).toBe(field());
    expect((field() as HTMLInputElement).value).toBe('2026-11-04');
    expect(within(part()).getByText(SENTENCE)).toBeDefined();
    expect(within(part()).getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('opens empty on an event with no date, with no Remove and no preview', SLOW, async () => {
    await page('replyByEmpty', 'evt-draft-4', 'Bisi & Kola’s engagement');

    expect((field() as HTMLInputElement).value).toBe('');
    expect(within(part()).queryByRole('button', { name: 'Remove the date' })).toBeNull();
    expect(within(part()).queryByText(/^On the guests’ page/u)).toBeNull();
    expect(screen.getAllByText('Replies stay open until the event starts.')).toHaveLength(1);
  });

  it('refuses the day it starts before sending, with focus on the field', SLOW, async () => {
    await page('replyByError');

    expect(within(part()).getByRole('alert').textContent).toBe(
      'Choose a date before the event starts.',
    );
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field());
  });

  it('asks before closing sooner; Keep leaves the date, Close saves it', SLOW, async () => {
    await page('replyBySooner');
    const ask = await screen.findByRole('alertdialog', {
      name: 'Close replies sooner, on Tue, Nov 3?',
    });

    expect(ask.getAttribute('aria-describedby')).not.toBeNull();
    expect(document.getElementById(ask.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      '25 haven’t replied (21 guests and 4 of their companions).',
    );
    expect(
      within(ask).getByText(
        'After that day they can’t reply, unless you let them change their reply.',
      ),
    ).toBeDefined();

    expect(within(ask).getByRole('button', { name: 'Keep Wed, Nov 4' })).toBeDefined();
    expect(
      within(ask).getByRole('button', { name: 'Close replies sooner' }).className,
    ).not.toContain('red');
    fireEvent.click(within(ask).getByRole('button', { name: 'Close replies sooner' }));

    expect(
      await screen.findByText('Saved. Replies close on Tue, Nov 3 at 23:59, Europe/London time.'),
    ).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Reply by' })).toBeNull();
    expect(screen.getByText('Tue, Nov 3, 2026')).toBeDefined();
  });

  it('asks before closing now for a date already past', SLOW, async () => {
    await page('replyByNow');
    const ask = await screen.findByRole('alertdialog', { name: 'Close replies now?' });

    expect(
      within(ask).getByText(
        'From now on they can’t reply, unless you let them change their reply.',
      ),
    ).toBeDefined();

    fireEvent.click(within(ask).getByRole('button', { name: 'Keep Wed, Nov 4' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(part()).queryByText(/^On the guests’ page/u)).toBeNull();
    expect(screen.getByRole('group', { name: 'Reply by' })).toBeDefined();
  });

  it('removes the date, and says replies stay open until the start', SLOW, async () => {
    await page('replyBy');

    fireEvent.click(within(part()).getByRole('button', { name: 'Remove the date' }));
    expect((field() as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(field());
    fireEvent.click(within(part()).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Saved. Replies stay open until the event starts.'),
    ).toBeDefined();
    expect(screen.getByText('Replies stay open until the event starts.')).toBeDefined();
  });

  it(
    'moves Reply by to the day before a start moved onto it, says so first, then saves (pm, 8 Nov)',
    SLOW,
    async () => {
      await page('datesReplyBy');
      const dates = screen.getByRole('group', { name: 'Dates' });

      expect(
        within(dates).getByText(
          'Replies close on Wed, Nov 4, which isn’t before the new start. Saving moves Reply by to Tue, Nov 3.',
        ),
      ).toBeDefined();
      fireEvent.click(within(dates).getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Saved. Replies now close Tue, Nov 3.')).toBeDefined();
      expect(screen.getByText('Tue, Nov 3, 2026')).toBeDefined();
    },
  );

  it('leaves Reply by alone when the start moves later', SLOW, async () => {
    await page('dates');
    const dates = screen.getByRole('group', { name: 'Dates' });
    const starts = within(dates).getByLabelText('Starts, Date');

    fireEvent.change(starts, { target: { value: '2026-11-06' } });
    expect(within(dates).queryByText(/^Replies close on/u)).toBeNull();
    fireEvent.click(within(dates).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Wed, Nov 4, 2026')).toBeDefined();
    expect(screen.queryByText(/^Saved\. Replies now close/u)).toBeNull();
  });

  it.each([
    ['replyBySaved', 'Saved. Replies close on Tue, Nov 3 at 23:59, Europe/London time.'],
    ['replyByRemoved', 'Saved. Replies stay open until the event starts.'],
  ])('?state=%s opens on the page with its toast', SLOW, async (state, toast) => {
    await page(state);

    expect(await screen.findByText(toast)).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Reply by' })).toBeNull();
  });
});
