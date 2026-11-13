import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';
const TOO_LONG = 'Shorten the note to 10,000 characters or fewer.';

function open(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

async function messages(state: string): Promise<void> {
  open(`${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

function note(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /^Note for your guests/ });
}

function card(): HTMLElement {
  return screen.getByRole('alertdialog', { name: 'Check it before it goes' });
}

async function seconds(count: number): Promise<void> {
  for (let second = 0; second < count; second += 1) await act(() => vi.advanceTimersByTime(1000));
}

async function focused(element: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(document.activeElement).toBe(element));
}

describe('Send invitations from Messages at a desk (sc-3971)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'links its sixteen states from the demo home, and Guests’ five, each in its own group',
    SLOW,
    async () => {
      open('/demo');
      const groups = (
        await screen.findAllByRole(
          'heading',
          { level: 4, name: 'Send invitations (sc-3971)' },
          WAIT,
        )
      ).map((heading) =>
        within(heading.parentElement as HTMLElement)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      );
      const messages = groups.find((links) => links[0]?.startsWith(AT));
      const guests = groups.find((links) => links[0]?.startsWith('/demo/guests'));

      expect(groups).toHaveLength(2);
      expect(messages).toHaveLength(16);
      expect(messages?.[0]).toBe(`${AT}?state=inviteWrite`);
      expect(messages?.[15]).toBe(`${AT}?state=inviteSent`);
      expect(guests).toEqual(
        [
          'inviteList',
          'inviteGuest',
          'inviteGuestMobile',
          'inviteGuestInvited',
          'inviteNoneLeft',
        ].map((state) => `/demo/guests?state=${state}`),
      );
    },
  );

  it(
    'opens an invitation to Not yet invited, by email and SMS, as its first guest sees it',
    SLOW,
    async () => {
      await messages('inviteWrite');

      expect(screen.getByRole('button', { name: /^Not yet invited · 14/ })).toBeDefined();
      expect(
        screen.getAllByRole('checkbox').map((one) => [one.textContent, one.ariaChecked]),
      ).toEqual([
        ['Email', 'true'],
        ['SMS', 'true'],
      ]);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Invitation · As Bisi Adewale will see it' }),
      ).toBeDefined();
      expect(screen.getByText('Dear Auntie Bisi,')).toBeDefined();
      expect(screen.getByText('Each guest gets this in their own language.')).toBeDefined();
      await focused(note());
      expect(note().value).toBe('');
      expect(
        within(list()).getByText('To Guests who… Not yet invited · not sent yet').closest('a')
          ?.textContent,
      ).toContain('Invitation');
    },
  );

  it('offers Not yet invited first on To, with its fourteen', SLOW, async () => {
    await messages('inviteTo');
    const to = screen.getByRole('dialog', { name: 'To' });
    const picked = within(to)
      .getAllByRole<HTMLInputElement>('radio')
      .find((one) => one.checked);

    expect(picked?.closest('label')?.textContent).toBe('Not yet invited14');
    expect(within(to).getByText('All guests')).toBeDefined();
  });

  it('greets one guest from their details, To holding their name', SLOW, async () => {
    await messages('inviteWriteOne');

    expect(screen.getByRole('button', { name: /^Bisi Adewale/ })).toBeDefined();
    expect(screen.getByText('Dear Auntie Bisi,')).toBeDefined();
  });

  it('refuses a note over 10,000 characters at Send, and clears once it fits', SLOW, async () => {
    await messages('inviteNoteLong');

    expect(screen.getByRole('alert').textContent).toBe(TOO_LONG);
    expect(note().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(note(), { target: { value: 'See you there.' } });
    expect(screen.queryByText(TOO_LONG)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(card()).toBeDefined();
  });

  it('previews by email only when there is no note, with no page', SLOW, async () => {
    await messages('invitePreview');

    expect(
      screen.getByRole('heading', { level: 3, name: 'As Bisi Adewale will see it' }),
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'On Bisi Adewale’s page' })).toBeNull();
    expect(screen.getByText('Yes, I’ll be there')).toBeDefined();
    expect(screen.queryByText('SMS · 2 parts')).toBeNull();
  });

  it('previews the note on their page, and Yusuf’s invitation by text', SLOW, async () => {
    await messages('invitePreviewNote');

    expect(screen.getByRole('region', { name: 'On Bisi Adewale’s page' }).textContent).toContain(
      'A note from Adaeze Obi and Tunde Bakare',
    );
    cleanupAndReset();
    await messages('invitePreviewSms');

    expect(screen.getByRole('region', { name: 'On Yusuf Ibrahim’s page' })).toBeDefined();
    expect(
      screen.getByText(
        "Adaeze Obi and Tunde Bakare: Yusuf Ibrahim, you're invited to Adaeze & Tunde's wedding on Thursday, Nov 5. Please reply by Wednesday, Nov 4 at [their own link]\nReply STOP to opt out.",
        { normalizer: (text) => text },
      ),
    ).toBeDefined();
    expect(screen.getByText('SMS · 2 parts · GSM-7 · 231 characters')).toBeDefined();
    expect(screen.getByText(/^Their first text from Ire Events/u)).toBeDefined();
  });

  it('checks the fourteen, counts ten seconds, and ⌘ Z gives the note back', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await messages('inviteCheck');

    expect(within(card()).getByText('Sending to 14 people cannot be undone.')).toBeDefined();
    expect(
      within(card()).getByText('Texts use 124 credits. Credits after sending: 1,376.'),
    ).toBeDefined();
    expect(note().readOnly).toBe(true);
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to 14 people' }));
    expect(said()).toContain('Sending in 10…');
    expect(screen.getByText('Dear Auntie Bisi,')).toBeDefined();

    await seconds(3);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'z', metaKey: true });

    expect(screen.getByText('Cancelled. No invitation was sent.')).toBeDefined();
    expect(note().value).toContain('We would love you there with us.');
  });

  it('leaves the 87 already invited out, or sends again to all 101', SLOW, async () => {
    await messages('inviteCheckSome');
    const choice = within(card()).getByRole('radiogroup', {
      name: '87 already have their invitation',
    });

    expect(within(choice).getByRole('radio', { name: 'Leave them out' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(card()).getByRole('button', { name: 'Send to 14 people' })).toBeDefined();
    fireEvent.click(within(choice).getByRole('radio', { name: 'Send again' }));
    expect(within(card()).getByRole('button', { name: 'Send to 101 people' })).toBeDefined();
    expect(within(card()).getByText('1 can’t be reached')).toBeDefined();
    expect(
      within(card()).getByText('Joaquín Ruiz · No email address · No phone number'),
    ).toBeDefined();
    expect(
      within(card()).getByText('Texts use 738 credits. Credits after sending: 762.'),
    ).toBeDefined();
  });

  it(
    'opens See all 87 in the card, the invited guests A to Z; Back to the check and the first Escape close it',
    SLOW,
    async () => {
      await messages('inviteCheckSeeAll');
      const head = within(card()).getByText('87 already have their invitation');

      await focused(head);
      const rows = within(card()).getByRole('list', { name: '87 already have their invitation' });

      expect(within(rows).getAllByRole('listitem')).toHaveLength(87);
      expect(within(rows).getAllByRole('listitem')[2]?.textContent).toBe(
        'Beatriz AlmeidaInvited by Soirely’s message, Oct 12',
      );
      expect(within(card()).queryByRole('radiogroup')).toBeNull();
      expect(within(card()).getByRole('button', { name: 'Send to 14 people' })).toBeDefined();

      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      const open = within(card()).getByRole('button', { name: 'See all 87' });

      await focused(open);
      expect(within(card()).getByRole('radiogroup')).toBeDefined();

      fireEvent.click(within(card()).getByRole('radio', { name: 'Send again' }));
      fireEvent.click(within(card()).getByRole('checkbox', { name: 'Email' }));
      expect(within(card()).getByText('92 can’t be reached')).toBeDefined();
      fireEvent.click(within(card()).getByRole('button', { name: 'See all 92' }));
      expect(within(card()).getAllByRole('listitem')).toHaveLength(92);
      fireEvent.click(within(card()).getByRole('button', { name: 'Back to the check' }));
      await focused(within(card()).getByRole('button', { name: 'See all 92' }));
    },
  );

  it('sends again to one guest already invited, with no choice', SLOW, async () => {
    await messages('inviteCheckAll');

    expect(within(card()).getByText('1 already has their invitation')).toBeDefined();
    expect(within(card()).queryByRole('radiogroup')).toBeNull();
    expect(within(card()).getByRole('button', { name: 'Send to 1 person' })).toBeDefined();
  });

  it('refuses a guest nobody can reach, with Change it alone', SLOW, async () => {
    await messages('inviteRefused');

    expect(within(card()).getByText('The invitation cannot be sent yet.')).toBeDefined();
    expect(
      within(card()).getByText('Joaquín Ruiz · No email address · No phone number'),
    ).toBeDefined();
    expect(within(card()).queryByRole('button', { name: /^Send to/ })).toBeNull();
    fireEvent.click(within(card()).getByRole('button', { name: 'Change it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it(
    'lands in its own Invitation conversation, says it is queued, then who is now Invited',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await messages('inviteCountdown');

      expect(screen.getByText('A note from Adaeze Obi and Tunde Bakare')).toBeDefined();
      await seconds(7);
      expect(said()).toContain('Invitations queued. Sending to 14 guests now.');
      await seconds(4);
      expect(screen.getByText('14 guests are now Invited, by Soirely’s message.')).toBeDefined();
      expect(screen.getByRole('textbox', { name: 'Write to them' })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Not yet invited · 14/ })).toBeDefined();
    },
  );

  it('sends nothing to the API', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetched = vi.spyOn(globalThis, 'fetch');

    await messages('inviteCheck');
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to 14 people' }));
    await seconds(14);

    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });
});

function list(): HTMLElement {
  return screen.getByRole('region', { name: 'Messages' });
}

function cleanupAndReset(): void {
  cleanup();
  resetSample();
  resetInbox();
}
