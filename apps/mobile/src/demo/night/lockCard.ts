import { hourContext } from '@soirely/domain';

import {
  DANCED,
  DINED,
  GAP,
  NIGHT_EVENT_NAME,
  type Night,
  type NightTrack,
  type Scene,
  at,
  expectedStarts,
  inOrder,
  labelOf,
  nightAt,
  pressSkip,
  sceneNight,
  timeIn,
} from './nightModel.ts';

export type CardLanguage = 'en' | 'es' | 'fr' | 'pt';

type Words = {
  nothingOn: string;
  everything: string;
  nothingElse: (place: string) => string;
  since: (title: string, time: string, hour1: boolean) => string;
  next: (title: string, time: string, hour1: boolean) => string;
  asOf: (time: string, hour1: boolean) => string;
  waiting: (time: string, count: number, hour1: boolean, number: string) => string;
  channel: string;
  eventDayNote: string;
};

/** The card's words as [l10n] settled them on 18 Nov 2026 ("Words, 18 Nov 2026 (l10n)" on sc-66580), each line one key: never stitched. */
export const CARD_WORDS: Record<CardLanguage, Words> = {
  en: {
    nothingOn: 'Nothing is on',
    everything: 'That’s everything.',
    nothingElse: (place) => `Nothing else is planned for ${place}.`,
    since: (title, time) => `${title} · since ${time}`,
    next: (title, time) => `Next: ${title} · about ${time}`,
    asOf: (time) => `As of ${time}`,
    waiting: (time, count, _, number) =>
      `As of ${time} · ${number} ${count === 1 ? 'press' : 'presses'} waiting to send`,
    channel: 'Run of show',
    eventDayNote:
      'Your shift or call time changed, or the event changed in its last 24 hours. Also a silent notification with Now and Next for each place you run on the run of show.',
  },
  es: {
    nothingOn: 'No hay nada en curso',
    everything: 'Eso es todo.',
    nothingElse: (place) => `No hay nada más previsto en ${place}.`,
    since: (title, time, one) => `${title} · desde ${one ? 'la' : 'las'} ${time}`,
    next: (title, time, one) => `A continuación: ${title} · hacia ${one ? 'la' : 'las'} ${time}`,
    asOf: (time, one) => `Actualizado a ${one ? 'la' : 'las'} ${time}`,
    waiting: (time, count, one, number) =>
      `Actualizado a ${one ? 'la' : 'las'} ${time} · ${number} ${count === 1 ? 'acción pendiente' : 'acciones pendientes'} de enviar`,
    channel: 'Escaleta',
    eventDayNote:
      'Cambios en su turno o en su hora de convocatoria, o en el evento durante las 24 horas previas, y una notificación silenciosa con Ahora y A continuación para cada espacio que lleve en la escaleta.',
  },
  fr: {
    nothingOn: 'Rien en cours',
    everything: 'C’est tout.',
    nothingElse: (place) => `Plus rien n’est prévu dans l’espace ${place}.`,
    since: (title, time) => `${title} · depuis ${time}`,
    next: (title, time) => `Ensuite\u00a0: ${title} · vers ${time}`,
    asOf: (time) => `Mise à jour\u00a0: ${time}`,
    waiting: (time, count, _, number) =>
      `Mise à jour\u00a0: ${time} · ${number} ${count === 1 ? 'action' : 'actions'} en attente d’envoi`,
    channel: 'Déroulé',
    eventDayNote:
      'Un changement de votre service ou de votre heure de convocation, ou de l’événement dans les 24 heures qui le précèdent, ainsi qu’une notification silencieuse «\u00a0Maintenant\u00a0» et «\u00a0Ensuite\u00a0» pour chaque espace dont vous menez le déroulé.',
  },
  pt: {
    nothingOn: 'Nada a decorrer',
    everything: 'É tudo.',
    nothingElse: (place) => `Não há mais nada previsto em ${place}.`,
    since: (title, time, one) => `${title} · desde ${one ? 'a' : 'as'} ${time}`,
    next: (title, time, one) => `A seguir: ${title} · por volta ${one ? 'da' : 'das'} ${time}`,
    asOf: (time, one) => `Atualizado ${one ? 'à' : 'às'} ${time}`,
    waiting: (time, count, one, number) =>
      `Atualizado ${one ? 'à' : 'às'} ${time} · ${number} ${count === 1 ? 'ação' : 'ações'} por enviar`,
    channel: 'Alinhamento',
    eventDayNote:
      'Alterações ao seu turno ou à sua hora de convocatória, ou ao evento nas 24 horas que o antecedem, e uma notificação silenciosa com Agora e A seguir para cada espaço que conduz no alinhamento.',
  },
};

