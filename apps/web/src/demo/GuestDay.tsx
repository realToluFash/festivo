import { useState } from 'react';

import {
  EVENT,
  REPLY_BY,
  type Visit,
  type Words,
  answersClosedByDate,
  dayOf,
  eventTime,
} from './guest.ts';
import { hasStep, partyLine } from './guestCompanions.ts';
import { dayWords, hasWhere, mapsLink, placeOf } from './guestDay.ts';
import { GUEST_KITCHEN_SAVED_ID, GuestKitchenSaved } from './GuestKitchen.tsx';
import { DoorCode, Line, TextAction } from './GuestParts.tsx';
import { useWakeLock } from './useWakeLock.ts';
import './guestDay.css';

/** sc-1301's card under Your code; the screen stays on while it is in view. */
export function YourCode({ visit, words }: { visit: Visit; words: Words }) {
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  useWakeLock(card);

  return (
    <DoorCode
      words={words}
      companions={visit.companionsComing}
      heading={dayWords(visit.lang).code}
      cardRef={setCard}
    />
  );
}

export function WhereBlock({ visit, words }: { visit: Visit; words: Words }) {
  const place = placeOf(visit);
  const zoned = visit.readerZone !== EVENT.timeZone;
  const time = eventTime(visit.lang);

  if (!hasWhere(place)) return null;

  return (
    <section className="gp-day-block" aria-labelledby="gp-where-h">
      <h2 id="gp-where-h" className="gp-h2">
        {dayWords(visit.lang).where}
      </h2>
      <div className="gp-day-place">
        <p className="gp-day-time">
          <time dateTime={EVENT.startsAt}>
            {zoned ? words.timeInZone(time, EVENT.timeZone) : time}
          </time>
        </p>
        {place.name != null && <p className="gp-day-venue">{place.name}</p>}
        {place.address != null && (
          <>
            <p className="gp-day-address">{place.address}</p>
            <a
              className="gp-text"
              href={mapsLink(place.address)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Line name="map" size={18} weight={2.2} />
              <span>{words.openInMaps}</span>
            </a>
          </>
        )}
      </div>
      {place.note != null && (
        <p className="gp-day-note" dir="auto">
          {place.note}
        </p>
      )}
    </section>
  );
}

/** sc-1439's recorded and closed views as on any other day, the party line and the kitchen's saved note included, without the place: on the day it shows once, in Where. */
export function DayAnswer({
  visit,
  words,
  onChange,
  onKitchen,
}: {
  visit: Visit;
  words: Words;
  onChange: () => void;
  onKitchen: () => void;
}) {
  const { recorded, view, lang, started } = visit;

  if (recorded == null) return null;
  const on = dayOf(recorded.on, lang);
  const closed = view.kind === 'closed';
  const saved = closed && visit.kitchen?.saved === true;

  return (
    <section className="gp-day-block" aria-labelledby="gp-day-answer-h">
      <h2 id="gp-day-answer-h" className="gp-h2">
        {words.yourAnswer}
      </h2>
      <p className="gp-day-answered" tabIndex={-1} data-focus="greeting">
        {recorded.by == null
          ? words.answered(recorded.answer, on)
          : words.recordedFor(recorded.by, on)}
      </p>
      {view.kind === 'recorded' && view.same && (
        <p className="gp-sub is-ink">{words.same(recorded.answer)}</p>
      )}
      {view.kind === 'recorded' && hasStep(visit.party) && (
        <p className="gp-sub">{partyLine(visit.party, lang)}</p>
      )}
      {saved && <GuestKitchenSaved lang={lang} />}
      {closed && (
        <p className="gp-sub">
          {started || !answersClosedByDate(visit)
            ? words.closed
            : words.closedBy(dayOf(visit.replyBy ?? REPLY_BY, lang))}
        </p>
      )}
      {!closed && (
        <TextAction focus="change" onClick={onChange}>
          {words.change}
        </TextAction>
      )}
      {closed && !started && (
        <TextAction
          focus="kitchen"
          {...(saved ? { describedBy: GUEST_KITCHEN_SAVED_ID } : {})}
          icon={<Line name="pencil" size={18} weight={2.2} />}
          onClick={onKitchen}
        >
          {words.kitchen}
        </TextAction>
      )}
    </section>
  );
}

/** Loading on the day: the blocks in place, the code card's box at its size so nothing moves when it arrives. */
export function DayWaiting({ band }: { band: boolean }) {
  return (
    <>
      <span className={band ? 'gp-skel gp-band gp-left' : 'gp-skel gp-skel-cover gp-left'} />
      <div className="gp-skel-under gp-day-skel">
        {band && (
          <>
            <span className="gp-skel is-head" />
            <span className="gp-skel is-line" />
            <span className="gp-skel is-short" />
          </>
        )}
        <span className="gp-skel is-head" />
        <div className="gp-day-card">
          <span className="gp-skel gp-day-skel-door" />
          <span className="gp-skel gp-day-skel-qr" />
          <span className="gp-skel gp-day-skel-line" />
        </div>
        <span className="gp-skel is-head" />
        <span className="gp-skel is-line" />
        <span className="gp-skel is-short" />
      </div>
    </>
  );
}
