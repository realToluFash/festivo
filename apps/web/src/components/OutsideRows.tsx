import type { OutsideEvent } from '@soirely/api-client';
import { initials, isUnderWay, outsideEventLine, outsideRowLabel } from '@soirely/domain';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from './Glyph.tsx';
import { dateLocale } from '../i18n/index.ts';
import { meshFor } from '../mesh.ts';
import './outsideEvents.css';

/** One event held from outside (sc-68438): its tile, its name, "{organisation} · {date} · {start}", and its marks. */
export function OutsideEventRow({
  event,
  here,
  now,
  className,
  role,
  onChoose,
}: {
  event: OutsideEvent;
  here: boolean;
  now: Date;
  className: string;
  role?: 'menuitem';
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const line = outsideEventLine(event, dateLocale());
  const under = isUnderWay(event, now);
  const label = outsideRowLabel(event, dateLocale(), {
    underWay: under ? t('outsideEvent.underWay') : null,
    here: here ? t('outsideEvent.here') : null,
  });

  return (
    <button
      type="button"
      role={role}
      tabIndex={role == null ? undefined : -1}
      className={className}
      aria-label={label}
      onClick={onChoose}
    >
      <span className={`oe-tile today-cover is-${meshFor(event.id)}`} aria-hidden="true" />
      <span className="oe-words" aria-hidden="true">
        <span className="oe-name">{event.name}</span>
        <span className="oe-line">{line}</span>
        {(under || here) && (
          <span className="oe-marks">
            {under && (
              <span className="desk-tag is-now">
                <span className="oe-dot" />
                {t('outsideEvent.underWay')}
              </span>
            )}
            {here && (
              <span className="oe-here">
                <Glyph name="tick" size={14} weight={2.6} />
                {t('outsideEvent.here')}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

/** One of a member's organisations: its tile, its name and the member's role there. */
export function OrganisationRow({
  id,
  name,
  role,
  onChoose,
}: {
  id: string;
  name: string;
  role: string;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="desk-menu-item oe-row"
      aria-label={`${name}. ${role}`}
      onClick={onChoose}
    >
      <span className={`oe-tile is-place today-cover is-${meshFor(id)}`} aria-hidden="true">
        {initials(name)}
      </span>
      <span className="oe-words" aria-hidden="true">
        <span className="oe-name">{name}</span>
        <span className="oe-line">{role}</span>
      </span>
    </button>
  );
}

export function MenuGroup({ heading, children }: { heading: string; children: ReactNode }) {
  const id = useId();

  return (
    <div role="group" aria-labelledby={id} className="oe-group">
      <span id={id} className="oe-heading">
        {heading}
      </span>
      {children}
    </div>
  );
}