export function cardLanguage(locale: string): CardLanguage {
  const lang = locale.slice(0, 2);

  return lang === 'es' || lang === 'fr' || lang === 'pt' ? lang : 'en';
}

export const CW = {
  app: 'Soirely',
  channel: CARD_WORDS.en.channel,
  eventDayNote: CARD_WORDS.en.eventDayNote,
  settled: '[l10n]’s words of 18 Nov 2026',
  noCard: 'No card: Event day push is off, so this device puts none up either.',
} as const;

/** The longest title the card shows whole; a longer one keeps its first 39 and "…", counted as the title field counts (VisibleText). */
export const CARD_TITLE_MAX = 40;

function clustersOf(text: string): string[] {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter().segment(text), (part) => part.segment)
    : Array.from(text);
}

export function cardTitle(title: string): string {
  const parts = clustersOf(title);

  return parts.length > CARD_TITLE_MAX ? `${parts.slice(0, CARD_TITLE_MAX - 1).join('')}…` : title;
}

export interface RunCard {
  trackId: string;
  title: string;
  lines: readonly string[];
  spoken: string;
}

/** What a track's card says once a press there was made at `asOf`: the night's Now and Next at that moment, never "over". */
export function cardOf(
  night: Night,
  track: NightTrack,
  locale: string,
  asOf: number,
  waiting = 0,
): RunCard {
  const ordered = inOrder(track.items);
  const now =
    ordered
      .filter((item) => item.phase === 'now')
      .sort((a, b) => (a.started ?? a.planned) - (b.started ?? b.planned))[0] ?? null;
  const next = ordered.find((item) => item.phase === 'waiting') ?? null;
  const words = CARD_WORDS[cardLanguage(locale)];
  const shown = (minutes: number) => {
    const time = timeIn(locale, minutes);

    return [time, hourContext(time).context === 'hour1'] as const;
  };
  const title = `${NIGHT_EVENT_NAME} · ${labelOf(track, night, locale)}`;
  const [asOfTime, asOfOne] = shown(asOf);
  const lines =
    now == null && next == null
      ? [words.everything]
      : [
          now == null
            ? words.nothingOn
            : words.since(cardTitle(now.title), ...shown(now.started ?? now.planned)),
          next == null
            ? words.nothingElse(track.place)
            : words.next(
                cardTitle(next.title),
                ...shown(expectedStarts(track.items, asOf).get(next.id) ?? next.planned),
              ),
          waiting > 0
            ? words.waiting(
                asOfTime,
                waiting,
                asOfOne,
                new Intl.NumberFormat(locale).format(waiting),
              )
            : words.asOf(asOfTime, asOfOne),
        ];

  return {
    trackId: track.id,
    title,
    lines,
    spoken: [title, ...lines].map((part) => part.replace(/\.$/, '')).join('. ') + '.',
  };
}

export interface Held {
  asOf: number;
  waiting: number;
}

export type HeldCards = Readonly<Record<string, Held>>;

export function heldAtStart(night: Night): HeldCards {
  const held: Record<string, Held> = {};

  for (const track of night.tracks) {
    const times = track.items
      .flatMap((item) => [item.started, item.ended])
      .filter((t) => t != null);
    if (times.length > 0)
      held[track.id] = { asOf: Math.max(...times), waiting: night.online ? 0 : night.queued };
  }

  return held;
}

/** A press on this device replaces its track's card at once, signal or not; a press the night refused changes nothing. */
export function afterPress(
  held: HeldCards,
  trackId: string,
  before: Night,
  after: Night,
): HeldCards {
  if (after === before) return held;

  return { ...held, [trackId]: { asOf: before.clock, waiting: after.online ? 0 : after.queued } };
}

