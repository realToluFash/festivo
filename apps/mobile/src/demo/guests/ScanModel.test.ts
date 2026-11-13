import { describe, expect, it } from 'vitest';

import { howToReadOut, shownBeforeAnswer } from '../../kit/readOut.ts';
import { W, say } from './GuestsWords.ts';
import {
  SCAN_STATES,
  isOffline,
  nextRead,
  readOf,
  resultOf,
  scanStateOf,
  scannedOf,
  searchAskOf,
  searchHref,
  tell,
  waitingOf,
} from './ScanModel.ts';

describe('the scanner’s states, as guests-a-spec §19 names them', () => {
  it('names each once and opens an unknown one as scanning', () => {
    expect(new Set(SCAN_STATES).size).toBe(SCAN_STATES.length);
    expect(scanStateOf('validHeld')).toBe('validHeld');
    expect(scanStateOf('nope')).toBeNull();
    expect(resultOf(null)).toBeNull();
    expect(resultOf('scanning')).toBeNull();
  });

  it('brings up the guest and their companions together, and nothing else', () => {
    const read = readOf('ines');
    expect(read.kind).toBe('guest');
    if (read.kind !== 'guest') return;
    expect(read.people.map((p) => p.name)).toEqual(['Inês Duarte', 'Rui Duarte']);
    expect(read.people.map((p) => p.companion)).toEqual([false, true]);
    expect(read.twice).toBe(false);
    expect(Object.keys(read.people[0] ?? {}).sort()).toEqual(
      ['arrivedAt', 'by', 'companion', 'key', 'kind', 'name', 'when'].sort(),
    );
  });

  it('shows a held companion as held, and a second scan as already arrived', () => {
    const held = resultOf('validHeld');
    expect(held?.kind === 'guest' && held.people[1]?.kind).toBe('held');
    const twice = resultOf('alreadyArrived');
    expect(twice?.kind === 'guest' && twice.twice).toBe(true);
    expect(twice?.kind === 'guest' && twice.people[0]?.arrivedAt).toBe('18:12');
  });

  it('gives one answer for any code not on the list, online or offline', () => {
    expect(resultOf('notOnList')).toEqual({ kind: 'notOnList' });
    expect(resultOf('offlineNotOnList')).toEqual({ kind: 'notOnList' });
    expect(readOf(null)).toEqual({ kind: 'notOnList' });
    expect(isOffline('offlineNoList')).toBe(true);
    expect(isOffline('notOnList')).toBe(false);
  });

  it('reads every result in turn, from the first code', () => {
    const seen: (string | null)[] = [];
    let last: string | null | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = nextRead(last);
      seen.push(last);
    }
    expect(seen).toEqual(['ines', 'folasade', 'musa', 'camille', null, 'ines']);
  });

  it('moves on from the code each state shows, from the one table resultOf reads', () => {
    for (const state of SCAN_STATES) {
      const shown = resultOf(state);
      const key = scannedOf(state);
      if (shown?.kind === 'guest') expect(shown.people[0]?.key).toBe(key);
      if (shown?.kind === 'notOnList') expect(key).toBeNull();
      if (shown == null || shown.kind === 'noList' || shown.kind === 'cameraOff')
        expect(key).toBeUndefined();
    }
    expect(nextRead(scannedOf('validHeld'))).toBe('musa');
    expect(nextRead(scannedOf('scanning'))).toBe('ines');
  });

  it('says how many arrivals wait on the device, each count its own words', () => {
    expect(waitingOf(undefined)).toBe(12);
    expect(waitingOf('1')).toBe(1);
    expect(waitingOf('0')).toBe(0);
    expect(waitingOf('7')).toBe(12);
    expect(say.offlineSince('18:31', 12)).toBe('Offline since 18:31 · 12 arrivals waiting to sync');
    expect(say.offlineSince('18:31', 1)).toBe('Offline since 18:31 · 1 arrival waiting to sync');
    expect(say.offlineSince('18:31', 0)).toBe('Offline since 18:31');
  });

  it('says a second “Arrival undone” again, as a new tap’s answer', () => {
    const reading = { os: 'ios', interrupts: false, afterTyping: false };
    const first = tell(null, W.arrivalUndone);
    const second = tell(tell(first, say.arrivedName('Inês Duarte')), W.arrivalUndone);
    const twice = tell(first, W.arrivalUndone);
    expect(second.words).toBe(first.words);
    expect(twice.tap).not.toBe(first.tap);
    const before = shownBeforeAnswer(first.words, first.tap, twice.tap);
    expect(howToReadOut(before, twice.words, reading).handOver?.words).toBe(W.arrivalUndone);
    expect(tell(tell(null, W.notOnList), W.notOnList).tap).toBe(2);
  });

  it('asks Check-in to focus its search on every Search by name tap', () => {
    const askOf = (href: string) =>
      searchAskOf(Object.fromEntries(new URL(href, 'https://demo.soirely').searchParams));
    const one = askOf(searchHref(1));
    const two = askOf(searchHref(2));
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    expect(two).not.toBe(one);
    expect(searchAskOf({})).toBeNull();
    expect(searchAskOf({ focus: 'other', tap: '3' })).toBeNull();
  });
});
