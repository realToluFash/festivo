import type { GuestPage, GuestSeat } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../components/Glyph.tsx';
import './yourTable.css';

/** sc-4022's Your table, under the answer: only while the hosts share the tables and this guest is Coming with a seat, which the API alone decides by sending the field. */
export function YourTable({ page }: { page: GuestPage }) {
  const { t } = useTranslation();
  const { seating } = page;

  if (seating == null || page.guest.reply?.answer !== 'coming') return null;
  const heading =
    seating.seat.kind === 'table' ? t('guest.table.yourTable') : t('guest.table.yourSeat');

  return (
    <section className="gp-block gp-table" aria-label={heading}>
      <div className="gp-table-live" aria-live="polite">
        <p className="gp-table-line is-lead">
          <Glyph name="seating" size={20} weight={2} />
          <span>{t('guest.table.lead', { heading, place: placeOf(t, seating.seat) })}</span>
        </p>
        {seating.elsewhere.length > 0 && (
          <ul className="gp-table-elsewhere">
            {seating.elsewhere.map((one, index) => (
              <li key={index}>
                {t('guest.table.companion', {
                  name: one.name ?? t('guest.table.yourGuest'),
                  place: placeOf(t, one.seat, false),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** "Table 4 · Main hall", "Row C, seat 4 · Balcony"; a companion's line leaves the section out, as the demo's does. */
function placeOf(t: TFunction, seat: GuestSeat, withSection = true): string {
  const place =
    seat.kind === 'row' ? t('guest.table.row', { row: seat.name, seat: seat.seat }) : seat.name;

  return !withSection || seat.section == null
    ? place
    : t('guest.table.placed', { place, section: seat.section });
}