export function afterSend(held: HeldCards, sentAt: number): HeldCards {
  return Object.fromEntries(
    Object.entries(held).map(([id, card]) => [
      id,
      card.waiting > 0 ? { asOf: sentAt, waiting: 0 } : card,
    ]),
  );
}

export function cardsOf(night: Night, held: HeldCards, locale: string): RunCard[] {
  return night.tracks.flatMap((track) => {
    const card = held[track.id];

    return card == null ? [] : [cardOf(night, track, locale, card.asOf, card.waiting)];
  });
}

export function systemAge(clock: number, asOf: number): string {
  const minutes = Math.max(0, clock - asOf);

  return minutes < 1
    ? 'now'
    : minutes < 60
      ? `${minutes}m ago`
      : `${Math.floor(minutes / 60)}h ago`;
}

export function lockDate(clock: number, locale = 'en-US'): string {
  const day = Math.floor((clock + 5 * 60) / (24 * 60));

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(2026, 10, 20 + day));
}

type Track = 'hall' | 'foyer';

interface CardState {
  name: string;
  night: () => Night;
  cards: readonly { track: Track; asOf: string; waiting?: number }[];
  pushOff?: boolean;
  locale?: string;
}

/** 120 characters, the title field's most (ScheduleItem::TITLE_MAXIMUM): the card shows its first 39 and "…". */
export const LONG_TITLE =
  'Speeches from the father of the bride, the best man and the maid of honor, then a toast with the whole Ballroom standing';
export const LONG_TITLE_FR =
  'Discours du père de la mariée, du témoin et de la demoiselle d’honneur, puis un toast, avec toute la salle debout, ravie';

function retitled(night: Night, id: string, title: string): Night {
  return {
    ...night,
    tracks: night.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) => (item.id === id ? { ...item, title } : item)),
    })),
  };
}

const SPEAKING_LATE: Scene = {
  name: '',
  clock: '20:27',
  hall: { ...DINED, speeches: ['20:27'] },
};

export const CARD_STATES = {
  now_next: {
    name: 'Now and Next: Speeches since 20:27, after the Ballroom’s 5th press',
    night: () => sceneNight(SPEAKING_LATE),
    cards: [{ track: 'hall', asOf: '20:27' }],
  },
  nothing_on: {
    name: 'Nothing is on, with Next',
    night: () => sceneNight({ name: '', clock: '20:28', hall: GAP }),
    cards: [{ track: 'hall', asOf: '20:28' }],
  },
  no_next: {
    name: 'No Next: Nothing else is planned for Ballroom.',
    night: () => sceneNight({ name: '', clock: '00:27', hall: { ...DANCED, lastSong: ['00:27'] } }),
    cards: [{ track: 'hall', asOf: '00:27' }],
  },
  offline_one: {
    name: 'This device offline: 1 press waiting to send',
    night: () => sceneNight({ ...SPEAKING_LATE, online: false, queued: 1 }),
    cards: [{ track: 'hall', asOf: '20:27', waiting: 1 }],
  },
  offline_two: {
    name: 'This device offline: 2 presses waiting to send',
    night: () =>
      sceneNight({
        name: '',
        clock: '20:31',
        hall: { ...DINED, speeches: ['20:27', '20:30'], dance: ['20:31'] },
        online: false,
        queued: 2,
      }),
    cards: [{ track: 'hall', asOf: '20:31', waiting: 2 }],
  },
  end: {
    name: 'The end: That’s everything. only',
    night: () =>
      sceneNight({ name: '', clock: '00:42', hall: { ...DANCED, lastSong: ['00:27', '00:42'] } }),
    cards: [{ track: 'hall', asOf: '00:42' }],
  },
  two_tracks: {
    name: 'Two tracks pressed on: two cards, one per place',
    night: () => sceneNight({ ...SPEAKING_LATE, foyer: { booth: ['19:00'] } }),
    cards: [
      { track: 'hall', asOf: '20:27' },
      { track: 'foyer', asOf: '19:00' },
    ],
  },
  lost: {
    name: 'A queued press that lost: the card shows what the night shows after it',
    night: () =>
      sceneNight({
        name: '',
        clock: '20:33',
        hall: { ...GAP, dance: ['20:31'] },
        lost: { title: 'First dance', by: 'Ifeoma Nduka', at: at('20:31') },
      }),
    cards: [{ track: 'hall', asOf: '20:33' }],
  },
  earlier_day: {
    name: 'Saturday 09:10, Carriages skipped on Friday’s Foyer: “Foyer · Friday”',
    night: () => pressSkip(nightAt('picker_earlier_day').night, 'foyer', 'carriages'),
    cards: [{ track: 'foyer', asOf: '09:10' }],
  },
  long_now: {
    name: 'A 120-character title made Now: its first 39 and “…”, then the time whole',
    night: () => retitled(sceneNight(SPEAKING_LATE), 'speeches', LONG_TITLE),
    cards: [{ track: 'hall', asOf: '20:27' }],
  },
  long_next_fr: {
    name: 'French, a 120-character Next: the longest line, cut the same, the time whole',
    night: () => retitled(sceneNight(SPEAKING_LATE), 'dance', LONG_TITLE_FR),
    cards: [{ track: 'hall', asOf: '20:27' }],
    locale: 'fr-FR',
  },
  push_off: {
    name: 'Event day push off: no card, this device’s own included',
    night: () => sceneNight(SPEAKING_LATE),
    cards: [],
    pushOff: true,
  },
} as const satisfies Record<string, CardState>;

