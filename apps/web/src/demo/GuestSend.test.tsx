import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample, sampleEvent } from './events.ts';
import { LINK, WEDDING, sampleGuests } from './guests.ts';
import { keepAsked, keptAsked, messageOf, whatsAppHref } from './whatsAppSend.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const YUSUF = 'Send on WhatsApp to Yusuf Ibrahim';
const QUESTION = 'Sent to Yusuf Ibrahim on WhatsApp?';

async function guests(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guests?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function column(): HTMLElement {
  return screen.getByRole('main').querySelector<HTMLElement>('.gs-column') as HTMLElement;
}

function question(): HTMLElement | null {
  return within(column()).queryByRole('group', { name: QUESTION });
}

function markFromQuestion(): void {
  fireEvent.click(
    within(question() as HTMLElement).getByRole('button', { name: 'Mark as invited' }),
  );
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  sessionStorage.clear();
});

afterEach(cleanup);

describe('Send on WhatsApp, the address (sc-26025)', () => {
  const event = sampleEvent(WEDDING);
  const yusuf = sampleGuests(WEDDING).find((one) => one.id === 'yusuf');

  it('opens WhatsApp’s own address with the digits and the encoded invitation', () => {
    if (event == null || yusuf == null) throw new Error('sample missing');
    const href = whatsAppHref(yusuf, event, LINK) ?? '';

    expect(href.startsWith('whatsapp://send?phone=2348092214410&text=')).toBe(true);
    expect(href).not.toMatch(/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|https?%3A%2F%2Fwa/u);
    expect(decodeURIComponent(href.split('&text=')[1] ?? '')).toBe(
      `Yusuf Ibrahim, Adaeze Obi and Tunde Bakare would love you to come to Adaeze & Tunde’s wedding on November 5, 2026. Your own page, to reply and see the details: ${LINK}`,
    );
  });

  it('greets by Greet as when the host set one', () => {
    if (event == null || yusuf == null) throw new Error('sample missing');

    expect(messageOf({ ...yusuf, greetAs: 'Uncle Yusuf' }, event, LINK)).toMatch(
      /^Uncle Yusuf, Adaeze Obi and Tunde Bakare/u,
    );
  });

  it('has no address for a guest with no mobile number', () => {
    if (event == null || yusuf == null) throw new Error('sample missing');

    expect(whatsAppHref({ ...yusuf, phone: null }, event, LINK)).toBeNull();
  });

  it('keeps the open questions in this tab only, per event', () => {
    keepAsked(WEDDING, new Set(['yusuf']));

    expect(keptAsked(WEDDING)).toEqual(['yusuf']);
    expect(keptAsked('evt-party-2')).toEqual([]);
    keepAsked(WEDDING, new Set());
    expect(keptAsked(WEDDING)).toEqual([]);
  });
});

