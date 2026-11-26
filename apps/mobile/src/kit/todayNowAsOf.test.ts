import { ApiError, ApiUnreachableError } from '@soirely/api-client';
import { type NowShown, watchNowReads } from '@soirely/domain';
import { changeLanguage, init, t } from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import { RUN_AGAIN_MS } from '../components/todayRunSchedule.ts';

import { asOfWords } from './todayRun.ts';

vi.mock('../api.ts', () => ({ api: {} }));

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en }, fr: { translation: fr } },
    interpolation: { escapeValue: false },
  }),
);

const ZONE = 'Europe/London';
const OPENED = new Date('2030-11-15T20:02:00Z');

const lands = (order: string) => () => Promise.resolve(order);
const down = () => Promise.reject(new ApiUnreachableError(new Error('down')));
const hangs = () => new Promise<string>(() => {});
const answers = (status: number) => () =>
  Promise.reject(new ApiError({ type: 'https://soirely.app/errors/x', title: 'No', status }));

/** Today's reads of the running order, answered in turn, and Now's line as the app words it. */
function today(reads: (() => Promise<string>)[]) {
  let shown: NowShown<string> = { schedule: null, asOf: null };
  const watch = watchNowReads({
    read: () => (reads.shift() ?? hangs)(),
    every: RUN_AGAIN_MS,
    clock: () => new Date(),
    show: (next) => {
      shown = next;
    },
  });

  return {
    watch,
    order: () => shown.schedule,
    line: () => asOfWords(shown.asOf, new Date(), ZONE, 'en-GB', t),
  };
}

describe("Now's line in the app once its reads stop landing (sc-62416)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(OPENED);
  });
  afterEach(() => vi.useRealTimers());

  it('counts a read with no answer after 10 seconds as failed', async () => {
    const { line, watch } = today([lands('one'), hangs]);
    await vi.advanceTimersByTimeAsync(RUN_AGAIN_MS + 10_000);
    expect(line()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(line()).toBe('Offline · as of 20:02');
    watch.stop();
  });

  it('shows no line on a failed read while the last landed read is 60 seconds old or less', async () => {
    const { line, order, watch } = today([lands('one'), answers(500)]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(line()).toBeNull();
    expect(order()).toBe('one');
    watch.stop();
  });

  it("shows the line with that read's time once it is more than 60 seconds old", async () => {
    const { line, order, watch } = today([lands('one'), down]);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(line()).toBe('Offline · as of 20:02');
    expect(order()).toBe('one');
    watch.stop();
  });

  it('drops the line and shows what a read says once one lands', async () => {
    const { line, order, watch } = today([lands('one'), down, lands('two')]);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(line()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(RUN_AGAIN_MS);
    expect(line()).toBeNull();
    expect(order()).toBe('two');
    watch.stop();
  });

  it.each([403, 404])('goes back to the built Now with no line after a %i', async (status) => {
    const { line, order, watch } = today([lands('one'), down, answers(status)]);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(line()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(RUN_AGAIN_MS);
    expect(line()).toBeNull();
    expect(order()).toBeNull();
    watch.stop();
  });

  it('keeps the built Now with no line when the first read fails', async () => {
    const { line, order, watch } = today([down, down, down]);
    await vi.advanceTimersByTimeAsync(2 * RUN_AGAIN_MS + 20_000);
    expect(line()).toBeNull();
    expect(order()).toBeNull();
    watch.stop();
  });

  it("names the day once the last landed read was on an earlier day in the event's zone", async () => {
    vi.setSystemTime(new Date('2030-11-15T23:59:30Z'));
    const { line, watch } = today([lands('one'), down]);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(line()).toBe('Offline · as of Friday 15 Nov at 23:59');
    await i18nIn('fr', () =>
      expect(asOfWords(new Date('2030-11-15T23:59:30Z'), new Date(), ZONE, 'fr-FR', t)).toMatch(
        /^Hors ligne · mis à jour le .+ à 23:59$/,
      ),
    );
    watch.stop();
  });
});

async function i18nIn(lng: string, then: () => void) {
  await changeLanguage(lng);
  try {
    then();
  } finally {
    await changeLanguage('en');
  }
}
