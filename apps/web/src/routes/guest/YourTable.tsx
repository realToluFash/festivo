import type { GuestPage } from '@soirely/api-client';
import { seatWords } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../components/Glyph.tsx';
import './yourTable.css';

/** sc-4022's Your table, under the answer, or under its own heading between Where and The day on the event's day (sc-24381): only while the hosts share the tables and this guest is Coming with a seat, which the API alone decides by sending the field. */
export function YourTable({ page, onTheDay = false }: { page: GuestPage; onTheDay?: boolean }) {
  const { t } = useTranslation();
  const { seating } = page;

  if (seating == null || page.guest.reply?.answer !== 'coming') return null;
  const heading =
    seating.seat.kind === 'table' ? t('guest.table.yourTable') : t('guest.table.yourSeat');

  return (
    <section
      className={onTheDay ? 'gp-day-block gp-table' : 'gp-block gp-table'}
      aria-label={heading}
    >
      <div className="gp-table-live" aria-live="polite">
        {onTheDay ? (
          <>
            <h2 className="gp-h2">{heading}</h2>
            <p className="gp-table-line">
              <Glyph name="seating" size={20} weight={2} />
              <span>{seatWords(t, seating.seat)}</span>
            </p>
          </>
        ) : (
          <p className="gp-table-line is-lead">
            <Glyph name="seating" size={20} weight={2} />
            <span>{t('guest.table.lead', { heading, place: seatWords(t, seating.seat) })}</span>
          </p>
        )}
        {seating.elsewhere.length > 0 && (
          <ul className="gp-table-elsewhere">
            {seating.elsewhere.map((one, index) => (
              <li key={index}>
                {t('guest.table.companion', {
                  name: one.name ?? t('guest.table.yourGuest'),
                  place: seatWords(t, one.seat, false),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
