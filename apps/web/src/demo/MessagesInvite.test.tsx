import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';

function open(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);
}

async function messages(state: string): Promise<void> {
  open(`${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

async function guests(state: string): Promise<void> {
  open(`/demo/guests?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function note(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /^Note for your guests/u });
}

function check(): HTMLElement {
  return screen.getByRole('alertdialog', { name: 'Check it before it goes' });
}

describe('the invitation in New message, at a desk (sc-3971)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    'opens on Not yet invited with Soirely’s words, checks, counts down and gives the note back on Cancel',
    SLOW,
    async () => {
      await messages('inviteWrite');

      expect(
        screen.getByRole('button', { name: 'Guests who… Not yet invited · 14' }),
      ).toBeDefined();
      expect(
        within(screen.getByRole('group', { name: 'Let them know by' }))
          .getAllByRole('checkbox')
          .map((one) => one.textContent),
      ).toEqual(['Email', 'SMS']);
      expect(screen.getByText('Invitation · As Bisi Adewale will see it')).toBeDefined();
      expect(screen.getByText('Dear Auntie Bisi,')).toBeDefined();
      expect(screen.getByText('Each guest gets this in their own language.')).toBeDefined();
      await waitFor(() => expect(document.activeElement).toBe(note()), WAIT);

      fireEvent.change(note(), { target: { value: 'See you there.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(within(check()).getByText('Sending to 14 people cannot be undone.')).toBeDefined();
      expect(
        within(check()).getByText('Texts use 2 credits. Credits after sending: 1,498.'),
      ).toBeDefined();
      expect(within(check()).queryByRole('button', { name: 'Later…' })).toBeNull();
      fireEvent.click(within(check()).getByRole('button', { name: 'Send to 14 people' }));

      const cancel = await screen.findByRole('button', { name: 'Cancel' }, WAIT);

      expect(screen.getByText('See you there.')).toBeDefined();
      fireEvent.click(cancel);
      expect(screen.getByText('Cancelled. No invitation was sent.')).toBeDefined();
      expect(note().value).toBe('See you there.');
    },
  );

  it(
    'refuses a note too long: nothing opens, the box breaks, focus goes to it and the text stays',
    SLOW,
    async () => {
      await messages('inviteNoteLong');
      const long = note().value;

      expect(note().getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Shorten the note to 10,000 characters or fewer.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(note()), WAIT);
      expect(note().value).toBe(long);
      fireEvent.change(note(), { target: { value: 'Short now.' } });
      expect(screen.queryByText('Shorten the note to 10,000 characters or fewer.')).toBeNull();
    },
  );

  it(
    'names who already have it, leaves them out until Send again, and opens See all in the card',
    SLOW,
    async () => {
      await messages('inviteCheckSome');

      expect(check().querySelector('.mi-already .mg-cant-head')?.textContent).toBe(
        '142 already have their invitation',
      );
      expect(
        within(check()).getByText('Alhaji Musa Bello · Invited by Soirely’s message, Oct 12'),
      ).toBeDefined();
      expect(within(check()).getByRole('radio', { name: 'Leave them out' })).toHaveProperty(
        'checked',
        true,
      );
      fireEvent.click(within(check()).getByRole('radio', { name: 'Send again' }));
      expect(within(check()).getByRole('button', { name: 'Send to 156 people' })).toBeDefined();
      expect(within(check()).getByText('9 can’t be reached')).toBeDefined();
      expect(
        within(check()).getByText('Texts use 80 credits. Credits after sending: 1,420.'),
      ).toBeDefined();

      fireEvent.click(within(check()).getByRole('button', { name: 'See all 142' }));
      const back = within(check()).getByRole('button', { name: 'Back to the check' });

      await waitFor(() => expect(document.activeElement).toBe(back), WAIT);
      expect(within(check()).getAllByRole('listitem').length).toBe(142);
    },
  );

  it('refuses a guest nobody can reach, with Change it alone', SLOW, async () => {
    await messages('inviteRefused');

    expect(within(check()).getByText('The invitation cannot be sent yet.')).toBeDefined();
    expect(
      within(check()).getByText('Joaquín Ruiz · No email address · No phone number'),
    ).toBeDefined();
    expect(
      within(check())
        .getAllByRole('button')
        .filter((one) => one.getAttribute('role') !== 'checkbox')
        .map((one) => one.textContent),
    ).toEqual(['Change it']);
  });

  it('lands as its own Invitation, with how many are now Invited', SLOW, async () => {
    await messages('inviteSent');

    expect(screen.getByText('14 guests are now Invited, by Soirely’s message.')).toBeDefined();
  });
});

describe('Send invitations and Send invitation on Guests, at a desk (sc-3971)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    'puts Send invitations between Export and Add guest, and opens New message on the invitation',
    SLOW,
    async () => {
      await guests('inviteList');
      const top = document.querySelector<HTMLElement>('.gs-top') as HTMLElement;

      expect(
        within(top)
          .getAllByRole('button')
          .map((one) => one.textContent),
      ).toEqual(['Export', 'Send invitations', 'Add guest']);
      fireEvent.click(within(top).getByRole('button', { name: 'Send invitations' }));
      expect(
        await screen.findByRole('button', { name: 'Guests who… Not yet invited · 14' }, WAIT),
      ).toBeDefined();
    },
  );

  it(
    'offers no Send invitations once nobody is Not yet invited, nor on a Draft',
    SLOW,
    async () => {
      await guests('inviteNoneLeft');
      expect(screen.queryByRole('button', { name: 'Send invitations' })).toBeNull();
      expect(screen.getByText('96 coming of 156 invited')).toBeDefined();

      cleanup();
      await guests('draft');
      expect(screen.queryByRole('button', { name: 'Send invitations' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Send invitation/u })).toBeNull();
    },
  );

  it(
    'puts Send invitation first in a guest’s Invitation, and opens New message to them alone',
    SLOW,
    async () => {
      await guests('inviteGuest');
      const pane = document.querySelector<HTMLElement>('.gs-column') as HTMLElement;
      const send = within(pane).getByRole('button', { name: /^Send invitation\b(?!s)/u });
      const copy = within(pane).getByRole('button', { name: /^Copy invitation link/u });

      expect(send.textContent).toContain('Soirely sends it to them by email or text.');
      expect(send.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(send);
      expect(await screen.findByRole('button', { name: 'Bisi Adewale' }, WAIT)).toBeDefined();
    },
  );
});
