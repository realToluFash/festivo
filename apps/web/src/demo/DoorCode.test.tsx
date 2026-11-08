import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  __setConfig(tested);
  vi.useRealTimers();
});

async function people(query: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/people?${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'People' });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/** What a screen reader reads after a control's name: the text its `aria-describedby` points at. */
function description(control: Element): string {
  return (control.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();
}
const dialog = (name: string) => within(screen.getByRole('dialog', { name }));
const asked = (name: string) => within(screen.getByRole('alertdialog', { name }));

describe('the door code’s card on People (sc-71, sc-72)', () => {
  it('offers the one step when there is no code yet', async () => {
    await people('state=code-none');

    expect(screen.getByText('No door code yet')).toBeDefined();
    expect(
      screen.getByText(
        'One code lets a crew in on the day. Each person gives their name and mobile number.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make a door code' })).toBeDefined();
  });

  it('reads the code in its groups, the count, then Show the code, with Print first under it', async () => {
    await people('state=code');

    const main = within(screen.getByRole('main'));
    expect(main.getByText('Door code · Can check guests in · Bar and drinks')).toBeDefined();
    expect(main.getByText('Door code Q 7 K M, 4 X P 2')).toBeDefined();
    expect(main.getByText('14 of 30 used · until Sat, Nov 14, 23:30')).toBeDefined();
    const order = main
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((words) =>
        ['Show the code', 'Print', 'Make a new code', 'Stop this code'].includes(words ?? ''),
      );
    expect(order).toEqual(['Show the code', 'Print', 'Make a new code', 'Stop this code']);
    expect(
      main.getByRole('button', { name: /^João Pereira.*Bar and drinks · Door code$/u }),
    ).toBeDefined();
  });

  it('marks a code that is full, stopped or run out with a shape and a word', async () => {
    await people('state=code-full');
    expect(screen.getByText('Full')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make a new code' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show the code' })).toBeNull();
  });

  it('lands the keyboard on Stop this code', async () => {
    await people('state=code-keyboard');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stop this code' })),
    );
  });

  it('stops a code once asked, and everyone already in keeps their access', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('state=code');

    fireEvent.click(screen.getByRole('button', { name: 'Stop this code' }));
    const ask = asked('Stop this code?');
    expect(
      ask.getByText('Nobody new can use it. The 14 people already in keep their access.'),
    ).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Stop the code' }));
    expect(ask.getByRole('button', { name: 'Stopping…' })).toBeDefined();
    await wait(1000);

    expect(screen.getByText('Stopped')).toBeDefined();
    expect(screen.getByText('14 people came in with it. They keep their access.')).toBeDefined();
  });
});

