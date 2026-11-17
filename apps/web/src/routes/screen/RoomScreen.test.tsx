import { type RoomScreen, realtimeTopic } from '@soirely/api-client';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../../config.ts';
import { cssRule, stylesheet } from '../../test-styles.ts';
import { routes } from '../index.tsx';
import { ASK_EVERY_MS, screenLanguage } from './roomScreen.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const NAMED = { eventId: 'ev_1', event: 'Owambe', locale: 'en' };

function live(at: string, now: string | null, coming: [string, string][]) {
  return {
    kind: 'live',
    ...NAMED,
    at: `2027-03-06T${at}:00+01:00`,
    now: now == null ? null : { id: `it_${now}`, title: now },
    coming: coming.map(([time, title]) => ({
      id: `it_${title}`,
      title,
      startsAt: `2027-03-06T${time}:00+01:00`,
    })),
  };
}

const ON = live('19:40', 'Ceremony', [
  ['17:20', 'Dinner'],
  ['18:00', 'Cake'],
  ['18:30', 'First dance'],
]);

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }
}

/** Each ask of the screen takes the next answer, the last one again once they run out. */
async function open(answers: (() => Response)[], path = '/s/tok_garden'): Promise<string[]> {
  const asked: string[] = [];
  let next = 0;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    asked.push(`${line} ${String(init?.body ?? '')}`);
    if (line === 'POST /api/screen-links/subscriptions') {
      return json({ token: 'hub', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    }
    if (line !== 'POST /api/screen-links/screen') return json({});
    const answer = answers[Math.min(next, answers.length - 1)]!;
    next += 1;

    return answer();
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

  return asked;
}

const screenAsks = (asked: string[]) => asked.filter((one) => one.includes('/screen '));

describe('A screen in the room (sc-3897)', () => {
  const before = config();

  beforeEach(() => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
  });

  afterEach(() => {
    __setConfig(before);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows the event, Now, and Coming up with each time on the 24-hour clock, asking with the token in the body', async () => {
    const asked = await open([() => json(ON)]);

    expect(await screen.findByRole('heading', { name: 'Owambe' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Now' })).toBeDefined();
    expect(screen.getByText('Ceremony')).toBeDefined();
    const rows = screen.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows).toEqual(['17:20Dinner', '18:00Cake', '18:30First dance']);
    expect(screenAsks(asked)[0]).toBe('POST /api/screen-links/screen {"token":"tok_garden"}');
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is blank but for Full screen before its first answer', async () => {
    await open([() => new Promise<Response>(() => {}) as never]);

    expect(screen.getByRole('button', { name: 'Full screen' })).toBeDefined();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has no Now between items, and the event’s name alone with nothing left', async () => {
    await open([() => json(live('19:40', null, [['20:00', 'Dinner']]))]);
    await screen.findByText('Dinner');
    expect(screen.queryByRole('heading', { name: 'Now' })).toBeNull();
    expect(document.querySelector('.rs-body.is-between')).not.toBeNull();
  });

  it('shows the event’s name alone with nothing left to show', async () => {
    await open([() => json({ kind: 'nothingLeft', ...NAMED, at: '2027-03-06T19:40:00+01:00' })]);

    expect(await screen.findByRole('heading', { name: 'Owambe' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Coming up' })).toBeNull();
  });

  it('keeps the last state offline with the time it last heard, and catches up at once on reconnecting', async () => {
    const asked = await open([
      () => json(ON),
      () => json(live('19:46', 'Dinner', [['20:30', 'Cake']])),
    ]);
    await screen.findByText('Ceremony');

    act(() => void window.dispatchEvent(new Event('offline')));

    expect(screen.getByRole('status').textContent).toBe('Times as of 19:40');
    expect(screen.getByText('Ceremony')).toBeDefined();

    act(() => void window.dispatchEvent(new Event('online')));

    await screen.findByText('Dinner');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screenAsks(asked)).toHaveLength(2);
  });

  describe('out of reach while the browser reports being online (sc-62588)', () => {
    let down: 'up' | 'refused' | 'silent' = 'up';
    const reachable = (body: unknown) => () =>
      down === 'up'
        ? json(body)
        : down === 'refused'
          ? (Promise.reject(new TypeError('Failed to fetch')) as never)
          : (new Promise<Response>(() => {}) as never);
    const after = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    const asOf = () => screen.queryByRole('status')?.textContent ?? null;

    beforeEach(() => {
      down = 'up';
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
      });
    });

    it('says Times as of within 10 seconds of the API stopping, keeping the last state', async () => {
      await open([reachable(ON)]);
      await after(0);
      expect(screen.getByText('Ceremony')).toBeDefined();

      down = 'refused';
      await after(9_900);

      expect(asOf()).toBe('Times as of 19:40');
      expect(screen.getByText('Ceremony')).toBeDefined();
    });

    it('says it within 10 seconds when the network is cut and asks go unanswered', async () => {
      await open([reachable(ON)]);
      await after(0);

      down = 'silent';
      await after(9_900);

      expect(asOf()).toBe('Times as of 19:40');
    });

    it.each(
      (['refused', 'silent'] as const).flatMap((how) =>
        [0, 500, 1_000, 1_750].map((offset) => [how, offset] as const),
      ),
    )('shows nothing for a %s drop of 5 seconds, %i ms after an answer', async (how, offset) => {
      await open([reachable(ON)]);
      await after(offset);

      down = how;
      for (let waited = 0; waited < 5_000; waited += 250) {
        await after(250);
        expect(asOf()).toBeNull();
      }
      down = 'up';
      for (let waited = 0; waited < 10_000; waited += 250) {
        await after(250);
        expect(asOf()).toBeNull();
      }
    });

    it('catches up on what changed once reachable, with no press', async () => {
      let state: unknown = ON;
      await open([() => reachable(state)()]);
      await after(0);

      down = 'refused';
      await after(12_000);
      expect(asOf()).toBe('Times as of 19:40');

      state = live('19:52', 'Dinner', [['20:30', 'Cake']]);
      down = 'up';
      await after(2_000);

      expect(asOf()).toBeNull();
      expect(screen.getByText('Dinner')).toBeDefined();
      expect(screen.queryByText('Ceremony')).toBeNull();
    });

    it('asks again on its own, so an overrun with no press moves the times on', async () => {
      let state: unknown = ON;
      await open([() => reachable(state)()]);
      await after(0);
      expect(screen.getByText('17:20')).toBeDefined();

      state = live('19:41', 'Ceremony', [['17:30', 'Dinner']]);
      await after(ASK_EVERY_MS + 500);

      expect(screen.getByText('17:30')).toBeDefined();
    });
  });

  it('asks again when the event signals, reading nothing from the signal itself', async () => {
    const asked = await open([
      () => json(ON),
      () => json(live('19:41', 'Dinner', [['20:30', 'Cake']])),
    ]);
    await screen.findByText('Ceremony');
    await waitFor(() => expect(StubSource.made).toHaveLength(1));
    const source = StubSource.made[0]!;

    expect(new URL(source.url).searchParams.getAll('topic')).toEqual([
      realtimeTopic('EventScreens', 'ev_1'),
    ]);
    act(() => source.onmessage?.({ data: '[]' }));

    await screen.findByText('Dinner');
    expect(screenAsks(asked)).toHaveLength(2);
  });

  it('shows only that the link was replaced, with no event details and no full screen', async () => {
    await open([() => json({ kind: 'replaced', at: '2027-03-06T19:40:00+01:00' })]);

    expect(await screen.findByText('This screen link has been replaced')).toBeDefined();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
  });

  it('stops showing the event as soon as the link is replaced', async () => {
    await open([() => json(ON), () => json({ kind: 'replaced', at: '2027-03-06T19:41:00+01:00' })]);
    await screen.findByText('Ceremony');
    await waitFor(() => expect(StubSource.made).toHaveLength(1));

    act(() => StubSource.made[0]!.onmessage?.({ data: '[]' }));

    await screen.findByText('This screen link has been replaced');
    expect(screen.queryByText('Owambe')).toBeNull();
    expect(StubSource.made[0]!.readyState).toBe(StubSource.CLOSED);
  });

  it('thanks the room as soon as End now signals, without waiting to ask again', async () => {
    const asked = await open([
      () => json(ON),
      () => json({ kind: 'finished', ...NAMED, at: '2027-03-06T19:41:00+01:00' }),
    ]);
    await screen.findByText('Ceremony');
    await waitFor(() => expect(StubSource.made).toHaveLength(1));

    act(() => StubSource.made[0]!.onmessage?.({ data: '[]' }));

    expect(await screen.findByRole('heading', { name: 'Thank you for coming' })).toBeDefined();
    expect(screenAsks(asked)).toHaveLength(2);
  });

  it('thanks the room once the event is Finished', async () => {
    await open([() => json({ kind: 'finished', ...NAMED, at: '2027-03-07T04:00:00+01:00' })]);

    expect(await screen.findByRole('heading', { name: 'Thank you for coming' })).toBeDefined();
    expect(screen.getByText('Owambe')).toBeDefined();
  });

  it('says the page is not found for a link never issued', async () => {
    await open([() => problem('not_found', 404)], '/s/nothing');

    expect(await screen.findByRole('heading', { name: 'This page does not exist' })).toBeDefined();
  });
});

describe('The room screen’s language', () => {
  const answer: RoomScreen = {
    kind: 'live',
    ...NAMED,
    locale: 'fr',
    at: '',
    now: null,
    coming: [],
  };

  it('is the organisation’s unless the link sets another', () => {
    expect(screenLanguage(null, answer)).toBe('fr');
    expect(screenLanguage('pt', answer)).toBe('pt');
    expect(screenLanguage('xx', answer)).toBe('fr');
  });
});

describe('The room screen’s look', () => {
  const sheet = stylesheet(import.meta.dirname, 'roomScreen.css');
  const tokens = stylesheet(import.meta.dirname, '../../tokens.css');
  const token = (name: string) =>
    new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`, 'u').exec(tokens)?.[1] ?? '';
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => {
      const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high! + 0.05) / (low! + 0.05);
  };

  it('holds every word at 7:1 or more on its dark field (WCAG 2.2 §1.4.6)', () => {
    expect(cssRule('.rs-room', sheet)).toContain('background: var(--colorDark)');
    for (const ink of ['colorInkOnDark', 'colorInkOnDarkSecondary']) {
      expect(contrast(token(ink), token('colorDark'))).toBeGreaterThanOrEqual(7);
    }
  });

  it('moves only the item that changes, and nothing with reduced motion', () => {
    const animated = [...sheet.matchAll(/^\.([\w-]+)[^{]*\{[^}]*animation:/gmu)].map(
      (rule) => rule[1],
    );
    expect(animated).toEqual(['rs-change']);
    expect(sheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.rs-change \{\s*animation: none;/u,
    );
  });
});
