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
const KEPT = 'Your text is still here. Reload to see the message as it is now.';
const SUBJECT = 'On the day: where to find us';

async function messages(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function list(): HTMLElement {
  return screen.getByRole('region', { name: 'Messages' });
}

function pane(): HTMLElement {
  return document.querySelector<HTMLElement>('.mg-pane') as HTMLElement;
}

/** The refused save as each state opens it: the alert focused, the typed text kept, Save refused again. */
async function refused(state: string, first: string): Promise<HTMLElement> {
  await messages(state);
  const alert = screen.getByRole('alert');

  expect(alert.textContent).toBe(`${first}${KEPT}Reload`);
  await vi.waitFor(() => expect(document.activeElement).toBe(alert));
  expect(screen.queryByText(/^Editing\. It still goes/u)).toBeNull();
  expect((screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement).value).toBe(
    SUBJECT,
  );
  expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toContain(
    'The doors open at 17:15.',
  );

  screen.getByRole('textbox', { name: 'Subject' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await vi.waitFor(() => expect(document.activeElement).toBe(alert));
  expect(screen.queryByText('Saved.')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toContain(
    'The doors open at 17:15.',
  );

  fireEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
  const heading = screen.getByRole('heading', { level: 2, name: SUBJECT });

  await vi.waitFor(() => expect(document.activeElement).toBe(heading));

  return heading;
}

function noActions(): void {
  for (const name of ['Edit', 'Send now', 'Cancel…'])
    expect(within(pane()).queryByRole('button', { name })).toBeNull();
}

describe('A scheduled message’s refused save (sc-3963)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  it('names who changed it, and Reload shows their version, still Scheduled', SLOW, async () => {
    await refused('editConflict', 'Not saved. Bisi Okafor changed this message.');

    expect(within(pane()).getByText(/The doors open at 17:00\.$/u)).toBeDefined();
    expect(within(pane()).queryByText(/17:15/u)).toBeNull();
    for (const name of ['Edit', 'Send now', 'Cancel…'])
      expect(within(pane()).getByRole('button', { name })).toBeDefined();

    fireEvent.click(within(pane()).getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toContain(
      'The doors open at 17:00.',
    );
  });

  it('says it has already been sent, and Reload shows it as sent', SLOW, async () => {
    await refused('editSent', 'Not saved. This message has already been sent.');

    noActions();
    expect(within(pane()).getByText('On their page')).toBeDefined();
    expect(within(pane()).getByText('Folake Adeyemi · 09:00')).toBeDefined();
    expect(within(list()).queryByRole('heading', { name: /^Scheduled/u })).toBeNull();
    expect(
      within(list()).getByRole('link', {
        name: `${SUBJECT}, To Guests who… Is coming · on their page · told by Email and SMS, 09:00`,
      }),
    ).toBeDefined();
  });

  it('says it has been cancelled, and Reload shows who cancelled it', SLOW, async () => {
    await refused('editCancelled', 'Not saved. This message has been cancelled.');

    noActions();
    expect(
      within(pane()).getByText('Cancelled by Bisi Okafor at 09:46. It was not sent.'),
    ).toBeDefined();
    expect(
      within(list()).getByRole('link', {
        name: `${SUBJECT}, Cancelled by Bisi Okafor at 09:46, 09:46, Cancelled`,
      }),
    ).toBeDefined();
  });

  it('says it was too late to send, and Reload shows Not sent: too late', SLOW, async () => {
    await refused('editTooLate', 'Not saved. This message was too late to send.');

    noActions();
    expect(within(pane()).getByText('Not sent: too late')).toBeDefined();
    expect(
      within(pane()).getByText(
        'The event was not resumed or restored within 48 hours of this message’s time.',
      ),
    ).toBeDefined();
    expect(
      within(list()).getByRole('link', {
        name: `${SUBJECT}, To Guests who… Is coming · Thu, Nov 5, 09:00, Not sent: too late`,
      }),
    ).toBeDefined();
  });
});

const PAUSED =
  'This message is waiting while the event is paused. If the event is live again by this message’s time, it goes then. If not, it goes soon after the event is live again, unless that is more than 48 hours late.';

function section(name: string): HTMLElement {
  const head = within(list()).getByRole('heading', { level: 2, name: new RegExp(`^${name}`, 'u') });

  return head.closest('.mg-section') as HTMLElement;
}

describe('A scheduled message while its event is paused, finished, or too late (sc-3963)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  it.each([
    ['scheduledPaused', 'Thu, Nov 5', '09:00'],
    ['scheduledPausedLate', 'Tue, Nov 3', '08:00'],
  ])(
    '%s: the paused line where Goes… was, the time kept under it',
    SLOW,
    async (state, day, time) => {
      await messages(state);

      expect(within(pane()).getByText(PAUSED)).toBeDefined();
      expect(within(pane()).queryByText(/^Goes /u)).toBeNull();
      expect(within(pane()).getByText(`${day}, ${time} London time`)).toBeDefined();
      for (const name of ['Edit', 'Send now', 'Cancel…'])
        expect(within(pane()).getByRole('button', { name })).toBeDefined();
      expect(
        within(section('Scheduled')).getByRole('link', {
          name: `${SUBJECT}, To Guests who… Is coming · ${day}, ${time}, Scheduled`,
        }),
      ).toBeDefined();
    },
  );

  it('reads Editing. with no time while paused, and keeps the paused line', SLOW, async () => {
    await messages('scheduledPausedEdit');

    expect(within(pane()).getByText('Editing.')).toBeDefined();
    expect(within(pane()).queryByText(/^Editing\. It still goes/u)).toBeNull();
    expect(within(pane()).getByText(PAUSED)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(pane()).getByText(PAUSED)).toBeDefined();
    expect(within(pane()).queryByText(/^Goes /u)).toBeNull();
  });

  it('reads Cancelled by Soirely with the reason, no actions, in Done', SLOW, async () => {
    await messages('scheduledFinished');

    noActions();
    expect(
      within(pane()).getByText(/^Cancelled by Soirely at 09:30\. It was not sent\./u),
    ).toBeDefined();
    expect(
      within(pane()).getByText('The event finished before this message was due.'),
    ).toBeDefined();
    expect(within(list()).queryByRole('heading', { name: /^Scheduled/u })).toBeNull();
    expect(
      within(section('Done')).getByRole('link', {
        name: `${SUBJECT}, Cancelled by Soirely at 09:30, 09:30, Cancelled`,
      }),
    ).toBeDefined();
  });

  it('reads Not sent: too late with the reason, no actions, in Done', SLOW, async () => {
    await messages('scheduledTooLate');

    noActions();
    expect(within(pane()).getAllByText('Not sent: too late').length).toBeGreaterThan(0);
    expect(
      within(pane()).getByText(
        'The event was not resumed or restored within 48 hours of this message’s time.',
      ),
    ).toBeDefined();
    expect(
      within(section('Done')).getByRole('link', {
        name: `${SUBJECT}, To Guests who… Is coming · Sat, Oct 31, 09:00, Not sent: too late`,
      }),
    ).toBeDefined();
  });
});
