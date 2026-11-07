import { useId, useRef, useState } from 'react';

import { Glyph } from './Glyph.tsx';
import { CLOCK, ENDS, MATCHES, MW, UNKNOWN, ZONE, filled } from './messages.ts';
import { Dialog } from './SettingsParts.tsx';

const FOLD = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Who is this? (sc-3976): a guest for a sender Soirely could not match, found by name. */
export function MatchPicker({
  onMatch,
  onCancel,
}: {
  onMatch: (name: string) => void;
  onCancel: () => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('Dubois');
  const [picked, setPicked] = useState('Camille Dubois');
  const name = useId();
  const hintId = useId();
  const found = MATCHES.filter((one) => FOLD(one.name).includes(FOLD(query.trim())));

  return (
    <Dialog
      title={MW.whoIsThis}
      verb={filled(MW.thisIs, { name: picked })}
      first={search}
      on={found.some((one) => one.name === picked)}
      onDismiss={onCancel}
      onConfirm={() => onMatch(picked)}
    >
      <div className="mg-pick">
        <div className="mg-search">
          <Glyph name="search" size={16} />
          <input
            ref={search}
            type="search"
            aria-label={MW.searchGuests}
            placeholder={MW.searchGuests}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <fieldset className="mg-radios" aria-describedby={hintId}>
          <legend className="desk-unseen">{MW.whoIsThis}</legend>
          {found.map((one) => (
            <label key={one.name} className="mg-radio-row is-person">
              <input
                type="radio"
                name={name}
                className="desk-radio"
                checked={one.name === picked}
                onChange={() => setPicked(one.name)}
              />
              <span className="mg-pick-name">{one.name}</span>
              <span className="mg-pick-line">{one.line}</span>
            </label>
          ))}
        </fieldset>
        <p id={hintId} className="mg-tell-hint">
          {filled(MW.matchHint, { address: UNKNOWN.address, name: picked })}
        </p>
      </div>
    </Dialog>
  );
}

const SOONEST = Date.parse(CLOCK) + 5 * 60 * 1000;

/** When it goes (sc-3963): Now or Later, the day and time in the event's zone, refused beside the fields when too soon or too late. */
export function LaterDialog({
  day,
  time,
  onSchedule,
  onNow,
  onCancel,
}: {
  day: string;
  time: string;
  onSchedule: (day: string, time: string) => void;
  onNow: () => void;
  onCancel: () => void;
}) {
  const later = useRef<HTMLButtonElement>(null);
  const timeField = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState({ day, time });
  const [wrong, setWrong] = useState(false);
  const labelId = useId();
  const ruleId = useId();

  function schedule(): void {
    const at = Date.parse(`${when.day}T${when.time}:00Z`);

    if (Number.isNaN(at) || at < SOONEST || at >= Date.parse(ENDS.at)) {
      setWrong(true);
      timeField.current?.focus();
      return;
    }
    onSchedule(when.day, when.time);
  }

  return (
    <Dialog
      title={MW.whenItGoes}
      verb={MW.schedule}
      first={later}
      onDismiss={onCancel}
      onConfirm={schedule}
    >
      <div className="mg-later">
        <div className="mg-seg" role="radiogroup" aria-label={MW.whenItGoes}>
          <button type="button" role="radio" aria-checked="false" onClick={onNow}>
            {MW.segNow}
          </button>
          <button ref={later} type="button" role="radio" aria-checked="true" className="is-on">
            <Glyph name="tick" size={15} weight={2.6} />
            {MW.segLater}
          </button>
        </div>
        <p id={labelId} className="mg-tell-label">
          {MW.dateAndTime} · {filled(MW.zoneLine, { zone: ZONE })}
        </p>
        <div className="mg-when-fields" role="group" aria-labelledby={labelId}>
          <input
            type="date"
            className={wrong ? 'mg-when-field is-wrong' : 'mg-when-field'}
            aria-label={MW.dateLabel}
            aria-invalid={wrong}
            aria-describedby={ruleId}
            value={when.day}
            onChange={(event) => {
              setWhen((now) => ({ ...now, day: event.target.value }));
              setWrong(false);
            }}
          />
          <input
            ref={timeField}
            type="time"
            className={wrong ? 'mg-when-field is-time is-wrong' : 'mg-when-field is-time'}
            aria-label={MW.timeLabel}
            aria-invalid={wrong}
            aria-describedby={ruleId}
            value={when.time}
            onChange={(event) => {
              setWhen((now) => ({ ...now, time: event.target.value }));
              setWrong(false);
            }}
          />
        </div>
        <p
          id={ruleId}
          className={wrong ? 'mg-tell-hint is-wrong' : 'mg-tell-hint'}
          role={wrong ? 'alert' : undefined}
        >
          {wrong && <Glyph name="alert" size={15} weight={2.2} />}
          {filled(MW.laterRule, { date: ENDS.date, time: ENDS.time })}
        </p>
        <p className="mg-tell-hint">{MW.workedOut}</p>
      </div>
    </Dialog>
  );
}
