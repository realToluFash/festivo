import type { ShiftClockCard } from '@soirely/api-client';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { type HoursClock, clockIn, hoursWords, timeWords } from '../app/events/hoursWorked.ts';
import './redeem.css';
import './shiftClock.css';

export type ClockLine = 'alreadyIn' | 'alreadyOut' | 'offIn' | 'offOut' | null;

export interface ClockSeen {
  card: ShiftClockCard;
  line: ClockLine;
  busy: boolean;
}

function Status({ words, done }: { words: string; done: boolean }) {
  return (
    <p className="sk-status">
      <span className={done ? 'sk-shape is-done' : 'sk-shape'} aria-hidden="true">
        {done && <Glyph name="tick" size={12} weight={3.2} />}
      </span>
      {words}
    </p>
  );
}

/** Always in the card before the tap, so a screen reader reads the line as it is put in (WCAG 2.2 SC 4.1.3). */
function TapLine({ seen, now, on }: { seen: ClockSeen; now: number; on: HoursClock }) {
  const { t } = useTranslation();
  const { card, line } = seen;
  const offline = line === 'offIn' || line === 'offOut';
  const words =
    line === 'alreadyIn'
      ? t('staffLink.clock.alreadyIn', { time: timeWords(t, card.clockedInAt ?? '', now, on) })
      : line === 'alreadyOut'
        ? t('staffLink.clock.alreadyOut', { time: timeWords(t, card.clockedOutAt ?? '', now, on) })
        : line === 'offIn'
          ? t('staffLink.clock.offIn')
          : line === 'offOut'
            ? t('staffLink.clock.offOut')
            : null;

  return (
    <div role="status" className="sk-live">
      {words != null && (
        <p className={offline ? 'sk-line is-attention' : 'sk-line'}>
          <span className="sk-ring" aria-hidden="true">
            {offline ? '!' : 'i'}
          </span>
          {words}
        </p>
      )}
    </div>
  );
}

/** sc-234's clock card on a person's own night, from Clock in to the hours recorded; Clock in opens at is My night's own. */
export function ClockCard({
  seen,
  past,
  now,
  timeZone,
  onPress,
}: {
  seen: ClockSeen;
  /** Past their access, in a browser: clocking out also signs them out. */
  past: boolean;
  now: number;
  timeZone: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const on: HoursClock = { timeZone, locale: dateLocale() };
  const { card, busy } = seen;
  const at = (moment: string | null) => timeWords(t, moment ?? '', now, on);

  if (card.phase === 'ready')
    return (
      <section className="sk-card" aria-label={t('staffLink.clock.clockIn')}>
        <TapLine seen={seen} now={now} on={on} />
        <button type="button" className="sk-primary" aria-busy={busy} onClick={onPress}>
          {busy ? t('staffLink.clock.clockingIn') : t('staffLink.clock.clockIn')}
        </button>
        <p className="sk-help">{t('staffLink.clock.readyLine')}</p>
      </section>
    );
  if (card.phase === 'on')
    return (
      <section className="sk-card" aria-label={t('staffLink.clock.clockOut')}>
        <Status words={t('staffLink.clock.clockedInAt', { time: at(card.clockedInAt) })} done />
        <TapLine seen={seen} now={now} on={on} />
        <button type="button" className="sk-primary" aria-busy={busy} onClick={onPress}>
          {busy ? t('staffLink.clock.clockingOut') : t('staffLink.clock.clockOut')}
        </button>
        <p className="sk-help">
          {past
            ? t('staffLink.clock.browserOut', { time: at(card.outUntil) })
            : t('staffLink.clock.stayLine', { end: clockIn(card.closesAt, on) })}
        </p>
      </section>
    );
  if (card.phase === 'off')
    return (
      <section className="sk-card" aria-label={t('staffLink.night.yourShift')}>
        <Status
          words={t('staffLink.clock.inOut', {
            in: at(card.clockedInAt),
            out: at(card.clockedOutAt),
          })}
          done
        />
        <p className="sk-help is-strong">
          {t('staffLink.clock.recorded', { hours: hoursWords(t, card.workedMinutes ?? 0) })}
        </p>
        <TapLine seen={seen} now={now} on={on} />
        <p className="sk-help">{t('staffLink.clock.helper')}</p>
      </section>
    );

  return (
    <section className="sk-card" aria-label={t('staffLink.clock.clockIn')}>
      <Status
        words={t('staffLink.clock.closedAt', { time: clockIn(card.closesAt, on) })}
        done={false}
      />
      <p className="sk-strong">{t('staffLink.clock.closedLine')}</p>
    </section>
  );
}

/** Past their access, the page is the event's name and the clock card alone. */
export function PastAccess({ name, children }: { name: string; children: ReactNode }) {
  return (
    <main id="content" className="rd sk">
      <div className="rd-column">
        <div className="rd-brand">
          <Brand />
        </div>
        <h1 className="sk-title">{name}</h1>
        {children}
      </div>
    </main>
  );
}

/** The link's ended page once a clock-out past their access signs them out: no event name. */
export function ClockedOutEnded({
  seen,
  now,
  timeZone,
}: {
  seen: ClockSeen;
  now: number;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const on: HoursClock = { timeZone, locale: dateLocale() };

  return (
    <main id="content" className="rd sk">
      <div className="rd-column">
        <div className="rd-brand">
          <Brand />
        </div>
        <Status
          words={t('staffLink.clock.clockedOutAt', {
            time: timeWords(t, seen.card.clockedOutAt ?? '', now, on),
          })}
          done
        />
        <TapLine seen={seen} now={now} on={on} />
        <h1 className="sk-title">{t('staffLink.clock.signedOut')}</h1>
        <p className="sk-inset">{t('staffLink.clock.ended')}</p>
        <p className="sk-help">{t('staffLink.clock.nothingSaved')}</p>
      </div>
    </main>
  );
}
