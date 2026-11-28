import { initials } from '@soirely/domain';

import { Glyph } from '../components/Glyph.tsx';
import { meshFor } from '../mesh.ts';
import { OUTSIDE, type OutsideEvent, coverOf, rowLine, underWay } from './outsideEvents.ts';
import './outsideEvents.css';

export function EventRowWords({ event, here }: { event: OutsideEvent; here: boolean }) {
  const now = underWay(event);

  return (
    <>
      <span className={`oe-tile today-cover is-${coverOf(event)}`} aria-hidden="true" />
      <span className="oe-words" aria-hidden="true">
        <span className="oe-name">{event.name}</span>
        <span className="oe-line">{rowLine(event)}</span>
        {(now || here) && (
          <span className="oe-marks">
            {now && (
              <span className="desk-tag is-now">
                <span className="oe-dot" />
                {OUTSIDE.underWay}
              </span>
            )}
            {here && (
              <span className="oe-here">
                <Glyph name="tick" size={14} weight={2.6} />
                {OUTSIDE.here}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );
}

export function PlaceRowWords({ id, name, role }: { id: string; name: string; role: string }) {
  return (
    <>
      <span className={`oe-tile is-place today-cover is-${meshFor(id)}`} aria-hidden="true">
        {initials(name)}
      </span>
      <span className="oe-words" aria-hidden="true">
        <span className="oe-name">{name}</span>
        <span className="oe-line">{role}</span>
      </span>
    </>
  );
}
