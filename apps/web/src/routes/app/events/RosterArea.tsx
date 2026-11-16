import {
  ApiError,
  type OrganisationEvent,
  STAFF_NAME_MAXIMUM,
  type StaffEntry,
  type StaffLink,
  asStaffRoster,
  realtimeTopic,
} from '@soirely/api-client';
import {
  callingCode,
  countryChoices,
  emailProblem,
  formatPhone,
  phoneFields,
  phoneLengthProblem,
} from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { codeChoice, phoneProblemMessage } from '../../../phoneProblem.ts';
import { canOn, useSession } from '../../../session.ts';
import { FieldWrong } from './GuestFields.tsx';
import { useHubTopics } from './useHubTopics.ts';
import { useStartingCountry } from './useStartingCountry.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './roster.css';

const FIELD_IDS = { name: 'rs-f-name', number: 'rs-f-number', email: 'rs-f-email' } as const;
const BAR_MS = 10_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; staff: StaffEntry[] };

type Panel =
  | { kind: 'details'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'remove'; id: string }
  | null;

interface Draft {
  name: string;
  country: string;
  number: string;
  email: string;
}

type Problems = { name?: string; number?: string; email?: string };

type Field = keyof Problems;

const LINK_KEYS: Record<StaffLink, string> = {
  none: 'roster.linkNone',
  no_mobile: 'roster.linkNoMobile',
  erased: 'roster.linkErased',
};

const LINK_MARKS: Record<StaffLink, string> = {
  none: 'is-none',
  no_mobile: 'is-no-mobile',
  erased: 'is-erased',
};

function draftOf(entry: StaffEntry | null, country: string): Draft {
  const fields = entry?.mobile == null ? null : phoneFields(entry.mobile);

  return {
    name: entry?.fullName ?? '',
    country: fields?.country ?? country,
    number: fields?.number ?? '',
    email: entry?.email ?? '',
  };
}

function firstWrong(problems: Problems): Field | null {
  return (['name', 'number', 'email'] as const).find((one) => problems[one] != null) ?? null;
}

