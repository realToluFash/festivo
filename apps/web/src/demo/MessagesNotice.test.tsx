import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Your answer' }) as HTMLTextAreaElement;
}

function send(): void {
  fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });
}

function list(): HTMLElement {
  return screen.getByRole('region', { name: 'Messages' });
}

describe('a guest’s conversation at a desk (sc-3976)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    'turns the answer line over when WhatsApp is refused, and offers Email and SMS',
    SLOW,
    async () => {
      await messages('noticeNoConsent');
      const log = screen.getByRole('log', { name: 'Kwame Mensah' });

      expect(within(log).getByText('Sun, Nov 1')).toBeDefined();
      expect(within(log).getByText('What is the dress code?')).toBeDefined();
      expect(within(log).queryByText(/This came by SMS/)).toBeNull();
      expect(field().value).toBe('Formal: suits and long dresses are welcome.');
      expect(
        screen.getByText(
          'Your answer goes on Kwame Mensah’s page. Soirely cannot tell them by WhatsApp.',
        ),
      ).toBeDefined();
      expect(screen.getByText('Has not agreed to WhatsApp')).toBeDefined();
      expect(screen.getByText('Tell them now by:')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Tell them now by email' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Tell them now by SMS' }));

      expect(
        screen.getByText('Your answer goes on Kwame Mensah’s page. Soirely tells them by SMS.'),
      ).toBeDefined();
      expect(
        screen.getByText('This text uses 9 credits. Credits after sending: 1,491.'),
      ).toBeDefined();
      expect(screen.queryByText('Has not agreed to WhatsApp')).toBeNull();
      expect(document.activeElement).toBe(field());
    },
  );

  it('puts the answer on their page as Not sent when sent without a channel', SLOW, async () => {
    await messages('noticeBouncing');
    const log = screen.getByRole('log', { name: 'Inês Duarte' });

    expect(within(log).getByText('Email · Bounced')).toBeDefined();
    expect(
      screen.getByText(
        'No other channel can tell them now. They see your answer when they next open their page.',
      ),
    ).toBeDefined();

    send();

    expect(within(log).getByText('Email · Not sent · Address is bouncing')).toBeDefined();
    expect(field().value).toBe('');
    expect(screen.getByText('Address is bouncing')).toBeDefined();
  });

  it('says a WhatsApp message unavailable in their language after Send', SLOW, async () => {
    await messages('noticeNoTemplate');

    expect(
      screen.getByText('Soirely’s WhatsApp message cannot be sent in Spanish at the moment.'),
    ).toBeDefined();
    send();

    expect(
      within(screen.getByRole('log', { name: 'Lucía Ortega' })).getByText(
        'WhatsApp · Not sent · WhatsApp message unavailable in Spanish',
      ),
    ).toBeDefined();
  });

  it('marks a stop with its time, and a stopped number’s reason by Intl', SLOW, async () => {
    await messages('noticeStopped');
    const log = screen.getByRole('log', { name: 'Kwame Mensah' });

    expect(within(log).getByText('Kwame Mensah stopped texts · 21:40')).toBeDefined();
    expect(within(log).queryByText(/This came by SMS/)).toBeNull();
    expect(
      screen.getByText('Texted STOP on Mon, Nov 2 at 21:40. Texting START brings texts back.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tell them now by SMS' })).toBeNull();
    expect(
      within(list()).getByRole('link', { name: /SMS · What is the dress code\?/ }),
    ).toBeDefined();
  });

  it(
    'says nothing was sent when the 24 hours ran out, and Send goes as the template',
    SLOW,
    async () => {
      await messages('noticeWindowClosed');
      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain(
        'Nothing was sent. The 24 hours after their last WhatsApp message ran out while you were writing.',
      );
      expect(alert.textContent).toContain(
        'Send again to tell them with Soirely’s approved WhatsApp message.',
      );
      expect(
        screen.getByText('This WhatsApp message uses 4 credits. Credits after sending: 1,496.'),
      ).toBeDefined();
      expect(
        within(list()).getByRole('link', { name: /WhatsApp · Is there parking at The Landmark\?/ }),
      ).toBeDefined();

      send();

      expect(screen.queryByRole('alert')).toBeNull();
      expect(
        await within(screen.getByRole('log', { name: 'Lucía Ortega' })).findByText(
          'Told by WhatsApp',
          {},
          SLOW,
        ),
      ).toBeDefined();
    },
  );

  it('follows the alert with the refusal when the template can’t go', SLOW, async () => {
    await messages('noticeWindowRefused');

    expect(screen.getByRole('alert').textContent).not.toContain('Send again');
    expect(screen.getByRole('button', { name: 'Tell them now by SMS' })).toBeDefined();
    expect(screen.queryByText(/Credits after sending/)).toBeNull();
  });

  it('lets a notice wait for quiet hours, and says so on the answer', SLOW, async () => {
    await messages('noticeQuiet');

    expect(screen.getByText('This WhatsApp message waits until 09:00, their time.')).toBeDefined();
    expect(
      screen.getByText('This WhatsApp message uses 2 credits. Credits after sending: 1,498.'),
    ).toBeDefined();

    send();

    expect(
      within(screen.getByRole('log', { name: 'Valentina Restrepo' })).getByText(
        'WhatsApp · Waiting until 09:00, their time',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('This WhatsApp message uses 2 credits. Credits after sending: 1,496.'),
    ).toBeDefined();
    expect(screen.getByText('This WhatsApp message waits until 09:00, their time.')).toBeDefined();
  });

  it('asks an owner in place of Add credits, for a member without billing', SLOW, async () => {
    await messages('noticeAskFailed');

    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Not sent. Try again in a moment.');
    expect(screen.getByLabelText('Bisi Okafor, Admin')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ask an owner' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      await screen.findByText('The owners have been sent the link to Plan and billing.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Tell them now by email' }));
    send();
    expect(
      within(screen.getByRole('log', { name: 'Lucía Ortega' })).getByText('Bisi Okafor · 09:41'),
    ).toBeDefined();
  });

  it('marks texts back on after START, with the usual SMS composer', SLOW, async () => {
    await messages('textsBackOn');
    const log = screen.getByRole('log', { name: 'Kwame Mensah' });

    expect(within(log).getByText('Kwame Mensah started texts again · 08:30')).toBeDefined();
    expect(
      screen.getByText('This text uses 9 credits. Credits after sending: 1,491.'),
    ).toBeDefined();
    expect(field().value).toBe('');
  });

  it('says how many attachments a later email had that it did not keep', SLOW, async () => {
    await messages('attachmentsNotKept');
    const log = screen.getByRole('log', { name: 'Camille Dubois' });

    expect(within(log).getByText('2 attachments not kept')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Change guest' })).toBeDefined();
  });

  it('names a number two guests share, and lets the host change the guest', SLOW, async () => {
    await messages('sharedNumber');

    expect(screen.getByText('+44 7700 900412 · shared by 2 guests')).toBeDefined();
    expect(
      screen.getByText(
        '2 guests share this number. Soirely matched it to Kwame Mensah, the one it last messaged there.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Change guest' }));

    expect(screen.getByRole('dialog', { name: 'Who is this?' })).toBeDefined();
  });

  it('gives a Read-only member no answer box, no addresses and no New', SLOW, async () => {
    await messages('readOnly');

    expect(screen.queryByRole('textbox', { name: 'Your answer' })).toBeNull();
    expect(screen.getByText('Only someone who can change Messages can send.')).toBeDefined();
    expect(screen.queryByText('ines.duarte@sapo.pt')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as done' })).toBeNull();
    expect(within(list()).getByRole('link', { name: /^Unknown sender/ })).toBeDefined();
    expect(screen.getByLabelText('Kofi Mensah, Read-only')).toBeDefined();
  });
});
