import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const QUESTION = 'Make Bisi & Kola’s engagement live?';
const OFFER = 'Send invitations to 11 guests now?';

function open(state: string, id = 'evt-draft-4'): void {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/${id}?state=${state}`],
  });

  render(<RouterProvider router={router} />);
}

async function alert(name: string): Promise<HTMLElement> {
  return screen.findByRole('alertdialog', { name }, WAIT);
}

function buttons(box: HTMLElement): string[] {
  return within(box)
    .getAllByRole('button')
    .map((one) => one.textContent ?? '');
}

function toast(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.toast');
}

describe('Make live, then the offer to send invitations, at a desk (sc-3971)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    'asks, makes it live, turns into the offer, sends and says so politely with Messages',
    SLOW,
    async () => {
      open('makeLive');
      const box = await alert(QUESTION);

      expect(within(box).getByText(/^Guests can be invited, and they can see it\./u)).toBeDefined();
      expect(buttons(box)).toEqual(['Not yet', 'Make live']);
      await waitFor(() => expect(document.activeElement?.textContent).toBe('Not yet'), WAIT);
      fireEvent.click(within(box).getByRole('button', { name: 'Make live' }));
      expect(
        within(box).getByRole('button', { name: 'Making live…' }).getAttribute('aria-busy'),
      ).toBe('true');

      const offer = await alert(OFFER);
      const heading = within(offer).getByRole('heading', { name: OFFER });

      await waitFor(() => expect(document.activeElement).toBe(heading), WAIT);
      expect(within(offer).getByText('Bisi & Kola’s engagement is live.')).toBeDefined();
      expect(
        within(offer).getByText('Texts use 146 credits. Credits after sending: 104.'),
      ).toBeDefined();
      expect(buttons(offer)).toEqual(['Not yet', 'Send them']);
      fireEvent.click(within(offer).getByRole('button', { name: 'Send them' }));
      expect(within(offer).getByRole('button', { name: 'Sending…' })).toBeDefined();

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      const said = toast() as HTMLElement;

      expect(said.getAttribute('role')).toBe('status');
      expect(within(said).getByText('Invitations queued. Sending to 11 guests now.')).toBeDefined();
      expect(within(said).getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe(
        '/demo/events/evt-wed-4/messages?state=invited',
      );
      expect(screen.getByText(/^Demo only: the engagement has no messages here/u)).toBeDefined();
    },
  );

  it(
    'keeps the question on Escape as Not yet, and Not yet on the offer leaves it Live with no toast',
    SLOW,
    async () => {
      open('makeLive');
      await alert(QUESTION);
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);

      cleanup();
      open('makeLiveOffer');
      const offer = await alert(OFFER);

      fireEvent.click(within(offer).getByRole('button', { name: 'Not yet' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(toast()).toBeNull();
    },
  );

  it(
    'draws what waits for credits with sc-3963’s lines, and one guest in the singular',
    SLOW,
    async () => {
      open('makeLiveOfferPart');
      const part = await alert(OFFER);

      expect(within(part).getByText('Texts use 22 credits.')).toBeDefined();
      expect(within(part).getByText('Email goes either way.')).toBeDefined();
      expect(within(part).getByText('1 SMS message will wait for credits.')).toBeDefined();

      cleanup();
      open('makeLiveOfferOne');
      const one = await alert('Send the invitation to 1 guest now?');

      expect(buttons(one)).toEqual(['Not yet', 'Send it']);
    },
  );

  it(
    'cannot send to nobody reachable, nor without the right, and says why with Close alone',
    SLOW,
    async () => {
      open('makeLiveOfferNobody');
      const nobody = await alert('The invitations cannot be sent yet.');

      expect(within(nobody).getByRole('alert').textContent).toBe(
        'None of the 11 guests can be reached. Add an email address or a mobile number for them in Guests.',
      );
      expect(buttons(nobody)).toEqual(['Close']);

      cleanup();
      open('makeLiveOfferForbidden');
      const forbidden = await alert('The invitations cannot be sent yet.');

      expect(within(forbidden).getByRole('alert').textContent).toBe(
        'Your role no longer includes sending messages, so nothing was sent.',
      );
    },
  );

  it(
    'says it was not sent under the offer, and makes no offer when nobody is Not yet invited',
    SLOW,
    async () => {
      open('makeLiveOfferNotSent');
      const offer = await alert(OFFER);

      expect(within(offer).getByRole('alert').textContent).toBe('Not sent. Try again in a moment.');

      cleanup();
      open('makeLiveNoOffer', 'evt-cena-4');
      const box = await screen.findByRole('alertdialog', {}, WAIT);

      fireEvent.click(within(box).getByRole('button', { name: 'Make live' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(toast()?.textContent).toContain('✓ Live');
    },
  );

  it(
    'asks for Host 1 on a draft with no host, refuses it empty, and makes it live once typed',
    SLOW,
    async () => {
      open('makeLiveHost');
      const box = await alert(QUESTION);
      const field = within(box).getByLabelText('Host 1');

      await waitFor(() => expect(document.activeElement).toBe(field), WAIT);
      expect(
        within(box).getByText(/^Guests read this name on their invitation and their page\./u),
      ).toBeDefined();
      fireEvent.click(within(box).getByRole('button', { name: 'Make live' }));
      expect(within(box).getByRole('alert').textContent).toBe(
        'Enter who is hosting to make this event live.',
      );
      expect(field.getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(field, { target: { value: 'Bisi Akindele' } });
      expect(within(box).queryByRole('alert')).toBeNull();
      fireEvent.keyDown(field, { key: 'Enter' });

      await alert(OFFER);
      expect(screen.getAllByText(/Bisi Akindele/u).length).toBeGreaterThan(0);

      cleanup();
      open('makeLiveHostBlank');
      const blank = await alert(QUESTION);

      expect(within(blank).getByRole('alert').textContent).toBe(
        'Enter who is hosting to make this event live.',
      );
    },
  );

  it(
    'says an ended draft cannot be made live, with Change dates opening Dates, and that somebody else made it live with Close alone',
    SLOW,
    async () => {
      open('makeLiveEndPassed', 'evt-shower-2');
      const ended = await alert('Not made live.');

      expect(within(ended).getByRole('alert').textContent).toBe(
        'This event’s end has passed, so it cannot be made live. Change its dates first.',
      );
      expect(buttons(ended)).toEqual(['Close', 'Change dates']);
      fireEvent.click(within(ended).getByRole('button', { name: 'Change dates' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(document.querySelector('.ev-detail[aria-expanded="true"]')?.textContent).toContain(
        'Dates',
      );

      cleanup();
      open('makeLiveChanged');
      const changed = await alert('Somebody else changed this event while you had it open.');

      expect(within(changed).getByRole('alert').textContent).toBe(
        'It’s live now. The page shows what it is now.',
      );
      expect(buttons(changed)).toEqual(['Close']);
      fireEvent.click(within(changed).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(toast()).toBeNull();
    },
  );

  it(
    'makes it live with no offer for a member who cannot send, and says ✓ Live',
    SLOW,
    async () => {
      open('makeLiveCannotSend');
      const box = await alert(QUESTION);

      fireEvent.click(within(box).getByRole('button', { name: 'Make live' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), WAIT);
      expect(toast()?.textContent).toContain('✓ Live');
    },
  );
});
