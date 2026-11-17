import { ApiError, type SeatingPlan } from '@soirely/api-client';
import { wallDay } from '@soirely/domain';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, Mark, TextAction } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { useServerNow } from '../../../serverNow.ts';
import { type PlanApi } from './SeatingParts.tsx';
import { shareDay, sharedCounts, shareByRefusal } from './seatingShare.ts';
import '../../../components/eventPage.css';
import './seatingShare.css';

type Asking = 'share' | 'stop' | null;

/** sc-4022: Share tables with guests, at the top of the panel under the room line. A switch: nothing is sent, and the plan stays editable. */
export function ShareTables({ ctx, plan }: { ctx: PlanApi; plan: SeatingPlan }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<Asking>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const { sharedAt } = plan.sharing;
  const { seated, unseated } = sharedCounts(plan);
  const { readOnly } = ctx;

  async function send(shared: boolean): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      ctx.adopt(await api.changeTableSharing(ctx.event.id, { shared }));
      setAsking(null);
      setStopped(!shared);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={asking == null ? 'st-block st-share' : 'st-block st-share is-asking'}
      aria-labelledby="st-share-h"
    >
      <div className="st-head">
        <h2 id="st-share-h">{t('seating.share.title')}</h2>
      </div>
      {sharedAt == null ? (
        <>
          {stopped && (
            <p className="st-share-said" role="status">
              {t('seating.share.stopped')}
            </p>
          )}
          {readOnly && <p className="st-line is-ink">{t('seating.share.notSharedText')}</p>}
          <p className="st-line">{t('seating.share.line')}</p>
          {unseated > 0 && (
            <p className="st-share-unseated">
              <Glyph name="warn" size={15} weight={2.2} />
              <span>{t('seating.share.unseated', { count: unseated })}</span>
            </p>
          )}
          <ShareBy ctx={ctx} plan={plan} onSaved={() => setStopped(false)} />
          {!readOnly && (
            <button
              type="button"
              className="button button-primary st-share-go"
              onClick={() => {
                setFailed(false);
                setAsking('share');
              }}
            >
              {t('seating.share.share')}
            </button>
          )}
        </>
      ) : (
        <Shared plan={plan} readOnly={readOnly} onStop={() => setAsking('stop')} />
      )}
      {readOnly && <p className="st-line">{t('seating.share.readOnly')}</p>}
      {asking === 'share' && (
        <Ask
          title={t('seating.share.askShare')}
          line={t('seating.share.askShareLine', { count: seated })}
          keep={t('seating.share.notYet')}
          go={t('seating.share.shareGo')}
          red={false}
          busy={busy ? t('seating.share.shareGo') : undefined}
          failed={failed ? t('seating.share.shareFailed') : undefined}
          onKeep={() => {
            setAsking(null);
            setFailed(false);
          }}
          onGo={() => void send(true)}
        >
          {unseated > 0 && <p>{t('seating.share.askShareUnseated', { count: unseated })}</p>}
        </Ask>
      )}
      {asking === 'stop' && (
        <Ask
          title={t('seating.share.askStop')}
          line={t('seating.share.askStopLine')}
          keep={t('seating.share.keepSharing')}
          go={t('seating.share.stopGo')}
          red={false}
          busy={busy ? t('seating.share.stopGo') : undefined}
          failed={failed ? t('seating.notSaved') : undefined}
          onKeep={() => {
            setAsking(null);
            setFailed(false);
          }}
          onGo={() => void send(false)}
        />
      )}
    </section>
  );
}

function Shared({
  plan,
  readOnly,
  onStop,
}: {
  plan: SeatingPlan;
  readOnly: boolean;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const { sharedAt, shareBy } = plan.sharing;
  const day = sharedAt == null ? '' : shareDay(sharedAt.slice(0, 10), dateLocale());

  return (
    <>
      <p className="st-share-on">
        <Mark kind="yes" />
        <span>{t('seating.share.shared')}</span>
      </p>
      <p className="st-line">{t('seating.share.since', { day })}</p>
      {shareBy != null && <p className="st-line">{t('seating.share.scheduleShared', { day })}</p>}
      {!readOnly && (
        <button type="button" className="button st-share-stop" onClick={onStop}>
          {t('seating.share.stop')}
        </button>
      )}
    </>
  );
}

function ShareBy({ ctx, plan, onSaved }: { ctx: PlanApi; plan: SeatingPlan; onSaved: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const now = useServerNow();
  const { shareBy } = plan.sharing;
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const zone = ctx.event.timeZone;
  const today = wallDay(now, zone);
  const eventDay = wallDay(ctx.event.startsAt, zone);
  const passed = shareBy != null && shareBy < today;
  const open = !ctx.readOnly && (shareBy == null || editing);
  const locale = dateLocale();

  async function change(next: string | null): Promise<void> {
    try {
      ctx.adopt(await api.changeTableSharing(ctx.event.id, { shareBy: next }));
      setEditing(false);
      setRefusal(null);
      onSaved();
    } catch (error) {
      setRefusal(
        (error instanceof ApiError ? error.fieldErrors().shareBy : undefined) ??
          t('seating.notSaved'),
      );
      field.current?.focus();
    }
  }

  function save(): void {
    const refused = shareByRefusal(typed, today, eventDay);

    if (refused == null) {
      void change(typed);
      return;
    }
    setRefusal(
      refused === 'afterEvent'
        ? t('seating.share.refusedAfterEvent', { day: shareDay(eventDay, locale) })
        : refused === 'past'
          ? t('seating.share.refusedPast')
          : t('seating.share.refusedEmpty'),
    );
    field.current?.focus();
  }

  if (open)
    return (
      <div className="desk-field st-share-by">
        <label htmlFor={id} className="desk-label">
          {t('seating.share.shareBy')}
          <span className="ev-optional">{t('seating.share.optional')}</span>
        </label>
        <div className="st-share-by-row">
          <input
            ref={field}
            id={id}
            type="date"
            className={refusal == null ? 'ev-input' : 'ev-input is-wrong'}
            value={typed}
            min={today}
            aria-invalid={refusal != null}
            aria-describedby={refusal == null ? undefined : `${id}-error`}
            onChange={(event) => {
              setTyped(event.target.value);
              setRefusal(null);
            }}
          />
          <button type="button" className="button" onClick={save}>
            {t('seating.share.saveDate')}
          </button>
        </div>
        {refusal != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {refusal}
          </p>
        )}
      </div>
    );

  if (shareBy == null) return null;
  const day = shareDay(shareBy, locale);

  return (
    <div className="st-share-by">
      <p className="desk-label">{t('seating.share.shareBy')}</p>
      <div className="st-share-saved">
        <span className="st-share-day">{day}</span>
        {passed && (
          <span className="st-share-passed">
            <Glyph name="clock" size={14} weight={2.3} />
            {t('seating.share.passed')}
          </span>
        )}
        {!ctx.readOnly && (
          <span className="st-share-acts">
            <TextAction
              label={t('seating.share.change')}
              onClick={() => {
                setTyped(shareBy);
                setRefusal(null);
                setEditing(true);
              }}
            />
            <TextAction label={t('seating.share.remove')} onClick={() => void change(null)} />
          </span>
        )}
      </div>
      <p className="st-line">
        {passed
          ? t('seating.share.scheduleByPassed', { day })
          : t('seating.share.scheduleBy', { day })}
      </p>
    </div>
  );
}