export type CardStateName = keyof typeof CARD_STATES;

export const SURFACES = ['lock', 'center', 'held', 'shade', 'shadeOpen', 'channels'] as const;

export type Surface = (typeof SURFACES)[number];

export const SURFACE_NAMES: Record<Surface, string> = {
  lock: 'iOS lock screen',
  center: 'iOS Notification Center',
  held: 'iOS, pressed and held',
  shade: 'Android shade, collapsed',
  shadeOpen: 'Android shade, expanded',
  channels: 'Android: Soirely’s notification settings',
};

export function cardStateOf(raw: string | undefined): CardStateName {
  return raw != null && Object.hasOwn(CARD_STATES, raw) ? (raw as CardStateName) : 'now_next';
}

export function surfaceOf(raw: string | undefined): Surface {
  return SURFACES.find((one) => one === raw) ?? 'lock';
}

export function cardScene(name: CardStateName, asked?: string) {
  const state: CardState = CARD_STATES[name];
  const locale = asked ?? state.locale ?? 'en-US';
  const night = state.night();
  const day = night.today;
  const cards = state.cards.flatMap(({ track, asOf, waiting }) => {
    const one = night.tracks.find((t) => t.id === track);

    return one == null ? [] : [cardOf(night, one, locale, at(asOf, day), waiting ?? 0)];
  });

  return {
    night,
    cards,
    pushOff: state.pushOff ?? false,
    ages: state.cards.map(({ asOf }) => systemAge(night.clock, at(asOf, day))),
    clock: timeIn(locale, night.clock),
    date: lockDate(night.clock, locale),
    locale,
  };
}

export const LOCK_CARD_BOARDS = [
  ...(Object.keys(CARD_STATES) as CardStateName[]).map((state) => ({
    title: `Lock-screen card · ${state}`,
    what: CARD_STATES[state].name,
    href: `/demo/lock-screen-card?state=${state}`,
  })),
  ...SURFACES.filter((surface) => surface !== 'lock').map((surface) => ({
    title: `Lock-screen card · ${SURFACE_NAMES[surface]}`,
    what:
      surface === 'channels'
        ? 'Run of show listed beside Event day, silent'
        : 'Two tracks, one card each; the same words, no button',
    href: `/demo/lock-screen-card?state=two_tracks&surface=${surface}`,
  })),
  {
    title: 'Lock-screen card · a press in the night replaces it',
    what: 'The night, with the sample card under it: press Done, lose the connection, Try now',
    href: '/demo/night?state=populated',
  },
  ...(['en', 'fr'] as const).map((lang) => ({
    title: `Notifications · Event day, opened · its longer description (${lang})`,
    what: 'Shown whole, three lines in French on an iPhone SE',
    href: `/demo/settings/notifications?state=eventDay&lang=${lang}`,
  })),
  {
    title: 'Notifications · Event day push off',
    what: 'No card, this device’s own included',
    href: '/demo/settings/notifications?state=eventDayPushOff',
  },
];
