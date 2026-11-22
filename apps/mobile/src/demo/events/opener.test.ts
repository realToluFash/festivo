import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import fr from '../../i18n/locales/fr.json';
import pt from '../../i18n/locales/pt.json';
import {
  BACK_KEY,
  BEHIND_BOARDS,
  type BackScreen,
  OPENERS,
  backScreenOf,
  openerOf,
  type Opened,
  opensOver,
  wayBack,
  withFrom,
} from './opener.ts';

const wordAt = (catalogue: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (at, part) =>
        at != null && typeof at === 'object' ? (at as Record<string, unknown>)[part] : undefined,
      catalogue,
    );

describe('‹ names the screen behind the event (sc-83008)', () => {
  it('reads Events for its list, Happening now and anything with nothing in the app behind it', () => {
    for (const opener of [
      'events',
      'happeningNow',
      'outside',
      'notificationStart',
      'signIn',
    ] as const)
      for (const layout of ['phone', 'portrait'] as const)
        expect(backScreenOf(opener, layout)).toBe('events');
    expect(backScreenOf(null, 'phone')).toBe('events');
    expect(backScreenOf(openerOf('nowhere'), 'portrait')).toBe('events');
  });

  it('names Today and the Calendar for an event New event made from them', () => {
    expect(backScreenOf('todayNew', 'phone')).toBe('today');
    expect(backScreenOf('calendarNew', 'portrait')).toBe('calendar');
  });

  it('reads Audit log on an iPad, where the entry sits beside the log, and Entry on a phone', () => {
    expect(backScreenOf('audit', 'portrait')).toBe('auditLog');
    expect(backScreenOf('audit', 'phone')).toBe('entry');
  });

  it('says only the unmatched openers have nothing in the app behind them', () => {
    expect(OPENERS.filter((opener) => !opensOver(opener))).toEqual([
      'outside',
      'notificationStart',
      'signIn',
    ]);
    expect(opensOver(null)).toBe(false);
  });

  it('takes every word from a key all four locales already have', () => {
    for (const catalogue of [en, es, fr, pt])
      for (const key of Object.values(BACK_KEY))
        expect(typeof wordAt(catalogue, key), key).toBe('string');
  });

  it('reads the Spanish the board draws', () => {
    const spanish: Record<BackScreen, string> = {
      today: 'Hoy',
      events: 'Eventos',
      calendar: 'Calendario',
      search: 'Buscar',
      notifications: 'Notificaciones',
      auditLog: 'Registro de auditoría',
      entry: 'Entrada',
    };
    for (const [screen, words] of Object.entries(spanish))
      expect(wordAt(es, BACK_KEY[screen as BackScreen])).toBe(words);
    expect(wordAt(es, 'eventsScreen.refreshing')).toBe('Actualizando…');
  });

  it('adds what the event was opened over to its link, and that it is under the event', () => {
    expect(withFrom('/demo/events/evt-1', 'today')).toBe('/demo/events/evt-1?from=today&pushed=1');
    expect(withFrom('/demo/events/evt-1?area=schedule', 'calendar')).toBe(
      '/demo/events/evt-1?area=schedule&from=calendar&pushed=1',
    );
    expect(openerOf('search')).toBe('search');
  });

  it('lists every opener, the iPhone SE in Spanish and the move over Today', () => {
    for (const opener of OPENERS)
      expect(BEHIND_BOARDS.some(({ href }) => href.endsWith(`from=${opener}`))).toBe(true);
    expect(BEHIND_BOARDS.map(({ href }) => href)).toContain(
      '/demo/events/evt-wed-4?from=notifications&lang=es&refreshing=1',
    );
    expect(BEHIND_BOARDS.map(({ href }) => href)).toContain(
      '/demo/events/evt-wed-4?link=moved&from=today',
    );
  });

  const opened = (opener: Opened['opener'], more: Partial<Opened> = {}): Opened => ({
    opener,
    pushed: false,
    term: null,
    spanish: false,
    refreshing: false,
    ...more,
  });

  it('goes back only when the screen it names was pushed under the event', () => {
    expect(wayBack('today', 'today', opened('today', { pushed: true }))).toBe('back');
    expect(
      wayBack('notifications', 'notifications', opened('notifications', { pushed: true })),
    ).toBe('back');
  });

  it('goes straight to the screen from the page list, where nothing of it is under the event', () => {
    expect(wayBack('today', 'today', opened('today'))).toBe('/demo/today');
    expect(wayBack('calendar', 'calendar', opened('calendar'))).toBe('/demo/calendar');
    expect(wayBack('auditLog', 'audit', opened('audit'))).toBe(
      '/demo/settings/data-and-control/audit-log',
    );
  });

  it('goes straight to the screen the picker chose, whatever pushed the event', () => {
    expect(wayBack('calendar', 'calendar', opened('today', { pushed: true }))).toBe(
      '/demo/calendar',
    );
  });

  it('reopens Search with what was typed when an iPad closed its palette', () => {
    expect(wayBack('search', 'search', opened('search', { term: 'ada obi' }))).toBe(
      '/demo/search?q=ada%20obi',
    );
    expect(wayBack('search', 'search', opened('search'))).toBe('/demo/search');
  });

  it('reads Events, as today, with nothing in the app behind it', () => {
    expect(wayBack('events', 'outside', opened('outside', { pushed: true }))).toBe('events');
  });

  it('never marks the page list’s rows as pushed', () => {
    for (const { href } of BEHIND_BOARDS) expect(href).not.toContain('pushed=');
  });
});
