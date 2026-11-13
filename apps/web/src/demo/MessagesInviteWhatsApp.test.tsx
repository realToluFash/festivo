import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/messages?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

describe('the invitation by WhatsApp, at a desk (sc-45251)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => cleanup());

  it('offers WhatsApp unticked, with the note hint naming it', SLOW, async () => {
    await messages('inviteWhatsAppOffered');

    expect(screen.getByRole('checkbox', { name: 'WhatsApp' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByRole('checkbox', { name: 'Email' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByText(
        'Shown on each guest’s page, in Messages. Never sent by email, text or WhatsApp.',
      ),
    ).toBeTruthy();
  });

  it(
    'shows the reach line with its US part and the instead line under the ticks',
    SLOW,
    async () => {
      await messages('inviteWhatsAppSms');

      expect(screen.getByText(/2 have US numbers$/u)).toBeTruthy();
      expect(screen.getByText('5 by WhatsApp instead of SMS')).toBeTruthy();
    },
  );

  it('checks with the WhatsApp pill and both kinds of credits', SLOW, async () => {
    await messages('inviteCheckWhatsApp');

    const check = screen.getByRole('alertdialog', { name: 'Check it before it goes' });

    expect(within(check).getByText(/^WhatsApp · 5$/u)).toBeTruthy();
    expect(
      within(check).getByText(
        'Texts and WhatsApp messages use 230 credits. Credits after sending: 1,270.',
      ),
    ).toBeTruthy();
  });

  it(
    'previews the template with one button and no SMS for a guest WhatsApp reaches',
    SLOW,
    async () => {
      await messages('invitePreviewWhatsApp');

      const card = screen.getByText('Reply on your page').parentElement;

      if (card == null) throw new Error('no template card');
      expect(within(card).getByText('Dear Chuka Nwankwo,')).toBeTruthy();
      expect(screen.queryByText(/^Adaeze Obi and Tunde Bakare: /u)).toBeNull();
    },
  );

  it('opens Who it reached with Failed as its own group and Try SMS instead', SLOW, async () => {
    await messages('invitedReachedWhatsAppNoSms');

    expect(
      screen.getAllByText(/10 now Invited · 1 in progress · 1 bounced · 1 failed/u).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Try SMS instead' }).length).toBe(3);
    expect(screen.getAllByText(/Has a US number/u).length).toBeGreaterThan(0);
  });
});
