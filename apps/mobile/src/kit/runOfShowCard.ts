import { type NightTrack, type NightView, timeSlot, visibleLength } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { NightShownItem } from './night.ts';

/** The longest title the card shows whole; a longer one keeps its first 39 and "…", counted as the title field counts. */
export const CARD_TITLE_MAX = 40;

export function cardTitle(title: string): string {
  const total = visibleLength(title);
  if (total <= CARD_TITLE_MAX) return title;

  let cut = 0;
  let end = 0;
  for (const point of title) {
    end += point.length;
    const head = visibleLength(title.slice(0, end));
    if (head > CARD_TITLE_MAX - 1) break;
    if (head + visibleLength(title.slice(end)) === total) cut = end;
  }

  return `${title.slice(0, cut)}…`;
}

export interface RunOfShowCardWords {
  title: string;
  lines: string[];
}

/** What this device puts up after a press (sc-66580): the night's Now and Next as it has them, As of the moment, and the presses still waiting to send. */
export function runOfShowCardOf(
  eventName: string,
  label: string,
  track: NightTrack<NightShownItem>,
  view: NightView<NightShownItem>,
  now: string,
  waiting: number,
  locale: string,
  t: TFunction,
): RunOfShowCardWords {
  const title = t('runOfShowCard.title', { event: eventName, place: label });

  if (view.now == null && view.next == null) return { title, lines: [t('night.everything')] };

  const asOf = timeSlot(now, locale);
  const nowLine =
    view.now == null
      ? t('runView.nothingNow')
      : t('night.since', {
          now: cardTitle(view.now.title),
          ...timeSlot(view.now.startedAt ?? view.now.planned, locale),
        });
  const nextLine =
    view.next == null
      ? t('night.nothingElse', { place: track.place ?? t('runView.main') })
      : t('runOfShowCard.next', {
          title: cardTitle(view.next.item.title),
          ...timeSlot(view.next.expected ?? view.next.planned, locale),
        });
  const asOfLine =
    waiting > 0
      ? t('runOfShowCard.asOfWaiting', { ...asOf, count: waiting })
      : t('runOfShowCard.asOf', asOf);

  return { title, lines: [nowLine, nextLine, asOfLine] };
}