describe('making a door code in a 540 dialog', () => {
  it('starts on Can view, never offers Can edit, and checks before it sends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('code=open');
    const make = dialog('Door code');

    expect((make.getByRole('radio', { name: /^Can view/u }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((make.getByRole('radio', { name: /^Can edit/u }) as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.click(make.getByRole('button', { name: 'Make' }));
    expect(make.getByText('Enter how many people can use this code.')).toBeDefined();
    expect(document.activeElement).toBe(make.getByLabelText('How many people'));

    fireEvent.change(make.getByLabelText('How many people'), { target: { value: '3000' } });
    expect(make.getByText('Use a whole number from 1 to 500.')).toBeDefined();
    fireEvent.change(make.getByLabelText('How many people'), { target: { value: '30' } });
    fireEvent.change(make.getByLabelText('Job label (optional)'), {
      target: { value: 'Bar and drinks' },
    });
    expect(
      make.getByText(
        'What they’re there for, shown beside their name. It grants nothing. 14 of 60.',
      ),
    ).toBeDefined();
    fireEvent.click(make.getByRole('button', { name: 'Make' }));
    expect(make.getByRole('button', { name: 'Making…' })).toBeDefined();
    await wait(1000);

    expect(screen.getByText('Door code made.')).toBeDefined();
    expect(screen.getByText('Door code · Can view · Bar and drinks')).toBeDefined();
    expect(screen.getByText('0 of 30 used · until Sat, Nov 14, 23:30')).toBeDefined();
  });

  it('ends earlier from the menu, and refuses an end that has passed', async () => {
    await people('code=open');
    const make = dialog('Door code');

    fireEvent.click(make.getByRole('button', { name: /^Ends/u }));
    fireEvent.click(make.getByRole('menuitemradio', { name: /^Earlier/u }));
    expect(make.getByText('Earlier · Sat, Nov 14, 18:00')).toBeDefined();
    fireEvent.change(make.getByLabelText('Day'), { target: { value: '2026-11-07' } });
    fireEvent.change(make.getByLabelText('Time'), { target: { value: '09:00' } });
    fireEvent.change(make.getByLabelText('How many people'), { target: { value: '5' } });
    fireEvent.click(make.getByRole('button', { name: 'Make' }));

    const time = make.getByLabelText('Time');
    expect(document.activeElement).toBe(time);
    expect(time.getAttribute('aria-invalid')).toBe('true');
    expect(description(time)).toBe('Choose a time that hasn’t passed yet.');
    expect(make.getByLabelText('Day').getAttribute('aria-invalid')).toBe('false');
  });

  it('opens an end that has passed with the focus on Time, which the error describes', async () => {
    await people('code=past');
    const time = dialog('Door code').getByLabelText('Time');

    await waitFor(() => expect(document.activeElement).toBe(time));
    expect(time.getAttribute('aria-invalid')).toBe('true');
    expect(description(time)).toBe('Choose a time that hasn’t passed yet.');
  });

  it('keeps the form as it was when making fails, with the line at its top and Try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('code=failed');

    expect(dialog('Door code').getByRole('alert').textContent).toBe(
      'The door code was not made. Check your connection and try again.',
    );
    expect((dialog('Door code').getByLabelText('How many people') as HTMLInputElement).value).toBe(
      '30',
    );
    fireEvent.click(dialog('Door code').getByRole('button', { name: 'Try again' }));
    await wait(1000);

    expect(screen.getByText('Door code made.')).toBeDefined();
  });
});

describe('Show the code, the whole window', () => {
  it('shows the QR and the code, and Escape closes it', async () => {
    await people('hold=open');
    const held = dialog('Door code');

    expect(
      held.getByRole('img', { name: 'QR code for the door code Q 7 K M, 4 X P 2' }),
    ).toBeDefined();
    expect(held.getByRole('status').textContent).toBe('14 of 30 used · until Sat, Nov 14, 23:30');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Door code' })).toBeNull();
  });

  it('counts someone in as they join, and lists them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('hold=counted');
    await wait(1600);

    expect(dialog('Door code').getByRole('status').textContent).toBe(
      '15 of 30 used · until Sat, Nov 14, 23:30',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /^Hugo Faria/u })).toBeDefined();
  });

  it('makes a new code in place once asked, its count from 0', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('hold=new-ask');

    const ask = asked('Make a new code?');
    expect(
      ask.getByText('Q7KM 4XP2 stops working. The 14 people already in keep their access.'),
    ).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Make a new code' }));
    await wait(1000);

    expect(dialog('Door code').getByText('Door code H 3 W D, 9 R N 6')).toBeDefined();
    expect(dialog('Door code').getByRole('status').textContent).toBe(
      '0 of 30 used · until Sat, Nov 14, 23:30',
    );
  });

  it('says a stop did not go, and tries again from the same Ask', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('hold=stop-failed');
    const ask = asked('Stop this code?');

    expect(ask.getByRole('alert').textContent).toBe(
      'The code was not stopped, so it still works. Check your connection and try again.',
    );
    fireEvent.click(ask.getByRole('button', { name: 'Try again' }));
    await wait(1000);

    expect(screen.queryByRole('dialog', { name: 'Door code' })).toBeNull();
    expect(screen.getByText('Stopped')).toBeDefined();
  });
});

describe('who came in by the code, and taking one back', () => {
  it('says when they came in, keeps Lead for members, and removes them with a turning verb', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await people('state=code-person');
    const role = dialog('Role on this event');

    expect(role.getByText('Joined with the door code Q7KM 4XP2 at 13:34.')).toBeDefined();
    expect(role.getByText('From outside Lumen Feiras · Bar and drinks')).toBeDefined();
    expect((role.getByRole('radio', { name: /^Lead/u }) as HTMLInputElement).disabled).toBe(true);
    expect(role.getByText('For members of Lumen Feiras only.')).toBeDefined();
    fireEvent.click(role.getByRole('button', { name: 'Remove from this event…' }));
    const ask = asked('Remove João Pereira from this event?');
    expect(ask.getByText('Their access ends on their next request.')).toBeDefined();
    fireEvent.click(ask.getByRole('button', { name: 'Remove' }));
    expect(ask.getByRole('button', { name: 'Removing…' })).toBeDefined();
    await wait(1000);

    expect(screen.getByText('João Pereira is off this event.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^João Pereira/u })).toBeNull();
    expect(screen.getByRole('heading', { name: 'On this event' }).parentElement?.textContent).toBe(
      'On this event17',
    );
  });
});

describe('Print', () => {
  it('lays the code out black on white on a Letter page', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/people?print=1'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' }),
    ).toBeDefined();
    expect(
      screen.getByText('Sat, Nov 14 · 15:00 to 23:30 · Quinta do Torneiro, Oeiras'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Scan it with your phone’s camera, or open soirely.com/join and enter the code. It works until Sat, Nov 14, 23:30.',
      ),
    ).toBeDefined();
  });

  it('prints from under the card', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await people('state=code');

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