/** /app/events/:id/staff (sc-3906): the Roster on the event's Staff page, as its demo draws it at a desk. */
export function RosterArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  usePageTitle(pageTitle(t, [t('roster.title'), event.name]));

  useEffect(() => {
    let current = true;

    api.staff(event.id).then(
      (staff) => current && setLoad({ kind: 'loaded', staff }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  const topics = useMemo(() => [realtimeTopic('EventStaff', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.staffSubscription(event.id),
    (data) => {
      const staff = asStaffRoster(data);
      if (staff == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', staff });
    },
    () => setAttempt((n) => n + 1),
  );

  return (
    <div className="desk ev desk-page ev-page gs mn sn rs">
      <div className="ev-wide mn-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={t('roster.crumb')}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/app/events">{t('roster.events')}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{t('roster.title')}</span>
              </li>
            </ol>
          </nav>
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{t('roster.title')}</h1>
            <p className="mn-sub">{t('roster.sub')}</p>
          </div>
        </header>
        {load.kind === 'loading' && (
          <Skeleton words={t('roster.loading')} shape="rows" rowHeight={56} />
        )}
        {load.kind === 'failed' && (
          <div className="sn-card" role="alert">
            <p className="mn-failed">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('roster.failed')}
            </p>
            <div>
              <button
                type="button"
                className="gs-pill is-secondary"
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              >
                {t('roster.tryAgain')}
              </button>
            </div>
          </div>
        )}
        {load.kind === 'loaded' && (
          <Roster
            event={event}
            staff={load.staff}
            onStaff={(staff) => setLoad({ kind: 'loaded', staff })}
            reload={() => setAttempt((n) => n + 1)}
          />
        )}
      </div>
    </div>
  );
}

function Roster({
  event,
  staff,
  onStaff,
  reload,
}: {
  event: OrganisationEvent;
  staff: StaffEntry[];
  onStaff: (staff: StaffEntry[]) => void;
  reload: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const manage = canOn(event, 'staff.manage');
  const finished = event.phase === 'finished';
  const country = useStartingCountry(manage);
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(null, country));
  const [problems, setProblems] = useState<Problems>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bar, setBar] = useState<string[] | null>(null);
  const [live, setLive] = useState({ text: '', said: 0 });
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (bar == null) return;
    const timer = window.setTimeout(() => setBar(null), BAR_MS);

    return () => window.clearTimeout(timer);
  }, [bar]);

  const shown = (id: string) => staff.find((one) => one.id === id) ?? null;
  const opened = panel != null && panel.kind !== 'add' ? shown(panel.id) : null;

  const editing = panel?.kind === 'edit' ? opened : null;
  const contact = editing == null || !editing.contactsErased;
  const lit = opened?.id ?? null;

  function say(lines: string[]) {
    setBar(lines);
    setLive((was) => ({ text: lines.join(' '), said: was.said + 1 }));
  }

  function open(next: Panel) {
    setProblems({});
    setWarning(null);
    setFailed(null);
    if (next?.kind === 'add') setDraft(draftOf(null, country));
    if (next?.kind === 'edit') setDraft(draftOf(shown(next.id), country));
    setPanel(next);
    focusAfter.current = 'sn-panel-title';
  }

  function close() {
    const back = panel == null || panel.kind === 'add' ? 'rs-add' : `rs-name-${panel.id}`;
    setPanel(null);
    setWarning(null);
    setFailed(null);
    focusAfter.current = back;
  }

  function change(next: Partial<Draft>) {
    if (next.number != null || next.country != null) setWarning(null);
    setDraft({ ...draft, ...next });
  }

  function checked(): Problems {
    const found: Problems = {};
    if (draft.name.trim() === '') found.name = t('roster.blank');
    if (!contact) return found;

    const length = phoneLengthProblem(draft.number, draft.country);
    const number =
      length === 'tooShort' || length === 'tooLong'
        ? phoneProblemMessage(length, draft.country, t)
        : null;
    if (number != null) found.number = number;
    if (draft.email.trim() !== '' && emailProblem(draft.email) === 'shape')
      found.email = t('forms.emailShape');

    return found;
  }

  function refused(found: Problems) {
    setProblems(found);
    setWarning(null);
    const wrong = firstWrong(found);
    if (wrong != null) focusAfter.current = FIELD_IDS[wrong];
  }

  async function submit(anyway: boolean) {
    const found = checked();
    if (firstWrong(found) != null) {
      refused(found);
      return;
    }

    const name = draft.name.trim();
    const details = {
      fullName: name,
      ...(contact
        ? {
            mobile:
              draft.number.trim() === ''
                ? null
                : { countryCode: draft.country, number: draft.number },
            email: draft.email.trim() === '' ? null : draft.email.trim(),
          }
        : {}),
      allowShared: anyway,
    };

    setBusy(true);
    setProblems({});
    setFailed(null);
    try {
      const answer =
        editing == null
          ? await api.addStaff(event.id, details)
          : await api.editStaff(event.id, editing.id, details);
      setWarning(null);
      reload();
      if (editing == null) {
        const organisation = session.organisation?.name ?? '';
        setPanel(null);
        say(
          answer.member == null
            ? [t('roster.added', { name })]
            : [
                t('roster.added', { name }),
                t('roster.member', { name: answer.member, organisation }),
              ],
        );
        focusAfter.current = 'rs-add';
        onStaff([...staff.filter((one) => one.id !== answer.staff.id), answer.staff]);
      } else {
        onStaff(staff.map((one) => (one.id === answer.staff.id ? answer.staff : one)));
        setPanel({ kind: 'details', id: answer.staff.id });
        say([t('roster.saved')]);
        focusAfter.current = 'sn-panel-title';
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'staff_number_shared') {
        setWarning(error.problem.sharedWith ?? '');
        focusAfter.current = 'rs-warning';
      } else if (error instanceof ApiError && error.code === 'validation_failed') {
        const fields = error.fieldErrors();
        refused({
          ...(fields.fullName == null ? {} : { name: fields.fullName }),
          ...(fields.mobile == null ? {} : { number: fields.mobile }),
          ...(fields.email == null ? {} : { email: fields.email }),
        });
      } else {
        setWarning(null);
        setFailed(
          editing == null ? t('roster.notAdded', { name }) : t('roster.notSaved', { name }),
        );
        focusAfter.current = 'rs-failed';
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: StaffEntry) {
    setBusy(true);
    setFailed(null);
    try {
      await api.removeStaff(event.id, entry.id);
      onStaff(staff.filter((one) => one.id !== entry.id));
      setPanel(null);
      say([t('roster.removed', { name: entry.fullName })]);
      focusAfter.current = 'rs-roster';
      reload();
    } catch {
      setFailed(t('roster.notRemoved', { name: entry.fullName }));
      focusAfter.current = 'rs-failed';
    } finally {
      setBusy(false);
    }
  }

  const unsent = staff.some((one) => one.link === 'none');
  const next = finished ? t('roster.nextHours') : unsent ? t('roster.nextSend') : null;

  return (
    <>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {t('roster.lock')}
        </p>
      )}
      <p className="visually-hidden" role="status">
        <span key={live.said}>{live.text}</span>
      </p>
      <div className="mn-split">
        <div className="mn-list">
          <section className="sn-card" aria-labelledby="rs-roster">
            <div className="sn-card-top">
              <div className="sn-card-names">
                <h2 id="rs-roster" tabIndex={-1}>
                  {t('roster.roster')}
                </h2>
                {next != null && staff.length > 0 && <p className="mn-sub">{next}</p>}
              </div>
              {manage && staff.length > 0 && (
                <button
                  id="rs-add"
                  type="button"
                  className="desk-text"
                  onClick={() => open({ kind: 'add' })}
                >
                  <Glyph name="plus" size={17} weight={2.3} />
                  {t('roster.add')}
                </button>
              )}
            </div>
            {staff.length === 0 ? (
              <div className="rs-empty">
                <Glyph name="staff" size={28} weight={2} />
                <p className="rs-empty-title">{t('roster.empty')}</p>
                <p className="mn-sub">{t('roster.emptySub')}</p>
                {manage && (
                  <button
                    id="rs-add"
                    type="button"
                    className="gs-pill is-primary"
                    onClick={() => open({ kind: 'add' })}
                  >
                    {t('roster.add')}
                  </button>
                )}
              </div>
            ) : (
              <div className="rs-frame">
                <table className="rs-table" aria-labelledby="rs-roster">
                  <thead>
                    <tr>
                      <th scope="col">{t('roster.name')}</th>
                      <th scope="col">{t('roster.job')}</th>
                      <th scope="col">{t('roster.station')}</th>
                      <th scope="col">{t('roster.shift')}</th>
                      <th scope="col">{t('roster.link')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((one) => (
                      <tr key={one.id} className={lit === one.id ? 'is-lit' : undefined}>
                        <th scope="row">
                          <button
                            id={`rs-name-${one.id}`}
                            type="button"
                            className="rs-name"
                            aria-current={lit === one.id || undefined}
                            onClick={() => open({ kind: 'details', id: one.id })}
                          >
                            {one.fullName}
                          </button>
                        </th>
                        <td className={one.job == null ? 'rs-quiet' : undefined}>
                          {one.job ?? t('roster.noJob')}
                        </td>
                        <td className={one.station == null ? 'rs-quiet' : undefined}>
                          {one.station ?? t('roster.noStation')}
                        </td>
                        <td className={one.shift == null ? 'rs-quiet' : 'rs-shift'}>
                          {one.shift ?? t('roster.noShift')}
                        </td>
                        <td>
                          <LinkWord link={one.link} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        {panel != null &&
          (panel.kind === 'add' || opened != null) &&
          (manage || panel.kind === 'details') && (
            <aside className="mn-panel" aria-labelledby="sn-panel-title">
              {panel.kind === 'details' && opened != null && (
                <Details
                  entry={opened}
                  manage={manage}
                  finished={finished}
                  onClose={close}
                  onEdit={() => open({ kind: 'edit', id: opened.id })}
                  onRemove={() => open({ kind: 'remove', id: opened.id })}
                />
              )}
              {panel.kind === 'remove' && opened != null && (
                <RemoveAsk
                  entry={opened}
                  busy={busy}
                  failed={failed}
                  onKeep={() => {
                    setFailed(null);
                    setPanel({ kind: 'details', id: opened.id });
                    focusAfter.current = 'rs-remove';
                  }}
                  onRemove={() => void remove(opened)}
                />
              )}
              {(panel.kind === 'add' || (panel.kind === 'edit' && editing != null)) && (
                <PersonForm
                  title={
                    editing == null
                      ? t('roster.add')
                      : t('roster.editTitle', { name: editing.fullName })
                  }
                  draft={draft}
                  problems={problems}
                  contact={contact}
                  warning={warning}
                  failed={failed}
                  busy={busy}
                  editing={editing != null}
                  onChange={change}
                  onSubmit={() => void submit(false)}
                  onAnyway={() => void submit(true)}
                  onCancelWarning={() => {
                    setWarning(null);
                    focusAfter.current = FIELD_IDS.number;
                  }}
                  onCancel={() => {
                    if (editing == null) close();
                    else open({ kind: 'details', id: editing.id });
                  }}
                />
              )}
            </aside>
          )}
      </div>
      {bar != null && (
        <div className="rs-bar">
          <Glyph name="tick" size={18} weight={2.6} />
          <div className="rs-bar-lines">
            {bar.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button type="button" className="desk-text rs-bar-dismiss" onClick={() => setBar(null)}>
            {t('roster.dismiss')}
          </button>
        </div>
      )}
    </>
  );
}

function LinkWord({ link }: { link: StaffLink }) {
  const { t } = useTranslation();

  return (
    <span className="rs-link">
      <span className={`rs-mark ${LINK_MARKS[link]}`} aria-hidden="true" />
      {t(LINK_KEYS[link])}
    </span>
  );
}

function PanelTop({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
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

function Details({
  entry,
  manage,
  finished,
  onClose,
  onEdit,
  onRemove,
}: {
  entry: StaffEntry;
  manage: boolean;
  finished: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const next = entry.contactsErased ? null : finished ? t('roster.nextErasing') : null;

  return (
    <>
      <div className="mn-panel-top">
        <div className="mn-panel-names">
          <p className="mn-eyebrow">{t('roster.roster')}</p>
          <h2 id="sn-panel-title" tabIndex={-1}>
            {entry.fullName}
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
      <div className="mn-panel-body">
        <dl className="rs-facts">
          <div>
            <dt>{t('roster.shift')}</dt>
            <dd>{entry.shift ?? t('roster.noShift')}</dd>
          </div>
          <div>
            <dt>{t('roster.station')}</dt>
            <dd>{entry.station ?? t('roster.noStation')}</dd>
          </div>
          {entry.mobile != null && (
            <div>
              <dt>{t('roster.mobile')}</dt>
              <dd>{formatPhone(entry.mobile)}</dd>
            </div>
          )}
          {entry.email != null && (
            <div>
              <dt>{t('roster.email')}</dt>
              <dd>{entry.email}</dd>
            </div>
          )}
          <div>
            <dt>{t('roster.link')}</dt>
            <dd>
              <LinkWord link={entry.link} />
            </dd>
          </div>
        </dl>
        {next != null && <p className="rs-next">{next}</p>}
      </div>
      {manage && (
        <div className="mn-panel-foot">
          <div className="mn-panel-acts">
            {!finished && (
              <button
                id="rs-remove"
                type="button"
                className="desk-text rs-danger"
                onClick={onRemove}
              >
                {t('roster.remove')}
              </button>
            )}
            <button type="button" className="gs-pill is-secondary" onClick={onEdit}>
              {t('roster.edit')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function RemoveAsk({
  entry,
  busy,
  failed,
  onKeep,
  onRemove,
}: {
  entry: StaffEntry;
  busy: boolean;
  failed: string | null;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mn-panel-top">
        <div className="mn-panel-names">
          <h2 id="sn-panel-title" tabIndex={-1}>
            {t('roster.removeAsk', { name: entry.fullName })}
          </h2>
        </div>
      </div>
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        <p className="rs-ask-shift">{entry.shift ?? t('roster.noShift')}</p>
        <p className="mn-quiet">{t('roster.stopsWorking')}</p>
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <button type="button" className="desk-text" onClick={onKeep}>
            {t('roster.keep')}
          </button>
          <button
            type="button"
            className="gs-pill is-primary rs-remove-go"
            aria-busy={busy || undefined}
            onClick={() => !busy && onRemove()}
          >
            {t('roster.remove')}
          </button>
        </div>
      </div>
    </>
  );
}

function Failed({ words }: { words: string }) {
  return (
    <p id="rs-failed" className="mn-failed" role="alert" tabIndex={-1}>
      <Glyph name="alert" size={17} weight={2.2} />
      {words}
    </p>
  );
}

function PersonForm({
  title,
  draft,
  problems,
  contact,
  warning,
  failed,
  busy,
  editing,
  onChange,
  onSubmit,
  onAnyway,
  onCancelWarning,
  onCancel,
}: {
  title: string;
  draft: Draft;
  problems: Problems;
  contact: boolean;
  warning: string | null;
  failed: string | null;
  busy: boolean;
  editing: boolean;
  onChange: (next: Partial<Draft>) => void;
  onSubmit: () => void;
  onAnyway: () => void;
  onCancelWarning: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );
  const told = (id: string, error: string | undefined, help?: boolean) =>
    [error == null ? null : `${id}-error`, help === true ? `${id}-help` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <>
      <PanelTop title={title} onClose={onCancel} />
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        <div className="desk-field">
          <label htmlFor={FIELD_IDS.name} className="desk-label">
            {t('roster.name')}
          </label>
          <div className={problems.name == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              id={FIELD_IDS.name}
              type="text"
              value={draft.name}
              autoComplete="off"
              aria-invalid={problems.name != null}
              aria-describedby={told(FIELD_IDS.name, problems.name, true)}
              onChange={(change) => onChange({ name: change.target.value })}
            />
          </div>
          {problems.name != null && (
            <FieldWrong id={`${FIELD_IDS.name}-error`}>{problems.name}</FieldWrong>
          )}
          <p id={`${FIELD_IDS.name}-help`} className="desk-help">
            {t('roster.nameHelp', { max: STAFF_NAME_MAXIMUM })}
          </p>
        </div>
        {contact && (
          <div className="desk-field">
            <label htmlFor={FIELD_IDS.number} className="desk-label gs-label">
              {t('roster.mobile')}
              <span className="gs-optional">{t('roster.optional')}</span>
            </label>
            <div className="gs-phone">
              <div className="desk-box gs-country">
                <span aria-hidden="true">{`${draft.country} ${callingCode(draft.country) ?? ''}`}</span>
                <Glyph name="chevdown" size={15} weight={2.4} />
                <select
                  aria-label={t('roster.country')}
                  value={draft.country}
                  onChange={(change) => onChange({ country: change.target.value })}
                >
                  {countries.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {codeChoice(code, name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={problems.number == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id={FIELD_IDS.number}
                  type="tel"
                  value={draft.number}
                  autoComplete="off"
                  aria-invalid={problems.number != null}
                  aria-describedby={told(FIELD_IDS.number, problems.number, true)}
                  onChange={(change) => onChange({ number: change.target.value })}
                />
              </div>
            </div>
            {problems.number != null && (
              <FieldWrong id={`${FIELD_IDS.number}-error`}>{problems.number}</FieldWrong>
            )}
            {warning != null && (
              <div
                id="rs-warning"
                className="rs-warning"
                tabIndex={-1}
                role="group"
                aria-labelledby="rs-warning-words"
              >
                <p id="rs-warning-words">
                  <Glyph name="warn" size={17} weight={2.2} />
                  {t('roster.uses', { name: warning })}
                </p>
                <div className="rs-warning-acts">
                  <button type="button" className="desk-text" onClick={onCancelWarning}>
                    {t('roster.cancel')}
                  </button>
                  <button
                    type="button"
                    className="gs-pill is-primary"
                    aria-busy={busy || undefined}
                    onClick={() => !busy && onAnyway()}
                  >
                    {editing ? t('roster.saveAnyway') : t('roster.addAnyway')}
                  </button>
                </div>
              </div>
            )}
            <p id={`${FIELD_IDS.number}-help`} className="desk-help">
              {t('roster.mobileHelp')}
            </p>
          </div>
        )}
        {contact && (
          <div className="desk-field">
            <label htmlFor={FIELD_IDS.email} className="desk-label gs-label">
              {t('roster.email')}
              <span className="gs-optional">{t('roster.optional')}</span>
            </label>
            <div className={problems.email == null ? 'desk-box' : 'desk-box is-wrong'}>
              <input
                id={FIELD_IDS.email}
                type="email"
                value={draft.email}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={problems.email != null}
                aria-describedby={told(FIELD_IDS.email, problems.email)}
                onChange={(change) => onChange({ email: change.target.value })}
              />
            </div>
            {problems.email != null && (
              <FieldWrong id={`${FIELD_IDS.email}-error`}>{problems.email}</FieldWrong>
            )}
          </div>
        )}
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <button type="button" className="desk-text" onClick={onCancel}>
            {t('roster.cancel')}
          </button>
          <button
            type="button"
            className="gs-pill is-primary"
            aria-busy={busy || undefined}
            onClick={() => !busy && onSubmit()}
          >
            {editing ? t('roster.saveChanges') : t('roster.addCta')}
          </button>
        </div>
      </div>
    </>
  );
}
