import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { GUEST_PAGES, THANK_YOU } from './guest.ts';
import { KITCHEN_PAGES } from './kitchen.ts';

const tested = config();
const NAME = 'Maria Fernanda Albuquerque Santos';
const plain = window.matchMedia;

/** The four width queries the page asks, answered for one window width. */
function widthIs(width: number): void {
  window.matchMedia = (query: string) => {
    const found = /\(width (<=|<|>=) ([\d.]+)rem\)/u.exec(query);
    const edge = Number(found?.[2] ?? 0) * 16;
    const matches =
      found == null
        ? false
        : found[1] === '<'
          ? width < edge
          : found[1] === '<='
            ? width <= edge
            : width >= edge;

    return { matches, media: query, addEventListener() {}, removeEventListener() {} } as never;
  };
}

async function guest(state?: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [state == null ? '/demo/guest' : `/demo/guest?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner');

  return router;
}

function page(): HTMLElement {
  return document.querySelector('.gp') as HTMLElement;
}

async function wait(ms = 1000): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  __setConfig(tested);
  window.matchMedia = plain;
  vi.useRealTimers();
});

describe('the guest’s own page, A · The cover card (sc-31306)', () => {
  it('is linked from the demo home, every state once, in a Guest’s page group', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
    render(<RouterProvider router={router} />);
    const head = await screen.findByRole('heading', { level: 3, name: /^Guest’s page/u });

    expect(head.textContent).toBe('Guest’s page in A · The cover card · phone, tablet and desk');
    const hrefs = screen.getAllByRole('link').map((one) => one.getAttribute('href'));
    const kitchen = new Set(KITCHEN_PAGES.flatMap((one) => one.states).map((one) => one.to));
    const guestLinks = hrefs.filter(
      (href) => href?.startsWith('/demo/guest?') && !kitchen.has(href),
    );

    expect(guestLinks).toEqual(GUEST_PAGES.flatMap((one) => one.states).map((one) => one.to));
    expect(guestLinks).toHaveLength(47);
  });

  it('opens on the cover card: the invitation, the guest, the event, when and where', async () => {
    await guest();

    expect(screen.getByRole('heading', { level: 1, name: 'You are invited' })).toBeDefined();
    expect(screen.getByText(NAME)).toBeDefined();
    expect(screen.getByText('Adaeze & Tunde’s wedding')).toBeDefined();
    expect(screen.getByText(/^Thu, Nov 5 · 18:00 · The Landmark$/u)).toBeDefined();
    expect(screen.getByRole('img', { name: 'Soirely' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Language: English' })).toBeDefined();
    expect(screen.queryByText('Create an account')).toBeNull();
    expect(screen.getByText('© 2026 Soirely')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open in maps' }).getAttribute('target')).toBe(
      '_blank',
    );
    expect(screen.getByText('You do not need an account to answer.')).toBeDefined();
  });

  it('answers as three full-width rows, Yes leading on', async () => {
    await guest();
    const rows = within(screen.getByRole('heading', { name: 'Your answer' }).closest('section')!)
      .getAllByRole('button')
      .map((row) => row.querySelector('.gp-answer-words')?.textContent);

    expect(rows).toEqual(['Yes, I’ll be there', 'Sorry, I can’t', 'I’m not sure yet']);
  });
});

const SAYS: [string, () => void][] = [
  ['open', () => screen.getByText(/^Please answer by Friday, October 30\./u)],
  ['openNoDate', () => expect(screen.queryByText(/^Please answer by/u)).toBeNull()],
  ['check', () => screen.getByText('Nothing is sent until you press Send my answer.')],
  [
    'sending',
    () =>
      expect(screen.getByRole('button', { name: 'Send my answer' }).getAttribute('aria-busy')).toBe(
        'true',
      ),
  ],
  ['notSent', () => screen.getByRole('alert', { name: '' })],
  [
    'sendingTap',
    () =>
      expect(screen.getByRole('button', { name: 'Sorry, I can’t' }).getAttribute('aria-busy')).toBe(
        'true',
      ),
  ],
  ['notSentTap', () => screen.getByText(/Check your connection and tap it again\.$/u)],
  ['coming', () => screen.getByRole('heading', { name: `See you there, ${NAME}.` })],
  ['comingAlone', () => screen.getByText('A screenshot works too.')],
  ['notComing', () => screen.getByRole('heading', { name: `We’ll miss you, ${NAME}.` })],
  ['notSure', () => screen.getByText('Your companions are on hold until you decide.')],
  ['changing', () => screen.getByRole('heading', { name: 'Your new answer' })],
  ['sameAnswer', () => screen.getByText('You’re already down as Coming. Nothing has changed.')],
  ['unsentReturn', () => screen.getByRole('status', { name: '' })],
  [
    'replyByClosed',
    () => screen.getByRole('button', { name: 'Update what the kitchen should know' }),
  ],
  ['replyByClosedNotSure', () => screen.getByText(/if you can still come\.$/u)],
  ['closedRefused', () => screen.getByText(/^Answers closed before this was sent\./u)],
  [
    'closed',
    () => screen.getByText('Answers have closed. Contact your host if something has changed.'),
  ],
  ['closedNever', () => screen.getByRole('heading', { name: 'You didn’t answer.' })],
  ['paused', () => screen.getByText(/^This event is paused\./u)],
  ['pausedNever', () => screen.getByRole('heading', { name: 'You didn’t answer.' })],
  ['pausedAfterStart', () => expect(screen.queryByText('Change my answer')).toBeNull()],
  ['zone', () => expect(screen.getAllByText(/18:00 Europe\/London/u)).toHaveLength(2)],
  ['calledOff', () => screen.getByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' })],
  ['over', () => expect(screen.queryByText(THANK_YOU)).toBeNull()],
  ['overNever', () => screen.getByText('You didn’t answer.')],
  ['finished', () => screen.getByText(THANK_YOU)],
  [
    'gone',
    () => screen.getByRole('heading', { level: 1, name: 'This invitation link does not work' }),
  ],
  ['unreachable', () => screen.getByRole('heading', { level: 1, name: 'Cannot reach Soirely' })],
  ['loading', () => screen.getByText('Loading…')],
  ['french', () => screen.getByRole('menu', { name: 'Langue' })],
  ['photo', () => expect(document.querySelector('.gp-cover.is-photo')).not.toBeNull()],
  ['tellUs', () => screen.getByRole('button', { name: 'Go back' })],
  ['tellUsFailed', () => screen.getByText('Not sent. Check your connection and try again.')],
  ['tellUsLimited', () => screen.getByText('Too many tries from this link. Try again later.')],
  [
    'tellUsThanks',
    () => screen.getByText(/^Thank you\. Adaeze Obi and Tunde Bakare have been told/u),
  ],
  ['message', () => expect(screen.getAllByRole('article')).toHaveLength(1)],
  ['messages', () => expect(screen.getAllByRole('article')).toHaveLength(3)],
  ['messageArrival', () => expect(Element.prototype.scrollIntoView).toHaveBeenCalled()],
  [
    'replyWriting',
    () =>
      expect(screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare')).toHaveProperty(
        'value',
        'Thank you! Is there a cloakroom at The Landmark?',
      ),
  ],
  ['messageLong', () => screen.getByText('950 of 1,000 characters')],
  ['messageTooLong', () => screen.getByText('1,042 of 1,000 characters')],
  ['replySending', () => screen.getByText('Sending…')],
  ['replySent', () => screen.getByText(/^Sent · Tue, Nov 3 · 09:41$/u)],
  ['replyFailed', () => screen.getByText(/^Your message wasn’t sent\./u)],
  ['calledOffMessages', () => expect(screen.getAllByRole('article')).toHaveLength(3)],
  ['finishedMessages', () => screen.getByText(THANK_YOU)],
];

describe('every state, deep-linked by ?state=', () => {
  it('covers every state the home links', () => {
    expect(SAYS.map(([state]) => state)).toEqual(
      GUEST_PAGES.flatMap((one) => one.states).map((one) => /state=(\w+)/u.exec(one.to)?.[1]),
    );
  });

  it.each(SAYS)('%s', async (state, says) => {
    await guest(state);

    says();
  });
});

describe('the breakpoints', () => {
  it.each([
    [320, 'is-small', 'is-one'],
    [402, 'is-phone', 'is-one'],
    [834, 'is-upright', 'is-one'],
    [1194, 'is-side', 'is-two'],
    [1280, 'is-desk', 'is-two'],
  ] as const)('%i wide lays out %s in %s', async (width, layout, columns) => {
    widthIs(width);
    await guest('paused');

    expect(page().classList.contains(layout)).toBe(true);
    expect(document.querySelector('main')?.classList.contains(columns)).toBe(true);
  });

  it.each([402, 834, 1194, 1280])(
    'reads the notice, the cover, the answer, the details and the foot in that order at %i',
    async (width) => {
      widthIs(width);
      await guest('paused');
      const order = [...document.querySelectorAll('.gp-columns > *')].map(
        (one) => one.className.split(' ')[0],
      );

      expect(order).toEqual(['gp-phase', 'gp-cover', 'gp-under', 'gp-details', 'gp-foot']);
    },
  );

  it('meets the keyboard in the same order at a phone and at a desk', async () => {
    const stops = () =>
      [...document.querySelectorAll<HTMLElement>('.gp :is(a, button, textarea)')]
        .filter((one) => one.tabIndex >= 0)
        .map((one) => one.getAttribute('aria-label') ?? one.textContent);

    widthIs(402);
    await guest('coming');
    const phone = stops();
    cleanup();
    widthIs(1280);
    await guest('coming');

    expect(stops()).toEqual(phone);
    expect(phone.slice(0, 4)).toEqual([
      'Language: English',
      'Change my answer',
      'Apple / Outlook',
      'Google Calendar',
    ]);
    expect(phone.indexOf('Open in maps')).toBeLessThan(phone.indexOf(`Not ${NAME}? Tell us`));
  });

  it('places the cover and the details in the left column on two, by CSS', async () => {
    widthIs(1280);
    await guest('paused');

    expect(document.querySelector('.gp-columns > .gp-cover')?.classList.contains('gp-left')).toBe(
      true,
    );
    expect(
      document.querySelector('.gp-columns > .gp-details')?.classList.contains('gp-left-after'),
    ).toBe(true);
  });
});

describe('answering, by keyboard and pointer, on sample data', () => {
  it('Yes goes to the kitchen step (sc-3778) with its heading focused; Back returns to Yes', async () => {
    await guest();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, I’ll be there' }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Anything the kitchen must know?' }),
    );
    expect(screen.queryByText('Hosted by')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Yes, I’ll be there' }));
  });

  it('sends: the button keeps its words while busy, a second press does nothing, then the greeting has focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetching = vi.spyOn(globalThis, 'fetch');
    await guest('check');
    const send = screen.getByRole('button', { name: 'Send my answer' });

    fireEvent.click(send);
    expect(send.getAttribute('aria-busy')).toBe('true');
    expect(send.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(send);
    await wait();

    const greeting = screen.getByRole('heading', { name: `See you there, ${NAME}.` });
    expect(document.activeElement).toBe(greeting);
    expect(screen.getByText('You answered Coming on Tuesday, October 27.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Show this at the door' })).toBeDefined();
    expect(
      screen.getByRole('img', { name: 'Your code for the door. It holds no name.' }),
    ).toBeDefined();
    expect(document.querySelector('.gp-tag')?.textContent).toBe('Coming');
    expect(
      fetching.mock.calls.filter(([url]) => String(url).startsWith('http://api.test')),
    ).toEqual([]);
  });

  it('a failed send keeps everything and focuses Send my answer, which sends again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('notSent');
    const send = screen.getByRole('button', { name: 'Send my answer' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Your answer wasn’t sent. Everything you chose is still here. Try again.',
    );
    expect(document.activeElement).toBe(send);
    fireEvent.click(send);
    expect(screen.queryByRole('alert')).toBeNull();
    await wait();
    expect(screen.getByRole('heading', { name: `See you there, ${NAME}.` })).toBeDefined();
  });

  it('records Sorry, I can’t in one tap, with the turning mark on the row', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest();
    const no = screen.getByRole('button', { name: 'Sorry, I can’t' });

    no.focus();
    fireEvent.click(no);
    expect(no.getAttribute('aria-busy')).toBe('true');
    expect(no.querySelector('.gp-spin')).not.toBeNull();
    await wait();

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: `We’ll miss you, ${NAME}.` }),
    );
    expect(screen.queryByRole('heading', { name: 'Show this at the door' })).toBeNull();
  });

  it('changes the answer: Coming lit and pressed, Keep my answer returns focus to Change my answer', async () => {
    await guest('coming');

    fireEvent.click(screen.getByRole('button', { name: 'Change my answer' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your new answer' }));
    const yes = screen.getByRole('button', { name: /^Yes, I’ll be there/u });
    expect(yes.getAttribute('aria-pressed')).toBe('true');
    expect(yes.textContent).toContain('Your answer now');
    expect(
      screen.getByRole('button', { name: 'Sorry, I can’t' }).getAttribute('aria-pressed'),
    ).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Keep my answer' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change my answer' }));
  });

  it('sending the same answer again says nothing has changed and keeps its date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('changing');

    fireEvent.click(screen.getByRole('button', { name: /^Yes, I’ll be there/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Nothing to add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));
    await wait();

    expect(screen.getByText('You answered Coming on Tuesday, October 20.')).toBeDefined();
    expect(screen.getByText('You’re already down as Coming. Nothing has changed.')).toBeDefined();
  });

  it('while paused, Change my answer stays in the tab order, off, described by its reason', async () => {
    await guest('paused');
    const change = screen.getByRole('button', { name: 'Change my answer' });

    expect(change.getAttribute('aria-disabled')).toBe('true');
    expect(change.hasAttribute('disabled')).toBe(false);
    expect(
      document.getElementById(change.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Answers are closed while the event is paused. Anything you sent is kept.');
    fireEvent.click(change);
    expect(screen.queryByRole('heading', { name: 'Your new answer' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Show this at the door' })).toBeNull();
  });
});

describe('over, never answered', () => {
  it('keeps the keepsake with “You didn’t answer.” in place of the answer', async () => {
    await guest('overNever');

    expect(screen.getByRole('status').textContent).toContain('This event has taken place.');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }),
    ).toBeDefined();
    expect(screen.getByText('You didn’t answer.')).toBeDefined();
    expect(screen.queryByText(/^You answered/u)).toBeNull();
    expect(document.querySelector('.gp-tag')).toBeNull();
    expect(screen.getByText('Hosted by')).toBeDefined();
  });
});

describe('the door code’s two lines (sc-1301, pm #31418)', () => {
  it('names the companions only when one counts as coming', async () => {
    await guest('coming');
    expect(
      screen.getByText('It lets you and your companions in. A screenshot works too.'),
    ).toBeDefined();
    cleanup();

    await guest('comingAlone');
    expect(screen.getByText('A screenshot works too.')).toBeDefined();
    expect(screen.queryByText(/your companions in/u)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Show this at the door' })).toBeDefined();
    expect(
      screen.getByText('Your calendar updates by itself if the date, time or place changes.'),
    ).toBeDefined();
  });
});

describe('the hosts’ messages in an ended phase (Settled, 7 Nov (pm))', () => {
  it('called off: the messages and the box sit under the greyed cover, with no answer and no hosts row', async () => {
    await guest('calledOffMessages');
    const under = [...document.querySelectorAll('.gp-under > *')].map(
      (one) => one.className.split(' ')[0],
    );

    expect(under).toEqual(['gp-messages']);
    expect(document.querySelector('.gp-cover.is-grey')).not.toBeNull();
    expect(screen.queryByText('Hosted by')).toBeNull();
    expect(screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('This event has been called off.');
  });

  it('finished: the thank-you and the answer, then the messages and the box', async () => {
    await guest('finishedMessages');
    const under = [...document.querySelectorAll('.gp-under > *')].map(
      (one) => one.className.split(' ')[0],
    );

    expect(under).toEqual(['gp-ended', 'gp-messages']);
    expect(screen.queryByRole('heading', { name: 'Show this at the door' })).toBeNull();
  });
});

describe('announcements', () => {
  it('says the phase notice as a polite status, and keeps the thank-you outside it', async () => {
    await guest('finished');
    const notice = screen.getByRole('status');

    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(notice.getAttribute('aria-atomic')).toBe('true');
    expect(notice.textContent).toBe(
      'FinishedThis event has taken place. This page stays here as a keepsake.',
    );
    expect(notice.textContent).not.toContain(THANK_YOU);
    expect(screen.getByText(THANK_YOU).closest('blockquote')?.getAttribute('dir')).toBe('auto');
    expect(screen.getByText(THANK_YOU).closest('figure')?.textContent).toContain(
      'Adaeze Obi and Tunde Bakare',
    );
  });

  it('says a link that does not work as an alert', async () => {
    await guest('gone');

    expect(screen.getByRole('alert').textContent).toContain(
      'If you think it should work, ask whoever invited you.',
    );
    expect(document.querySelector('.gp-cover')).toBeNull();
  });

  it('holds the page while it loads, said once', async () => {
    await guest('loading');

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading…');
  });

  it('focuses Cannot reach Soirely, and Try again loads the page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('unreachable');

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Cannot reach Soirely' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDefined();
    await wait();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'You are invited' }),
    );
  });
});

describe('Not {full name}? Tell us', () => {
  it('asks in place of everything under the cover, and Go back returns focus to Tell us', async () => {
    await guest();

    fireEvent.click(screen.getByRole('button', { name: `Not ${NAME}? Tell us` }));
    const question = screen.getByRole('heading', {
      name: 'Tell Adaeze Obi and Tunde Bakare this link reached the wrong person?',
    });
    expect(document.activeElement).toBe(question);
    expect(screen.queryByText('Hosted by')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your answer' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `Not ${NAME}? Tell us` }),
    );
    expect(screen.getByRole('heading', { name: 'Your answer' })).toBeDefined();
  });

  it('Tell them thanks politely and takes focus; a 429 is an alert with no time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('tellUsLimited');

    expect(screen.getByRole('alert').textContent).toBe(
      'Too many tries from this link. Try again later.',
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tell them' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tell them' }));
    await wait();

    const thanks = screen.getByRole('status');
    expect(thanks.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(within(thanks).getByText(/^Thank you\./u));
  });
});

describe('the language menu in the header (sc-3790)', () => {
  it('opens on French with the current language checked and focused, each in its own lang', async () => {
    await guest('french');
    const items = screen.getAllByRole('menuitemradio');

    expect(items.map((one) => one.getAttribute('lang'))).toEqual(['en', 'es', 'fr', 'pt']);
    expect(items[2]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(items[2]);
    expect(page().getAttribute('lang')).toBe('fr');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vous avez une invitation' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: '[Oui, je serai là]' })).toBeDefined();
  });

  it('moves with the arrows, closes on Escape, and switches at once on a choice, focus back on the button', async () => {
    await guest('french');
    const items = screen.getAllByRole('menuitemradio');

    fireEvent.keyDown(items[2]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(items[3]!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Langue\s:\sFrançais$/u }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Langue\s:\sFrançais$/u }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Language: English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'You are invited' })).toBeDefined();
  });
});

describe('the hosts’ messages and the guest’s own (§4a)', () => {
  it('shows the hosts’ words newest last, signed as the hosts, as plain text', async () => {
    await guest('messages');
    const articles = screen.getAllByRole('article');

    expect(
      articles.map((one) => one.querySelector('.gp-meta')?.textContent?.replace(/\s/gu, ' ')),
    ).toEqual([
      'Adaeze Obi and Tunde Bakare · Sat, Oct 31 · 10:05',
      'Adaeze Obi and Tunde Bakare · Mon, Nov 2 · 21:14',
      'Adaeze Obi and Tunde Bakare · Tue, Nov 3 · 08:30',
    ]);
    expect(articles.every((one) => one.querySelector('a') == null)).toBe(true);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('writes back: Sending… said politely, then Sent, the box empty again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('messages');
    const box = screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare');
    const send = screen.getByRole('button', { name: 'Send' });

    fireEvent.change(box, { target: { value: 'See you Thursday!' } });
    expect(send.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(send);

    expect(box).toHaveProperty('value', '');
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Sending…');
    expect(screen.getByText('See you Thursday!')).toBeDefined();
    await wait();
    expect(screen.getByRole('status').textContent?.replace(/\s/gu, ' ')).toBe(
      'Sent · Tue, Nov 3 · 09:41',
    );
  });

  it('a failed send keeps the words in the box, says so as an alert and focuses Send, which sends again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('replyFailed');
    const send = screen.getByRole('button', { name: 'Send' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Your message wasn’t sent. Your words are still here. Try again.',
    );
    expect(screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare')).toHaveProperty(
      'value',
      'Thank you! Is there a cloakroom at The Landmark?',
    );
    expect(document.activeElement).toBe(send);
    fireEvent.click(send);
    expect(screen.queryByRole('alert')).toBeNull();
    await wait();
    expect(screen.getByRole('status').textContent).toMatch(/^Sent · /u);
  });

  it('counts from 900 characters, and over 1,000 sends nothing and says so on the box', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('messages');
    const box = screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare');

    fireEvent.change(box, { target: { value: 'a'.repeat(899) } });
    expect(screen.queryByText(/characters$/u)).toBeNull();
    fireEvent.change(box, { target: { value: 'a'.repeat(950) } });
    expect(screen.getByText('950 of 1,000 characters').id).toBe(
      box.getAttribute('aria-describedby'),
    );

    fireEvent.change(box, { target: { value: 'a'.repeat(1001) } });
    expect(box.getAttribute('aria-invalid')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.queryByText('Sending…')).toBeNull();
    expect(box).toHaveProperty('value', 'a'.repeat(1001));
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(
      (box.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent),
    ).toEqual(['Shorten your message to 1,000 characters or fewer.', '1,001 of 1,000 characters']);
    expect(document.activeElement).toBe(box);

    fireEvent.change(box, { target: { value: 'a'.repeat(1000) } });
    expect(box.getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByText('1,000 of 1,000 characters')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Sending…')).toBeDefined();
  });

  it('messageLong: the count is the box’s description, never live, focus in the box', async () => {
    await guest('messageLong');
    const box = screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare');
    const count = screen.getByText('950 of 1,000 characters');

    expect(document.activeElement).toBe(box);
    expect(box.getAttribute('aria-describedby')).toBe(count.id);
    expect(count.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    expect(box.getAttribute('aria-invalid')).toBe('false');
  });

  it('messageTooLong: nothing sent, the words kept, the refused field, the count red with its mark', async () => {
    await guest('messageTooLong');
    const box = screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare');
    const count = screen.getByText('1,042 of 1,000 characters');

    expect(document.activeElement).toBe(box);
    expect((box as HTMLTextAreaElement).value).toHaveLength(1042);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.closest('.gp-compose-row')?.classList.contains('is-wrong')).toBe(true);
    expect(count.classList.contains('is-over')).toBe(true);
    expect(count.querySelector('svg')).not.toBeNull();
    expect(box.getAttribute('aria-describedby')).toBe('gp-box-error gp-box-count');
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('sits under the answer and above the door code', async () => {
    await guest('message');
    const order = [...document.querySelectorAll('.gp-under > *')].map(
      (one) => one.className.split(' ')[0],
    );

    expect(order).toEqual(['gp-recorded', 'gp-messages', 'gp-block', 'gp-block']);
  });
});
