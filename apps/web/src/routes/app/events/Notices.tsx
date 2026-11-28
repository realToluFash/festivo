import { ApiError, type OrganisationEvent, type StaffReminder } from '@soirely/api-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Switch } from '../../../components/GeneralParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { type NoticeMark, reminderLines } from '@soirely/domain';
import './notices.css';

/** The staffing page's Reminder the day before (sc-4333), push only: its cost line and shortfall warning are sc-96965's. Read again whenever the roster changes, since who it reaches does. */
export function ReminderCard({
  event,
  manage,
  roster,
  onOver,
  announce,
}: {
  event: OrganisationEvent;
  manage: boolean;
  /** Changes whenever the roster does. */
  roster: unknown;
  /** The switch was refused because the event is over; the caller shows the line, as it does for a refused send. */
  onOver: () => void;
  announce: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [card, setCard] = useState<StaffReminder | null>(null);
  const [busy, setBusy] = useState(false);
  const [notSaved, setNotSaved] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .staffReminder(event.id)
      .then((answer) => {
        if (live) setCard(answer);
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [event.id, roster]);

  if (card == null) return null;
  const lines = reminderLines(card, dateLocale(), t);

  async function flip(next: boolean) {
    if (card == null || busy) return;
    setBusy(true);
    setNotSaved(false);
    try {
      setCard(await api.setStaffReminder(event.id, next));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'event_concluded') {
        onOver();
        announce(t('notices.alreadyOver'));
        setCard(await api.staffReminder(event.id).catch(() => card));
      } else {
        setNotSaved(true);
        announce(card.on ? t('notices.notSavedOn') : t('notices.notSavedOff'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="sn-card sv-card" aria-labelledby="sv-title">
        <div className="sn-card-top">
          <div className="sn-card-names">
            <h2 id="sv-title">{t('notices.card')}</h2>
          </div>
          {lines.kind === 'open' &&
            (manage ? (
              <Switch
                on={card.on}
                label={t('notices.switchLabel')}
                words={{ on: t('notices.on'), off: t('notices.off') }}
                told="sv-does"
                busy={busy}
                onChange={(next) => void flip(next)}
              />
            ) : (
              <p className="sv-word">{card.on ? t('notices.on') : t('notices.off')}</p>
            ))}
        </div>
        {lines.kind === 'finished' ? (
          <p className="sv-finished">{lines.line}</p>
        ) : (
          <>
            <p id="sv-does" className="mn-sub">
              {t('notices.does', { time: card.time })}
            </p>
            {notSaved && (
              <p className="rs-missed" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {card.on ? t('notices.notSavedOn') : t('notices.notSavedOff')}
              </p>
            )}
            {(lines.top != null || lines.left.length > 0) && (
              <div className="sv-lines">
                {lines.top != null && <p className="sv-next">{lines.top}</p>}
                {lines.left.map((line) => (
                  <p key={line} className="sv-line">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function NoticeLines({ lines }: { lines: { mark: NoticeMark | null; words: string }[] }) {
  if (lines.length === 0) return null;

  return (
    <span className="sv-row-lines">
      {lines.map((line, i) => (
        <span
          key={`${i}-${line.words}`}
          className={line.mark == null ? 'sv-row-line is-under' : 'sv-row-line'}
        >
          {line.mark != null && <Mark mark={line.mark} />}
          {line.words}
        </span>
      ))}
    </span>
  );
}

const MARK_CLASS = {
  waiting: 'is-waiting',
  told: 'is-told',
  called_off: 'is-called-off',
  ended: 'is-ended',
} satisfies Record<NoticeMark, string>;

/** Each mark a shape of its own, so none relies on colour: a call-off struck through, an end a stop square. */
function Mark({ mark }: { mark: NoticeMark }) {
  if (mark === 'called_off' || mark === 'ended')
    return (
      <span className={`sv-mark ${MARK_CLASS[mark]}`} aria-hidden="true">
        <span className="sv-mark-inner" />
      </span>
    );

  return (
    <span className={`sv-mark ${MARK_CLASS[mark]}`} aria-hidden="true">
      <Glyph name={mark === 'waiting' ? 'clock' : 'message'} size={14} weight={2.6} />
    </span>
  );
}