describe('Send on WhatsApp, the question (sc-26025)', () => {
  it(
    'asks after the press, in place of Mark as invited, and Not sent records nothing',
    SLOW,
    async () => {
      await guests('sendNone');
      const send = within(column()).getByRole('link', { name: YUSUF });

      expect(within(column()).getAllByRole('button', { name: /^Mark as invited/u })).toHaveLength(
        2,
      );
      fireEvent.click(send);

      await waitFor(() => expect(document.activeElement).toBe(question()), WAIT);
      expect(within(column()).queryAllByRole('button', { name: /^Mark as invited/u })).toHaveLength(
        1,
      );
      expect(
        within(column()).getByText('If WhatsApp didn’t open, use Copy invitation link instead.'),
      ).toBeDefined();
      expect(keptAsked(WEDDING)).toEqual(['yusuf']);

      fireEvent.click(within(question() as HTMLElement).getByRole('button', { name: 'Not sent' }));

      expect(question()).toBeNull();
      await waitFor(
        () => expect(document.activeElement?.getAttribute('aria-label')).toBe(YUSUF),
        WAIT,
      );
      expect(keptAsked(WEDDING)).toEqual([]);
      expect(screen.getByRole('link', { name: /^Yusuf Ibrahim/u })).toBeDefined();
    },
  );

  it(
    'marks from the question: they leave Not yet invited and the next row takes the focus',
    SLOW,
    async () => {
      await guests('sendQuestion');
      markFromQuestion();

      expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDefined();
      await waitFor(
        () => expect(screen.queryByRole('link', { name: /^Yusuf Ibrahim/u })).toBeNull(),
        WAIT,
      );
      await waitFor(
        () => expect(document.activeElement?.getAttribute('data-focus')).toMatch(/^row:/u),
        WAIT,
      );
    },
  );

  it('sends the focus to the list’s heading when the last one leaves', SLOW, async () => {
    await guests('sendLastOne');
    markFromQuestion();

    await waitFor(
      () => expect(document.activeElement?.getAttribute('data-focus')).toBe('none-heading'),
      WAIT,
    );
  });

  it('keeps the question when the mark fails, and the next press goes through', SLOW, async () => {
    await guests('sendFails');
    markFromQuestion();

    expect(
      await within(column()).findByText(
        'Not saved. They are still Not yet invited. Try again.',
        {},
        WAIT,
      ),
    ).toBeDefined();
    expect(question()).not.toBeNull();

    markFromQuestion();
    await waitFor(
      () => expect(screen.queryByRole('link', { name: /^Yusuf Ibrahim/u })).toBeNull(),
      WAIT,
    );
  });

  it(
    'drops the question on a refused mark: the paused line, and no Send on WhatsApp',
    SLOW,
    async () => {
      await guests('sendRefused');
      markFromQuestion();

      expect(
        await screen.findByText('Guests can’t be invited while this event is paused.', {}, WAIT),
      ).toBeDefined();
      expect(question()).toBeNull();
      expect(within(column()).queryByRole('link', { name: YUSUF })).toBeNull();
      expect(keptAsked(WEDDING)).toEqual([]);
    },
  );

  it('shows no question once the event left Live', SLOW, async () => {
    await guests('sendLeftLive');

    expect(screen.getByText('Guests can’t be invited while this event is paused.')).toBeDefined();
    expect(question()).toBeNull();
    expect(within(column()).queryByRole('link', { name: YUSUF })).toBeNull();
  });

  it('drops the question for a guest a colleague marked meanwhile', SLOW, async () => {
    await guests('sendBecameInvited');

    expect(question()).toBeNull();
    expect(within(column()).getByRole('link', { name: YUSUF })).toBeDefined();
  });

  it('asks nothing of a guest already invited', SLOW, async () => {
    await guests('sendInvited');
    fireEvent.click(within(column()).getByRole('link', { name: 'Send on WhatsApp to Amaka Eze' }));

    expect(within(column()).queryByRole('group')).toBeNull();
    expect(keptAsked(WEDDING)).toEqual([]);
  });

  it('keeps two questions open at once, one per guest', SLOW, async () => {
    await guests('sendTwo');

    expect(question()).not.toBeNull();
    expect(keptAsked(WEDDING)).toEqual(['yusuf', 'chuka-nwankwo']);
  });

  it('is not offered to a guest with no mobile number', SLOW, async () => {
    await guests('sendNoMobile');

    expect(within(column()).queryByRole('link', { name: /^Send on WhatsApp/u })).toBeNull();
  });

  it(
    'is not offered on a Finished event, where Copy invitation link is gone too',
    SLOW,
    async () => {
      await guests('sendFinished');

      expect(within(column()).queryByRole('link', { name: YUSUF })).toBeNull();
      expect(within(column()).queryByRole('button', { name: /^Copy invitation link/u })).toBeNull();
    },
  );

  it('brings an unanswered question back after a reload in the same tab', SLOW, async () => {
    keepAsked(WEDDING, new Set(['yusuf']));
    await guests('sendNone');

    expect(question()).not.toBeNull();
  });
});
