import { act, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { GUEST_DAY_PAGES } from './guestDay.ts';

const SLOW = { timeout: 15000 };

const tested = config();
const plain = window.matchMedia;

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

async function guest(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] })}
    />,
  );
  await screen.findByRole('banner');
}

const CALENDAR = new Set(['Add to calendar', '[Ajouter au calendrier]']);
const allHeadings = () =>
  within(document.querySelector('main') as HTMLElement)
    .getAllByRole('heading', { level: 2 })
    .map((one) => one.textContent);
const headings = () => allHeadings().filter((one) => !CALENDAR.has(one ?? ''));

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
  window.matchMedia = plain;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the guest’s page on the event’s day (sc-24381)', () => {
  it('is linked from the demo home under its own heading', SLOW, async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/demo'] })} />);
    const head = await screen.findByRole(
      'heading',
      { level: 3, name: /on the event’s day/u },
      SLOW,
    );
    const links = within(head.nextElementSibling as HTMLElement)
      .getAllByRole('link')
      .map((one) => one.getAttribute('href'));

    expect(links).toEqual(GUEST_DAY_PAGES.flatMap((one) => one.states).map((one) => one.to));
  });

  it('leads a Coming guest with Your code, then Where, then Your answer', async () => {
    await guest('onTheDay');

    expect(allHeadings()).toEqual(['Your code', 'Where', 'Your answer', 'Add to calendar']);
    expect(screen.getByText('Show this at the door').tagName).toBe('P');
    expect(screen.getByText('You answered Coming on Tuesday, October 27.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Change my answer' })).toBeDefined();
  });

  it('shows the place once, in Where, opened by the start time, and the head’s date alone', async () => {
    await guest('onTheDay');
    const where = screen.getByRole('heading', { name: 'Where' }).closest('section')!;

    expect(screen.getByText(/^Thu, Nov 5$/u)).toBeDefined();
    expect(screen.getAllByText('The Landmark')).toHaveLength(1);
    expect(screen.getAllByText('222 Marylebone Road, London NW1 6JQ')).toHaveLength(1);
    expect(screen.getAllByText('18:00')).toHaveLength(1);
    expect(within(where).getByText('18:00').closest('time')?.getAttribute('datetime')).toBe(
      '2026-11-05T18:00:00Z',
    );
    const maps = within(where).getByRole('link', { name: 'Open in maps' });
    expect(maps.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=222%20Marylebone%20Road%2C%20London%20NW1%206JQ',
    );
    expect(maps.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getAllByRole('link', { name: 'Open in maps' })).toHaveLength(1);
  });

  it('shows the closed view under Your answer from the start', async () => {
    await guest('onTheDayStarted');

    expect(headings()).toEqual(['Your code', 'Where', 'Your answer']);
    expect(
      screen.getByText('Answers have closed. Contact your host if something has changed.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change my answer' })).toBeNull();
  });

  it.each([
    ['onTheDayNameOnly', ['The Landmark'], false],
    ['onTheDayAddressOnly', ['222 Marylebone Road, London NW1 6JQ'], true],
    ['onTheDayNoteOnly', [/^Use the side entrance/u], false],
  ] as const)(
    '%s keeps what the host gave, and the link only with an address',
    async (state, shown, link) => {
      await guest(state);
      const where = within(screen.getByRole('heading', { name: 'Where' }).closest('section')!);

      expect(where.getByText('18:00')).toBeDefined();
      for (const text of shown) expect(where.getByText(text)).toBeDefined();
      expect(where.queryByRole('link', { name: 'Open in maps' }) != null).toBe(link);
    },
  );

  it('has no Where block with nothing to put in it, and keeps the time at the head', async () => {
    await guest('onTheDayNoWhere');

    expect(headings()).toEqual(['Your code', 'Your answer']);
    expect(screen.getByText(/^Thu, Nov 5 · 18:00$/u)).toBeDefined();
  });

  it.each(['onTheDayNotComing', 'onTheDayNotSure', 'onTheDayNoAnswer', 'theDayBefore'])(
    '%s keeps the usual order',
    async (state) => {
      await guest(state);

      expect(headings()).not.toContain('Your code');
      expect(headings()).not.toContain('Where');
    },
  );

  it('shrinks the cover to a band on the phone only, with the head under it', async () => {
    widthIs(402);
    await guest('onTheDay');

    expect(document.querySelector('.gp-band')).not.toBeNull();
    expect(document.querySelector('.gp-cover')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'You are invited' })).toBeDefined();
  });

  it('keeps the cover at a desk', async () => {
    widthIs(1280);
    await guest('onTheDay');

    expect(document.querySelector('.gp-band')).toBeNull();
    expect(document.querySelector('.gp-cover')).not.toBeNull();
  });

  it('holds the code card’s box while it loads, then lands on the day', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await guest('onTheDayLoading');

    expect(document.querySelector('[aria-busy="true"] .gp-day-skel-qr')).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(headings()).toEqual(['Your code', 'Where', 'Your answer']);
  });

  it('reads in French, the host’s words untranslated', async () => {
    await guest('onTheDayFrench');

    expect(headings()).toEqual(['[Votre code]', '[Où]', '[Votre réponse]']);
  });
});

describe('the screen kept on while the code shows', () => {
  function stubs() {
    const watched: { callback: IntersectionObserverCallback }[] = [];
    const sentinel = Object.assign(new EventTarget(), { release: vi.fn(() => Promise.resolve()) });
    const request = vi.fn(() => Promise.resolve(sentinel));

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          watched.push({ callback });
        }
        observe() {}
        disconnect() {}
      },
    );
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    const seen = async (isIntersecting: boolean) => {
      await act(async () => {
        watched.at(-1)?.callback([{ isIntersecting } as IntersectionObserverEntry], {} as never);
        await Promise.resolve();
      });
    };

    return { request, sentinel, seen };
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('asks for the lock with the card in view and lets it go once it scrolls away', async () => {
    const { request, sentinel, seen } = stubs();
    await guest('onTheDay');

    await seen(true);
    expect(request).toHaveBeenCalledWith('screen');
    await seen(false);
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('asks again when the page comes back with the card in view', async () => {
    const { request, sentinel, seen } = stubs();
    await guest('onTheDay');
    await seen(true);

    sentinel.dispatchEvent(new Event('release'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never asks on another day or for a guest who is not Coming', async () => {
    const { request, seen } = stubs();
    await guest('onTheDayNotComing');
    await seen(true);

    expect(request).not.toHaveBeenCalled();
  });
});
