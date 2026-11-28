import {
  ApiError,
  type MyNight,
  type OrganisationEvent,
  STAFF_RULES_MAXIMUM,
  type StaffBriefing,
  type StaffEntry,
} from '@soirely/api-client';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { type CopyOutcome, copyIssued, plainItem } from '../../../copyIssued.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { NightLead, NightShift } from '../../public/MyNight.tsx';
import { headingOf, weekdayOf } from '../../public/myNight.ts';
import { StationSelect } from './StationsArea.tsx';
import { NoticeLines, ReminderCard } from './Notices.tsx';
import { countLine, fitRules, noteOf, tallyOf } from './briefing.ts';
import { type NoticeClock, noticeClock, noticeLines } from '@soirely/domain';
import { type StaffTimes, clockWords, rangeWords } from './staffTimes.ts';
import '../../public/myNight.css';
import './briefing.css';

const BRIEFINGS: readonly StaffBriefing[] = ['read', 'sent', 'changed', 'none'];

const TALLY_KEYS: Record<StaffBriefing, string> = {
  read: 'briefing.read',
  sent: 'briefing.sent',
  changed: 'briefing.changed',
  none: 'briefing.none',
};

type Side =
  { kind: 'copy' } | { kind: 'rules'; editing: boolean } | { kind: 'preview'; id: string };

function isConcluded(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'event_concluded';
}

/** The briefing's parts on the Roster (sc-3917): the card above it, the Briefing column, the held link under a row, and its panel. */

export interface BriefingParts {
  side: boolean;
  card: ReactNode;
  cell: (one: StaffEntry) => ReactNode;
  held: (one: StaffEntry, span: number) => ReactNode;
  panel: ReactNode;
  /** Closes the briefing's panel when the Roster opens one of its own. */
  dismiss: () => void;
}

