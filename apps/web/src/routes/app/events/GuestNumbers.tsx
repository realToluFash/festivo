import {
  type HeadcountCounts,
  type OrganisationEvent,
  asHeadcount,
  realtimeTopic,
} from '@soirely/api-client';
import { REPLY_KEY, numberFormat } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Chevron, Head, RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { MarkLead, ReplyMark } from './GuestColumn.tsx';
import { useHubTopics } from './useHubTopics.ts';
import './guests.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; counts: HeadcountCounts };

/** Overview's rows in order, each with the filter it opens: the five after Invited are exclusive and add up to it (sc-3772). */
const ROWS = [
  { key: 'invited', count: (counts: HeadcountCounts) => counts.invited },
  { key: 'coming', count: (counts: HeadcountCounts) => counts.accepted },
  { key: 'notComing', count: (counts: HeadcountCounts) => counts.declined },
  { key: 'maybe', count: (counts: HeadcountCounts) => counts.maybe },
  { key: 'noReply', count: (counts: HeadcountCounts) => counts.awaitingReply },
  { key: 'held', count: (counts: HeadcountCounts) => counts.held },
] as const;

/** Overview's guest numbers (sc-3786), sc-99's for the event: rows that each open the guests they count, then those not yet invited. */
export function GuestNumbers({ event }: { event: OrganisationEvent }) {
  const { t, i18n } = useTranslation();
  const figure = numberFormat(i18n.language);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const guests = `/app/events/${encodeURIComponent(event.id)}/guests`;

  useEffect(() => {
    let current = true;

    api.headcount(event.id).then(
      (headcount) => current && setLoad({ kind: 'loaded', counts: headcount.counts }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  useHubTopics(
    [realtimeTopic('EventHeadcount', event.id)],
    () => api.guestsSubscription(event.id),
    (data) => {
      const headcount = asHeadcount((data as { headcount?: unknown } | null)?.headcount);

      if (headcount == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', counts: headcount.counts });
    },
    () => setAttempt((n) => n + 1),
  );

  const title = <span id="gs-numbers">{t('guestNumbers.title')}</span>;
  const openList = (
    <Link className="desk-text" to={guests}>
      {t('guestNumbers.openList')}
    </Link>
  );

  if (load.kind === 'failed')
    return (
      <section className="desk-block gs-numbers" aria-labelledby="gs-numbers">
        <Head title={title}>{openList}</Head>
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestNumbers.failed')}
        </p>
        <TextAction
          label={t('guestNumbers.retry')}
          onClick={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </section>
    );

  if (load.kind === 'loaded' && load.counts.invited === 0)
    return (
      <section className="desk-block gs-numbers" aria-labelledby="gs-numbers">
        <Head title={title} />
        <p className="gs-none-yet">{t('guestNumbers.noneInvited')}</p>
        {openList}
      </section>
    );

  const counts = load.kind === 'loaded' ? load.counts : null;

  return (
    <section
      className="desk-block gs-numbers"
      aria-labelledby="gs-numbers"
      aria-busy={counts == null || undefined}
    >
      <Head title={title}>{openList}</Head>
      {counts != null && (
        <p className="desk-line is-small">
          {t('guestNumbers.lead', {
            coming: t('guestList.countComing', { count: counts.accepted }),
            invited: t('guestList.countInvited', { count: counts.invited }),
          })}
        </p>
      )}
      <ul className="desk-rows gs-counts">
        {ROWS.map(({ key, count }) => {
          const word = key === 'invited' ? t('guestNumbers.invited') : t(REPLY_KEY[key]);
          const lead =
            key === 'invited' ? (
              <span className="gs-lead is-icon" aria-hidden="true">
                <Glyph name="users" size={20} weight={2} />
              </span>
            ) : (
              <MarkLead reply={key} />
            );
          const words = (
            <RowWords title={word} lines={key === 'held' ? [t('guestNumbers.heldLine')] : []} />
          );

          return (
            <li key={key}>
              {counts == null ? (
                <div className="desk-row gs-count">
                  {lead}
                  {words}
                  <span className="desk-sunk gs-bone-figure" aria-hidden="true" />
                </div>
              ) : (
                <Link
                  className="desk-row gs-count"
                  to={`${guests}?filter=${key}`}
                  aria-label={
                    key === 'invited'
                      ? t('guestNumbers.opensInvited', { count: count(counts) })
                      : t('guestNumbers.opens', { figure: figure.format(count(counts)), word })
                  }
                >
                  {lead}
                  {words}
                  <span className="gs-figure">{figure.format(count(counts))}</span>
                  <Chevron />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {counts != null && counts.notYetInvited > 0 && (
        <Link
          className="desk-text gs-not-yet"
          to={`${guests}?filter=notYetInvited`}
          aria-label={t('guestNumbers.notYetName', { count: counts.notYetInvited })}
        >
          <ReplyMark reply="notYetInvited" cover />
          {t('guestNumbers.notYet', { count: counts.notYetInvited })}
          <Glyph name="chevron" size={15} weight={2.4} />
        </Link>
      )}
    </section>
  );
}
