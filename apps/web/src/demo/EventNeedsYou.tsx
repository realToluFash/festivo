import type { Milestone } from '@soirely/domain';
import { useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Head, TextAction } from '../components/SettingsParts.tsx';
import { type NeedRow, type NeedsState, NEEDS_WORDS as W, needRows } from './needsYou.ts';

const LOCALE = 'en-US';

function Row({ need }: { need: NeedRow }) {
  return (
    <li className="ev-need">
      <span className="ev-need-words">
        <span className="ev-need-title">{need.title}</span>
        <span className={need.late ? 'ev-need-due is-late' : 'ev-need-due'}>
          {need.late && <Glyph name="clock" size={14} weight={2.4} />}
          {need.due}
        </span>
      </span>
      {need.action != null && (
        <Link className="today-act" to={need.action.link}>
          <span className="today-act-pill">{need.action.label}</span>
        </Link>
      )}
    </li>
  );
}

function Count({ count }: { count: number }) {
  return (
    <span className="today-count">
      <span aria-hidden="true">{count}</span>
      <span className="visually-hidden">{`, ${count} ${count === 1 ? 'thing' : 'things'}`}</span>
    </span>
  );
}

/** The Overview's Needs you (sc-32801): the rows Today lists, from the event's dates, this event's only, so a row does not name it. */
export function EventNeedsYou({
  timeline,
  permissions,
  state,
  now,
  timeZone,
}: {
  timeline: readonly Milestone[];
  permissions: readonly string[];
  state: NeedsState | null;
  now: Date;
  timeZone: string;
}) {
  const [load, setLoad] = useState<'loading' | 'failed' | 'loaded'>(
    state === 'needsYouLoading' ? 'loading' : state === 'needsYouFailed' ? 'failed' : 'loaded',
  );
  const rows = load === 'loaded' ? needRows(timeline, permissions, now, timeZone, LOCALE) : [];

  return (
    <section className="desk-block" aria-labelledby="ev-needs-you">
      <Head
        title={
          <span id="ev-needs-you" className="ev-needs-title">
            {W.heading}
            {rows.length > 0 && <Count count={rows.length} />}
          </span>
        }
      />
      {load === 'loading' && <p className="desk-line">{W.loading}</p>}
      {load === 'failed' && (
        <div className="ev-unknown">
          <p className="desk-line">{W.failed}</p>
          <TextAction label="Try again" onClick={() => setLoad('loaded')} />
        </div>
      )}
      {load === 'loaded' && rows.length === 0 && (
        <div className="ev-needs-clear">
          <span className="today-tick" aria-hidden="true">
            <Glyph name="tick" size={19} weight={2.6} />
          </span>
          <span className="ev-need-title">{W.nothing}</span>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="ev-needs">
          {rows.map((need) => (
            <Row key={need.key} need={need} />
          ))}
        </ul>
      )}
    </section>
  );
}