/** The briefing on the Roster's own rows: a briefing copy turns the Link column to Copied, and a Link-column copy leaves Briefing alone. Sending waits for epic 36, so Copy link is the way. */
export function useBriefing({
  event,
  people,
  rules,
  times,
  manage,
  finished,
  onEntry,
  onRules,
  reload,
  focus,
  announce,
  onSide,
}: {
  event: OrganisationEvent;
  people: readonly StaffEntry[];
  rules: string | null;
  times: StaffTimes;
  manage: boolean;
  finished: boolean;
  onEntry: (entry: StaffEntry) => void;
  onRules: (rules: string | null) => void;
  /** Reads the event and the roster again, after a refusal that says the page is stale. */
  reload: () => void;
  /** Where focus goes after the next render. */
  focus: (id: string) => void;
  announce: (text: string) => void;
  onSide: () => void;
}): BriefingParts {
  const { t } = useTranslation();
  const [side, setSide] = useState<Side | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [cut, setCut] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [handHeld, setHandHeld] = useState<{ id: string; url: string } | null>(null);

  const acts = manage && !finished;
  const here = (id: string) => people.find((one) => one.id === id) ?? null;
  const tally = tallyOf(people);

  function open(next: Side) {
    onSide();
    setSide(next);
    setSaved(false);
    setCut(false);
    setWrong(null);
    focus('sn-panel-title');
  }

  function dismiss() {
    setSide(null);
    setDraft(null);
    setCut(false);
  }

  function close(back: string) {
    dismiss();
    focus(back);
  }

  function alreadyOver() {
    setOver(true);
    announce(t('notices.alreadyOver'));
    reload();
    focus('sv-over');
  }

  async function copy(entry: StaffEntry) {
    if (busy != null) return;
    setBusy(entry.id);
    setMissed(null);
    if (handHeld?.id === entry.id) setHandHeld(null);
    let answered: StaffEntry | null = null;
    let concluded = false;
    const issue = () =>
      api.copyBriefingLink(event.id, entry.id).then(
        (answer) => {
          answered = answer.staff;
          return answer.url;
        },
        (error: unknown) => {
          concluded = isConcluded(error);
          throw error;
        },
      );
    const outcome: CopyOutcome = await copyIssued(
      issue,
      navigator.clipboard ?? null,
      typeof ClipboardItem === 'undefined' ? null : plainItem,
    );
    setBusy(null);
    if (concluded) {
      alreadyOver();
      return;
    }
    if (outcome.kind === 'notIssued' || answered == null) {
      setMissed(entry.id);
      announce(t('roster.linkNotIssued'));
      return;
    }
    onEntry(answered);
    if (outcome.kind === 'copied') {
      announce(t('roster.linkCopiedSaid'));
      return;
    }
    setHandHeld({ id: entry.id, url: outcome.url });
    announce(t('roster.linkRefused'));
    focus(`bf-held-${entry.id}`);
  }

  async function mark(entry: StaffEntry) {
    setMissed(null);
    try {
      onEntry(await api.markBriefingSent(event.id, entry.id));
      if (handHeld?.id === entry.id) setHandHeld(null);
      announce(t('roster.markedSent', { name: entry.fullName }));
      focus(side?.kind === 'copy' ? `bf-copy-${entry.id}` : `bf-row-copy-${entry.id}`);
    } catch (error) {
      if (isConcluded(error)) {
        alreadyOver();
        return;
      }
      setMissed(entry.id);
      announce(t('roster.linkNotIssued'));
    }
  }

  function rulesTyped(next: string) {
    const fitted = fitRules(draft ?? '', next);
    setDraft(fitted.text);
    if (fitted.cut) {
      setCut(true);
      announce(t('briefing.cut', { max: STAFF_RULES_MAXIMUM }));
    } else if (cut) setCut(false);
  }

  async function saveRules() {
    if (saving) return;
    setSaving(true);
    setWrong(null);
    try {
      onRules(await api.saveHouseRules(event.id, draft ?? ''));
      setDraft(null);
      setCut(false);
      setSaved(true);
      setSide({ kind: 'rules', editing: false });
      announce(t('briefing.saved'));
      focus('sn-panel-title');
    } catch (error) {
      const field =
        error instanceof ApiError && error.code === 'validation_failed'
          ? error.fieldErrors().rules
          : undefined;
      setWrong(field ?? t('briefing.notSaved'));
      focus('bf-rules-box');
    } finally {
      setSaving(false);
    }
  }

  const backFrom = (now: Side) =>
    now.kind === 'copy' ? 'bf-copy' : now.kind === 'preview' ? 'bf-preview' : 'bf-rules';
  const firstOnShift = people.find((one) => one.shifts.length > 0) ?? people[0];

  const clock = noticeClock(event, dateLocale());

  const card = (
    <>
      <section className="sn-card bf-card" aria-labelledby="bf-title">
        <div className="sn-card-top">
          <div className="sn-card-names">
            <h2 id="bf-title">{t('briefing.card')}</h2>
            <p className="mn-sub">{t('briefing.cardSub')}</p>
          </div>
        </div>
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {t('briefing.lock')}
          </p>
        )}
        <ul className="bf-tally" aria-label={t('briefing.tally')}>
          {BRIEFINGS.map((briefing) => (
            <li key={briefing}>
              <BriefWord briefing={briefing} />
              <span className="bf-tally-n">{tally[briefing]}</span>
            </li>
          ))}
        </ul>
        {acts && (
          <div className="bf-acts">
            <button
              id="bf-copy"
              type="button"
              className="gs-pill is-secondary"
              aria-expanded={side?.kind === 'copy'}
              onClick={() => open({ kind: 'copy' })}
            >
              {t('roster.copyLink')}
            </button>
          </div>
        )}
        <div className="bf-more">
          <button
            id="bf-rules"
            type="button"
            className="desk-text"
            aria-expanded={side?.kind === 'rules'}
            onClick={() => open({ kind: 'rules', editing: false })}
          >
            <Glyph name="pen" size={16} weight={2.3} />
            {acts ? t('briefing.editRules') : t('briefing.rules')}
          </button>
          {firstOnShift != null && (
            <button
              id="bf-preview"
              type="button"
              className="desk-text"
              aria-expanded={side?.kind === 'preview'}
              onClick={() => open({ kind: 'preview', id: firstOnShift.id })}
            >
              <Glyph name="eye" size={16} weight={2.3} />
              {t('briefing.previewAs')}
            </button>
          )}
        </div>
      </section>
      {over && (
        <p id="sv-over" className="sv-over" role="status" tabIndex={-1}>
          <Glyph name="info" size={18} weight={2.2} />
          {t('notices.alreadyOver')}
        </p>
      )}
      <ReminderCard
        event={event}
        manage={acts}
        roster={people}
        onOver={() => {
          setOver(true);
          reload();
        }}
        announce={announce}
      />
    </>
  );

  const previewed = side?.kind === 'preview' ? here(side.id) : null;
  const panel =
    side == null ? null : (
      <aside className="mn-panel bf-panel" aria-labelledby="sn-panel-title">
        <button type="button" className="desk-text bf-back" onClick={() => close(backFrom(side))}>
          <Glyph name="back" size={16} weight={2.4} />
          {t('roster.title')}
        </button>
        {side.kind === 'copy' && (
          <CopyPanel
            eventId={event.id}
            people={people}
            times={times}
            acts={acts}
            busy={busy}
            missed={missed}
            handHeld={handHeld}
            onCopy={(one) => void copy(one)}
            onMark={(one) => void mark(one)}
            onClose={() => close('bf-copy')}
          />
        )}
        {side.kind === 'rules' && (
          <RulesPanel
            rules={rules ?? ''}
            draft={side.editing ? (draft ?? rules ?? '') : null}
            manage={acts}
            cut={cut}
            saved={saved}
            saving={saving}
            wrong={wrong}
            onEdit={() => {
              setDraft(rules ?? '');
              setSaved(false);
              setWrong(null);
              setSide({ kind: 'rules', editing: true });
              focus('bf-rules-box');
            }}
            onType={rulesTyped}
            onSave={() => void saveRules()}
            onCancel={() => {
              setDraft(null);
              setCut(false);
              setWrong(null);
              setSide({ kind: 'rules', editing: false });
              focus('sn-panel-title');
            }}
            onClose={() => close('bf-rules')}
          />
        )}
        {previewed != null && (
          <PreviewPanel
            eventId={event.id}
            people={people}
            one={previewed}
            onPick={(id) => setSide({ kind: 'preview', id })}
            onClose={() => close('bf-preview')}
          />
        )}
      </aside>
    );

  return {
    side: side != null,
    card,
    cell: (one) => (
      <BriefCell
        one={one}
        times={times}
        clock={clock}
        finished={finished}
        acts={acts}
        busy={busy === one.id}
        missed={missed === one.id}
        onCopy={() => void copy(one)}
        onMark={() => void mark(one)}
      />
    ),
    held: (one, span) =>
      handHeld?.id === one.id && side?.kind !== 'copy' ? (
        <tr className="rs-held-row">
          <td colSpan={span}>
            <HandHeld one={one} url={handHeld.url} />
          </td>
        </tr>
      ) : null,
    panel,
    dismiss,
  };
}

