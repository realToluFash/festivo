import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { f } from './seatingDraw.ts';
import { type Colleague, type ColleagueRing, useRing } from './seatingPresence.ts';

/** Who else is on the plan, by the page title: their chips and a line saying so, or that we cannot tell. */
export function Presence({
  people,
  lost,
  spoken,
}: {
  people: Colleague[];
  lost: boolean;
  spoken: string;
}) {
  const { t } = useTranslation();
  const [listOpen, setListOpen] = useState(false);
  const heard = (
    <p className="desk-unseen" role="status" aria-live="polite">
      {spoken}
    </p>
  );

  if (lost)
    return (
      <div className="st-presence">
        <p className="st-presence-line" role="status">
          <Glyph name="refresh" size={15} weight={2.2} />
          {t('seating.reconnecting')}
        </p>
        {heard}
      </div>
    );
  if (people.length === 0) return heard;

  const first = people[0]!;
  const words =
    people.length === 1
      ? t('seating.onPlan', { name: first.name })
      : t('seating.andOthers', { name: first.name, count: people.length - 1 });
  const shown = people.length >= 6 ? people.slice(0, 4) : people;
  const toggle = () => setListOpen((was) => !was);

  return (
    <div className="st-presence">
      <ul className="st-faces" aria-label={words}>
        {shown.map((person) => (
          <li key={person.userId}>
            <button
              type="button"
              className="st-face-button"
              title={person.name}
              aria-label={
                person.editor ? person.name : t('seating.personCanView', { name: person.name })
              }
              onClick={toggle}
            >
              <Face person={person} />
            </button>
          </li>
        ))}
        {shown.length < people.length && (
          <li>
            <button
              type="button"
              className="st-more"
              aria-haspopup="dialog"
              aria-expanded={listOpen}
              aria-label={t('seating.moreOnPlan', { count: people.length - 4 })}
              onClick={toggle}
            >
              +{people.length - 4}
            </button>
          </li>
        )}
      </ul>
      <span className="st-presence-line" aria-hidden="true">
        {words}
      </span>
      {listOpen && (
        <div className="st-on-plan" role="dialog" aria-labelledby="st-on-plan">
          <h2 id="st-on-plan">{t('seating.onThisPlan')}</h2>
          <ul>
            {people.map((person) => (
              <li key={person.userId}>
                <Face person={person} size={28} />
                <span className="st-row-name">{person.name}</span>
                {!person.editor && <span className="st-row-line">{t('seating.canView')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {heard}
    </div>
  );
}

export function Face({ person, size = 32 }: { person: Colleague; size?: 24 | 28 | 32 }) {
  return (
    <span className={`st-face p${person.tone} is-${size}`} aria-hidden="true">
      {person.initials}
    </span>
  );
}

/** A colleague's ring outside a white gap, with their initials at its top left; fixed screen px at every zoom. */
export function ColleagueOutline({
  ring,
  round,
  cx,
  cy,
  ex,
  ey,
  rotation,
  pad,
}: {
  ring: ColleagueRing;
  round: boolean;
  cx: number;
  cy: number;
  ex: number;
  ey: number;
  rotation: number;
  pad: number;
}) {
  if (round) {
    const rr = ex + pad + 3.5;

    return (
      <g className={`st-ring p${ring.tone}`} aria-hidden="true">
        <circle className="st-ring-gap" cx={f(cx)} cy={f(cy)} r={f(rr)} />
        <circle className="st-ring-line" cx={f(cx)} cy={f(cy)} r={f(rr + 1.5)} />
        <InitialsPill x={cx - rr * 0.72} y={cy - rr * 0.72} words={ring.initials} />
      </g>
    );
  }

  const gw = ex + pad + 2;
  const gh = ey + pad + 2;
  const turn = (rotation * Math.PI) / 180;
  const px = -gw * Math.cos(turn) + gh * Math.sin(turn);
  const py = -gw * Math.sin(turn) - gh * Math.cos(turn);

  return (
    <g className={`st-ring p${ring.tone}`} aria-hidden="true">
      <g transform={`translate(${f(cx)} ${f(cy)}) rotate(${rotation})`}>
        <rect
          className="st-ring-gap"
          x={f(-gw)}
          y={f(-gh)}
          width={f(2 * gw)}
          height={f(2 * gh)}
          rx="9"
        />
        <rect
          className="st-ring-line"
          x={f(-gw - 1.5)}
          y={f(-gh - 1.5)}
          width={f(2 * gw + 3)}
          height={f(2 * gh + 3)}
          rx="10"
        />
      </g>
      <InitialsPill x={cx + px} y={cy + py} words={ring.initials} />
    </g>
  );
}

function InitialsPill({ x, y, words }: { x: number; y: number; words: string }) {
  return (
    <g className="st-initials">
      <rect x={f(x - 4)} y={f(y - 11)} width="30" height="22" rx="11" />
      <text x={f(x + 11)} y={f(y)} textAnchor="middle" dominantBaseline="central">
        {words}
      </text>
    </g>
  );
}

/** In the side panel, when you have chosen what a colleague has: never a lock, only a warning. */
export function ColleagueNote({ id }: { id: string }) {
  const { t } = useTranslation();
  const ring = useRing(id);

  if (ring == null) return null;
  return (
    <div className="st-colleague">
      <Face person={ring} size={24} />
      <p>{t('seating.choseToo', { name: ring.name })}</p>
    </div>
  );
}
