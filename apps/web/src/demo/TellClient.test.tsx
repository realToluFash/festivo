import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AC =
  'Hello Ana Ferreira, this is Casa Lume, confirming our consultation: Thursday 12 November at 15:00 Lisbon time, for 60 minutes, by video call. The link: https://meet.example.com/abc-defg-hij';

async function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/tell-client?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Ana Ferreira' }, WAIT);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Tell Ana Ferreira' });
}

describe('Tell {client} (sc-37133)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('offers Tell on each upcoming row and opens the AC’s message', SLOW, async () => {
    await open('upcoming');
    const tells = screen.getAllByRole('button', { name: 'Tell Ana Ferreira' });
    expect(tells).toHaveLength(2);

    fireEvent.click(tells[0] as HTMLElement);
    expect(within(panel()).getByText(AC)).toBeDefined();
    expect(within(panel()).getByRole('combobox', { name: 'Language' })).toBeDefined();
  });

  it('writes the Sends as links and shows the address instead of opening it', SLOW, async () => {
    await open('video');
    const whatsApp = within(panel()).getByRole('link', {
      name: 'Send on WhatsApp to Ana Ferreira',
    });
    const email = within(panel()).getByRole('link', { name: 'Send by email to Ana Ferreira' });
    expect(whatsApp.getAttribute('href')).toMatch(
      /^whatsapp:\/\/send\?phone=351912345678&text=Hello%20Ana/u,
    );
    expect(email.getAttribute('href')).toMatch(
      /^mailto:ana\.ferreira@example\.pt\?subject=Consultation%20with%20Casa%20Lume%2C%20Thursday%2012%20November&body=/u,
    );
    expect(
      within(panel()).getByText('Subject: Consultation with Casa Lume, Thursday 12 November'),
    ).toBeDefined();

    fireEvent.click(whatsApp);
    expect(within(panel()).getByText(whatsApp.getAttribute('href') ?? '')).toBeDefined();
  });

  it('says Copied only once the browser’s clipboard took it', SLOW, async () => {
    await open('video');
    const status = within(panel()).getByRole('status');
    const copy = within(panel()).getByRole('button', { name: 'Copy message for Ana Ferreira' });

    fireEvent.click(copy);
    expect(
      await within(status).findByText('Not copied. Select the message and copy it.'),
    ).toBeDefined();

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(copy);
    expect(await within(status).findByText('Copied')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(AC);
  });

  it('changes the message’s language for this press only', SLOW, async () => {
    await open('video');
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'Language' }), {
      target: { value: 'pt' },
    });
    expect(within(panel()).getByText(/às 15:00, hora de Lisboa/u)).toBeDefined();
  });

  it('puts Copy message first for a client best reached by text', SLOW, async () => {
    await open('order-text');
    const ways = within(panel())
      .getAllByRole('listitem')
      .map((one) => one.querySelector('a, button')?.getAttribute('aria-label'));
    expect(ways).toEqual([
      'Copy message for Ana Ferreira',
      'Send on WhatsApp to Ana Ferreira',
      'Send by email to Ana Ferreira',
    ]);
  });

  it('offers no Tell on a held consultation', SLOW, async () => {
    await open('held');
    expect(screen.getAllByRole('button', { name: 'Tell Ana Ferreira' })).toHaveLength(2);
    const card = screen.getByRole('region', { name: 'Consultations' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
  });

  it('offers Tell after a cancel, and leaving keeps it cancelled', SLOW, async () => {
    await open('offer-cancelled');
    const offer = screen.getByRole('complementary', { name: 'Consultation cancelled.' });
    expect(within(offer).getByText('Let Ana Ferreira know it is cancelled.')).toBeDefined();

    fireEvent.click(within(offer).getByRole('button', { name: 'Tell Ana Ferreira' }));
    expect(
      within(panel()).getByText(
        'Hello Ana Ferreira, this is Casa Lume. Our consultation on Thursday 12 November at 15:00 Lisbon time is cancelled.',
      ),
    ).toBeDefined();
  });

  it('opens at the row a notification named, its Tell focused', SLOW, async () => {
    await open('notification-changed');
    const tells = screen.getAllByRole('button', { name: 'Tell Ana Ferreira' });
    expect(document.activeElement).toBe(tells[1]);
  });
});
