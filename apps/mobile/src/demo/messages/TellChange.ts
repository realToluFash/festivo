import { writtenTime } from '../clock.ts';
import { dayCount, daysWords, wallOf } from '../events/EventsModel.ts';
import type { SampleEvent, SampleVenue } from '../events/EventsSample.ts';
import type { TellChange } from './MessagesModel.ts';
import { SAMPLE_EVENT_ID } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';

function venueLine(told: SampleVenue | null, now: SampleVenue | null): string | null {
  const was = told == null ? '' : told.name || told.address;
  const is = now == null ? '' : now.name || now.address;
  if (was === '' && is === '') return null;
  if (was === '') return say.venueAdded(is);
  if (is === '') return say.venueGone(was);
  if (told != null && now != null && told.name !== '' && told.name === now.name) {
    if (told.address === now.address || now.address === '') return null;
    if (told.address === '') return say.venueAdded(`${now.name}, ${now.address}`);

    return say.venueMoved(now.address, told.address);
  }

  return was === is ? null : say.venueMoved(is, was);
}

/** sc-4330: a saved change to the date, the start time or the venue of a live event with invited guests offers to tell them, one line per field, from what they were last told. */
export function tellChange(told: SampleEvent, now: SampleEvent, locale: string): TellChange {
  const lines: string[] = [];
  const what: string[] = [];
  if (now.id !== SAMPLE_EVENT_ID || (now.status !== 'live' && now.status !== 'paused'))
    return { lines, what };

  const daysWere = daysWords(told, locale, false);
  const daysAre = daysWords(now, locale, false);
  if (daysWere !== daysAre) {
    const several = dayCount(now) > 1;
    lines.push(several ? say.datesMoved(daysAre, daysWere) : say.dateMoved(daysAre, daysWere));
    what.push(several ? W.newDates : W.newDate);
  }
  const startWas = wallOf(told.startsAt, told.timeZone).time;
  const startIs = wallOf(now.startsAt, now.timeZone).time;
  if (startWas !== startIs) {
    lines.push(say.startMoved(writtenTime(startIs, locale), writtenTime(startWas, locale)));
    what.push(W.newStartTime);
  }
  const venue = venueLine(told.venue, now.venue);
  if (venue != null) {
    lines.push(venue);
    what.push(W.newVenue);
  }
  const address =
    venue != null &&
    now.venue != null &&
    now.venue.address !== '' &&
    !venue.includes(now.venue.address);

  return { lines, what, address };
}