function BriefWord({ briefing }: { briefing: StaffBriefing }) {
  const { t } = useTranslation();

  return (
    <span className="rs-link">
      <span className={`bf-mark is-${briefing}`} aria-hidden="true">
        {(briefing === 'read' || briefing === 'sent') && (
          <Glyph name="tick" size={10} weight={3.4} />
        )}
      </span>
      {t(TALLY_KEYS[briefing])}
    </span>
  );
}

function BriefCell({
  one,
  times,
  clock,
  finished,
  acts,
  busy,
  missed,
  onCopy,
  onMark,
}: {
  one: StaffEntry;
  times: StaffTimes;
  clock: NoticeClock;
  finished: boolean;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  onCopy: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation();
  const lines = noticeLines(one, finished, clock, t);
  const note = lines.length > 0 ? null : noteOf(one, t);
  const changed = one.briefing === 'changed';
  const changedActs = acts && changed && one.mobile != null && !one.contactsErased;

  return (
    <span className="rs-link-cell">
      <BriefWord briefing={one.briefing} />
      {note != null && <span className="rs-trail">{note}</span>}
      <NoticeLines lines={lines} />
      {changed && <CopiedLine one={one} times={times} />}
      {missed && changed && <Missed />}
      {changedActs && (
        <span className="rs-link-acts">
          <CopyButton id={`bf-row-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefingCopy != null && !one.briefingCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </span>
  );
}

function Missed() {
  const { t } = useTranslation();

  return (
    <span className="rs-missed">
      <Glyph name="alert" size={15} weight={2.2} />
      {t('roster.linkNotIssued')}
    </span>
  );
}

function CopiedLine({ one, times }: { one: StaffEntry; times: StaffTimes }) {
  const { t } = useTranslation();
  const copy = one.briefingCopy;
  if (copy == null) return null;
  const words = { name: copy.by ?? '', time: clockWords(copy.at, times) };

  return (
    <span className="rs-trail bf-copied">
      <span className={copy.marked ? 'rs-mark' : 'rs-mark is-copied'} aria-hidden="true" />
      {copy.marked ? t('roster.trailSent', words) : t('roster.trailCopied', words)}
    </span>
  );
}

function CopyButton({
  id,
  one,
  busy,
  onCopy,
}: {
  id: string;
  one: StaffEntry;
  busy: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      id={id}
      type="button"
      className={busy ? 'desk-text is-busy' : 'desk-text'}
      aria-label={t('briefing.copyFor', { name: one.fullName })}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={onCopy}
    >
      {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
      {t('roster.copyLink')}
    </button>
  );
}

function MarkButton({ one, onMark }: { one: StaffEntry; onMark: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="desk-text"
      aria-label={t('briefing.markFor', { name: one.fullName })}
      onClick={onMark}
    >
      {t('roster.markSent')}
    </button>
  );
}

/** A link the browser would not copy, selected in a read-only field to copy by hand; "Link" where the row cannot hold the name. */
function HandHeld({ one, url, short = false }: { one: StaffEntry; url: string; short?: boolean }) {
  const { t } = useTranslation();
  const id = `bf-held-${one.id}`;

  return (
    <span className="rs-held">
      <span className="rs-held-says">
        <Glyph name="alert" size={16} weight={2.2} />
        {t('roster.linkRefused')}
      </span>
      <label htmlFor={id} className="rs-held-label">
        {short ? t('briefing.link') : t('roster.linkFor', { name: one.fullName })}
      </label>
      <input
        id={id}
        aria-label={t('roster.linkFor', { name: one.fullName })}
        className="rs-held-field"
        type="text"
        readOnly
        value={url}
        onFocus={(focused) => focused.currentTarget.select()}
      />
    </span>
  );
}

function CopyRow({
  one,
  times,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
}: {
  one: StaffEntry;
  times: StaffTimes;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  handHeld: string | null;
  onCopy: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation();
  const note = noteOf(one, t);
  const [shift] = one.shifts;
  const offered = acts && one.mobile != null && !one.contactsErased;

  return (
    <li className="bf-copy-row">
      <div className="bf-copy-who">
        <p className="bf-copy-name">{one.fullName}</p>
        <p className="bf-copy-shift">
          {[
            one.job?.name,
            shift == null ? null : rangeWords(shift.startsAt, shift.endsAt, times, t),
            one.station?.name,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <span className="bf-copy-state">
          <BriefWord briefing={one.briefing} />
          {note != null && <span className="rs-trail">{note}</span>}
        </span>
        <CopiedLine one={one} times={times} />
        {missed && <Missed />}
        {handHeld != null && <HandHeld one={one} url={handHeld} short />}
      </div>
      {offered && (
        <span className="bf-copy-acts">
          <CopyButton id={`bf-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefingCopy != null && !one.briefingCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </li>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        <p className="mn-eyebrow">{t('briefing.card')}</p>
        <h2 id="sn-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button
        type="button"
        className="ev-round mn-close"
        aria-label={t('roster.close')}
        onClick={onClose}
      >
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function CopyPanel({
  eventId,
  people,
  times,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  onClose,
}: {
  eventId: string;
  people: readonly StaffEntry[];
  times: StaffTimes;
  acts: boolean;
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  onCopy: (one: StaffEntry) => void;
  onMark: (one: StaffEntry) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const listed = people.filter((one) => one.shifts.length > 0);

  return (
    <>
      <PanelHead title={t('briefing.copyTitle')} onClose={onClose} />
      <div className="mn-panel-body">
        {listed.length === 0 ? (
          <div className="rs-empty">
            <Glyph name="staff" size={28} weight={2} />
            <p className="rs-empty-title">{t('briefing.nobody')}</p>
            <Link
              className="gs-pill is-secondary"
              to={`/app/events/${encodeURIComponent(eventId)}/staff/jobs`}
            >
              {t('briefing.giveShift')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mn-sub">{t('briefing.copySub')}</p>
            <ul className="bf-copy-list">
              {listed.map((one) => (
                <CopyRow
                  key={one.id}
                  one={one}
                  times={times}
                  acts={acts}
                  busy={busy === one.id}
                  missed={missed === one.id}
                  handHeld={handHeld?.id === one.id ? handHeld.url : null}
                  onCopy={() => onCopy(one)}
                  onMark={() => onMark(one)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function RulesPanel({
  rules,
  draft,
  manage,
  cut,
  saved,
  saving,
  wrong,
  onEdit,
  onType,
  onSave,
  onCancel,
  onClose,
}: {
  rules: string;
  draft: string | null;
  manage: boolean;
  cut: boolean;
  saved: boolean;
  saving: boolean;
  wrong: string | null;
  onEdit: () => void;
  onType: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const count = draft == null ? null : countLine(draft, t);
  const described = [
    'bf-rules-where',
    count != null && 'bf-rules-count',
    cut && 'bf-rules-cut',
    wrong != null && 'bf-rules-wrong',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <PanelHead title={t('briefing.rules')} onClose={onClose} />
      <div className="mn-panel-body">
        {saved && (
          <p className="bf-saved">
            <Glyph name="tick" size={16} weight={2.6} />
            {t('briefing.saved')}
          </p>
        )}
        {draft == null ? (
          <>
            {rules === '' ? (
              <div className="bf-rules-empty">
                <p className="rs-empty-title">{t('briefing.rulesNone')}</p>
                <p className="mn-sub">{t('briefing.rulesWhere')}</p>
              </div>
            ) : (
              <>
                <p className="mn-sub">{t('briefing.rulesWhere')}</p>
                <p className="bf-rules">{rules}</p>
              </>
            )}
            {manage && (
              <button type="button" className="gs-pill is-secondary" onClick={onEdit}>
                {t('briefing.editRules')}
              </button>
            )}
          </>
        ) : (
          <div className="bf-rules-edit">
            <label htmlFor="bf-rules-box" className="gs-label">
              {t('briefing.rules')}
            </label>
            <p className="mn-sub" id="bf-rules-where">
              {t('briefing.rulesWhere')}
            </p>
            <textarea
              id="bf-rules-box"
              className="desk-box bf-rules-box"
              rows={10}
              value={draft}
              aria-invalid={wrong != null || undefined}
              aria-describedby={described}
              onChange={(typed) => onType(typed.currentTarget.value)}
            />
            {count != null && (
              <p id="bf-rules-count" className={count.limit ? 'bf-count is-limit' : 'bf-count'}>
                {count.limit && <Glyph name="warn" size={15} weight={2.4} />}
                {count.words}
              </p>
            )}
            {cut && (
              <p id="bf-rules-cut" className="bf-count is-limit">
                <Glyph name="warn" size={15} weight={2.4} />
                {t('briefing.cut', { max: STAFF_RULES_MAXIMUM })}
              </p>
            )}
            {wrong != null && (
              <p id="bf-rules-wrong" className="rs-missed" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {wrong}
              </p>
            )}
          </div>
        )}
      </div>
      {draft != null && (
        <div className="mn-panel-foot">
          <div className="mn-panel-acts">
            <button type="button" className="desk-text" onClick={onCancel}>
              {t('briefing.cancel')}
            </button>
            <button
              type="button"
              className={saving ? 'gs-pill is-primary is-busy' : 'gs-pill is-primary'}
              aria-disabled={saving || undefined}
              aria-busy={saving || undefined}
              onClick={onSave}
            >
              {saving && <span className="pending-spinner desk-turning" aria-hidden="true" />}
              {t('briefing.save')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

type Preview = { kind: 'loading' } | { kind: 'failed' } | { kind: 'shown'; night: MyNight };

function PreviewPanel({
  eventId,
  people,
  one,
  onPick,
  onClose,
}: {
  eventId: string;
  people: readonly StaffEntry[];
  one: StaffEntry;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [answered, setAnswered] = useState<{ key: string; preview: Preview } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${one.id}:${attempt}`;
  const preview: Preview = answered?.key === key ? answered.preview : { kind: 'loading' };

  useEffect(() => {
    let current = true;
    api.previewStaffNight(eventId, one.id).then(
      (night) => current && setAnswered({ key, preview: { kind: 'shown', night } }),
      () => current && setAnswered({ key, preview: { kind: 'failed' } }),
    );

    return () => {
      current = false;
    };
  }, [eventId, one.id, key]);

  return (
    <>
      <PanelHead title={t('briefing.previewAs')} onClose={onClose} />
      <div className="mn-panel-body">
        <label htmlFor="bf-preview-who" className="gs-label">
          {t('briefing.previewWho')}
        </label>
        <StationSelect
          id="bf-preview-who"
          value={one.id}
          shown={one.fullName}
          options={people.map((person) => ({ value: person.id, label: person.fullName }))}
          onChange={onPick}
        />
        <p className="bf-banner">
          <Glyph name="eye" size={16} weight={2.3} />
          {t('briefing.previewBanner')}
        </p>
        {preview.kind === 'loading' && (
          <Skeleton words={t('briefing.previewLoading')} shape="line" />
        )}
        {preview.kind === 'failed' && (
          <p className="rs-missed" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('roster.linkNotIssued')}{' '}
            <button type="button" className="desk-text" onClick={() => setAttempt((n) => n + 1)}>
              {t('roster.tryAgain')}
            </button>
          </p>
        )}
        {preview.kind === 'shown' && <PreviewPage one={one} night={preview.night} />}
      </div>
    </>
  );
}

function PreviewPage({ one, night }: { one: StaffEntry; night: MyNight }) {
  const { t } = useTranslation();

  return (
    <div
      className="bf-phone"
      role="group"
      aria-label={t('briefing.previewPage', { name: one.fullName })}
    >
      <p className="myn-event">{night.event.name}</p>
      {night.shift == null ? (
        <section className="myn-card">
          <p className="myn-big">
            {t('briefing.previewNoShift', { day: weekdayOf(night.doorsAt, dateLocale()) })}
          </p>
        </section>
      ) : (
        <>
          <p className="bf-phone-on">
            <span className="myn-on-label">{t('staffLink.night.onTonight')}</span>{' '}
            <span className="myn-on-station">{headingOf(night)}</span>
          </p>
          <NightShift night={night} shift={night.shift} />
          <NightLead lead={night.lead && { ...night.lead, phone: null }} />
        </>
      )}
      {night.rules != null && (
        <section className="myn-card">
          <p className="bf-phone-h">{t('staffLink.night.beforeYouStart')}</p>
          <p className="myn-rules">{night.rules}</p>
        </section>
      )}
    </div>
  );
}
