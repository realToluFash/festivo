import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import type * as GuestsSample from './guests.ts';
import { resetInbox } from './messages.ts';

const seed = vi.hoisted(() => ({ companionAlone: false }));

vi.mock('./guests.ts', async (importOriginal) => {
  const real = await importOriginal<typeof GuestsSample>();

  return {
    ...real,
    guestsStart: (...args: Parameters<typeof real.guestsStart>) => {
      const start = real.guestsStart(...args);
      const [first, ...rest] = start.list;

      return seed.companionAlone && first != null
        ? {
            ...start,
            list: [
              {
                ...first,
                companions: [
                  ...first.companions,
                  { id: `${first.id}-alone`, name: null, reply: 'notYet' as const },
                ],
              },
              ...rest,
            ],
          }
        : start;
    },
  };
});

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const MESSAGES = '/demo/events/evt-wed-4/messages';

async function guests(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guests?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);

  return router;
}

function header(): string[] {
  const top = document.querySelector<HTMLElement>('.gs-top') as HTMLElement;

  return within(top)
    .getAllByRole('button')
    .map((one) => one.textContent ?? '');
}

function invitation(): string[] {
  const section = screen.getByRole('region', { name: 'Invitation' });

  return [...section.querySelectorAll('.gs-do .desk-row-name')].map((one) => one.textContent ?? '');
}

async function composer(chip: RegExp): Promise<void> {
  expect(await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT)).toBeDefined();
  expect(screen.getByRole('button', { name: chip })).toBeDefined();
  expect(screen.getByRole('textbox', { name: /^Note for your guests/u })).toBeDefined();
}

beforeEach(() => {
  seed.companionAlone = false;
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  resetInbox();
});

describe('Guests, Send invitations (sc-3971)', () => {
  it(
    'puts Send invitations between Export and Add guest, opening the invitation on Not yet invited',
    SLOW,
    async () => {
      const router = await guests('inviteList');

      expect(header()).toEqual(['Export', 'Send invitations', 'Add guest']);
      fireEvent.click(screen.getByRole('button', { name: 'Send invitations' }));

      await composer(/^Not yet invited · 14/u);
      expect(router.state.location.pathname).toBe(MESSAGES);
    },
  );

  it(
    'offers Send invitation first on a guest not yet invited, To that one guest',
    SLOW,
    async () => {
      await guests('inviteGuest');

      expect(invitation()).toEqual([
        'Send invitation',
        'Copy invitation link',
        'Replace link…',
        'Mark as invited',
      ]);
      expect(screen.getByText('Soirely sends it to them by email or text.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /^Send invitation(?!s)/u }));

      await composer(/^Bisi Adewale/u);
    },
  );

  it('keeps Send on WhatsApp beside it for a guest with a mobile', SLOW, async () => {
    await guests('inviteGuestMobile');

    expect(invitation()).toEqual([
      'Send invitation',
      'Copy invitation link',
      'Send on WhatsApp',
      'Replace link…',
      'Mark as invited',
    ]);
  });

  it('offers it on a guest already invited, after their invited line', SLOW, async () => {
    await guests('inviteGuestInvited');

    expect(screen.getByRole('region', { name: 'Invitation' }).textContent).toMatch(
      /^Invitation.*Invited by Folake Adeyemi, WhatsApp, Oct 9.*Send invitation/u,
    );
    expect(invitation()[0]).toBe('Send invitation');
    fireEvent.click(screen.getByRole('button', { name: /^Send invitation(?!s)/u }));

    await composer(/^Dr Emeka Nwosu/u);
  });

  it('drops Send invitations once nobody is left to invite', SLOW, async () => {
    await guests('inviteNoneLeft');

    expect(header()).toEqual(['Export', 'Add guest']);
    expect(screen.getByText('96 coming of 156 invited')).toBeDefined();
    expect(screen.getByRole('button', { name: 'No reply · 35' })).toBeDefined();
    expect(screen.getAllByText('Invited by Soirely’s message, Nov 3')).toHaveLength(14);
  });

  it('does not count a companion alone as somebody left to invite', SLOW, async () => {
    seed.companionAlone = true;
    await guests('inviteNoneLeft');

    expect(header()).toEqual(['Export', 'Add guest']);
    fireEvent.click(screen.getByRole('button', { name: /^No reply · /u }));
    expect(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /^Not yet invited/u })
        .textContent,
    ).toBe('Not yet invited1');
  });

  it.each(['draft', 'draftGuest', 'paused', 'finished', 'exportGrantView'])(
    'offers neither on %s',
    SLOW,
    async (state) => {
      await guests(state);

      expect(screen.queryByRole('button', { name: 'Send invitations' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Send invitation\b/u })).toBeNull();
    },
  );
});
