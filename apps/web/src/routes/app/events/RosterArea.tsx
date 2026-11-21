import {
  ApiError,
  type OrganisationEvent,
  STAFF_NAME_MAXIMUM,
  type StaffEntry,
  type StaffLink,
  type StaffPlan,
  asStaffPlan,
  realtimeTopic,
} from '@soirely/api-client';
import {
  callingCode,
  countryChoices,
  emailProblem,
  firstName,
  formatPhone,
  phoneFields,
  phoneLengthProblem,
} from '@soirely/domain';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx';
import { type CopyOutcome, copyIssued, plainItem } from '../../../copyIssued.ts';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { codeChoice, phoneProblemMessage } from '../../../phoneProblem.ts';
import { canOn, useSession } from '../../../session.ts';
import { FieldWrong } from './GuestFields.tsx';
import { useHubTopics } from './useHubTopics.ts';
import { useStartingCountry } from './useStartingCountry.ts';
import { StaffTabs } from './StaffTabs.tsx';
import { StationSelect } from './StationsArea.tsx';
import { stationGroups } from './stationWords.ts';
import { type StaffTimes, clockWords, rangeWords, shiftBreaks, staffTimes } from './staffTimes.ts';
import { useDeskTop } from '../../../deskTop.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './roster.css';
import './jobsShifts.css';
import './stations.css';

const FIELD_IDS = {
  name: 'rs-f-name',
  number: 'rs-f-number',
  email: 'rs-f-email',
  job: 'rs-f-job',
} as const;
const BAR_MS = 10_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; plan: StaffPlan };

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
  job: string;
  shift: string;
}

type Problems = { name?: string; number?: string; email?: string; job?: string };

type Field = keyof Problems;

const LINK_KEYS: Record<StaffLink, string> = {
  none: 'roster.linkNone',
  copied: 'roster.linkCopied',
  sent: 'roster.linkSent',
  opened: 'roster.linkOpened',
  no_mobile: 'roster.linkNoMobile',
  erased: 'roster.linkErased',
};

const LINK_MARKS: Record<StaffLink, string> = {
  none: 'is-none',
  copied: 'is-copied',
  sent: 'is-sent',
  opened: 'is-opened',
  no_mobile: 'is-no-mobile',
  erased: 'is-erased',
};

/** Copied: given out, and not yet marked as sent. */
function unmarked(link: StaffLink): boolean {
  return link === 'copied';
}

function draftOf(entry: StaffEntry | null, country: string): Draft {
  const fields = entry?.mobile == null ? null : phoneFields(entry.mobile);

  return {
    name: entry?.fullName ?? '',
    country: fields?.country ?? country,
    number: fields?.number ?? '',
    email: entry?.email ?? '',
    job: entry?.job?.id ?? '',
    shift: '',
  };
}

function firstWrong(problems: Problems): Field | null {
  return (['name', 'number', 'email', 'job'] as const).find((one) => problems[one] != null) ?? null;
}

/** /app/events/:id/staff (sc-3906): the Roster on the event's Staff page, as its demo draws it at a desk. */
export function RosterArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();

  usePageTitle(pageTitle(t, [t('roster.title'), event.name]));

  useEffect(() => {
    let current = true;

    keptLoad(keptKeys.staff(event.id), api.staffPlan(event.id)).then(
      (plan) => current && setLoad({ kind: 'loaded', plan }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);
  useKeptAsShown(keptKeys.staff(event.id), load.kind === 'loaded' ? load.plan : null);

  const topics = useMemo(() => [realtimeTopic('EventStaff', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.staffSubscription(event.id),
    (data) => {
      const plan = asStaffPlan(data);
      if (plan == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', plan });
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
          {desk.bell}
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{t('roster.title')}</h1>
            <p className="mn-sub">{t('roster.sub')}</p>
          </div>
        </header>
        <StaffTabs on="roster" eventId={event.id} />
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
            plan={load.plan}
            onStaff={(staff) => setLoad({ kind: 'loaded', plan: { ...load.plan, staff } })}
            onPlan={(plan) => setLoad({ kind: 'loaded', plan })}
            reload={() => setAttempt((n) => n + 1)}
          />
        )}
      </div>
    </div>
  );
}

function Roster({
  event,
  plan,
  onStaff,
  onPlan,
  reload,
}: {
  event: OrganisationEvent;
  plan: StaffPlan;
  onStaff: (staff: StaffEntry[]) => void;
  onPlan: (plan: StaffPlan) => void;
  reload: () => void;
}) {
  const { t } = useTranslation();
  const { staff } = plan;
  const times = staffTimes(event, plan.shifts, dateLocale());
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
  const [copying, setCopying] = useState<string | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const [held, setHeld] = useState<{ id: string; url: string } | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
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
    announce(lines.join(' '));
  }

  function announce(text: string) {
    setLive((was) => ({ text, said: was.said + 1 }));
  }

  function relinked(entry: StaffEntry) {
    onStaff(staff.map((one) => (one.id === entry.id ? entry : one)));
  }

  async function copy(entry: StaffEntry) {
    if (copying != null) return;
    setCopying(entry.id);
    setMissed(null);
    if (held?.id === entry.id) setHeld(null);
    let answered: StaffEntry | null = null;
    const issue = () =>
      api.deliverStaffLink(event.id, entry.id).then((answer) => {
        answered = answer.staff;
        return answer.url;
      });
    const outcome: CopyOutcome = await copyIssued(
      issue,
      navigator.clipboard ?? null,
      typeof ClipboardItem === 'undefined' ? null : plainItem,
    );
    setCopying(null);
    if (outcome.kind === 'notIssued' || answered == null) {
      setMissed(entry.id);
      announce(t('roster.linkNotIssued'));
      return;
    }
    relinked(answered);
    if (outcome.kind === 'copied') {
      say([t('roster.linkCopiedSaid')]);
      return;
    }
    setHeld({ id: entry.id, url: outcome.url });
    announce(t('roster.linkRefused'));
    focusAfter.current = `rs-held-${entry.id}`;
  }

  async function markSent(entry: StaffEntry) {
    setFailed(null);
    try {
      relinked(await api.markStaffLinkSent(event.id, entry.id));
      if (held?.id === entry.id) setHeld(null);
      say([t('roster.markedSent', { name: entry.fullName })]);
      focusAfter.current = `rs-copy-${entry.id}`;
    } catch {
      setMissed(entry.id);
      announce(t('roster.linkNotIssued'));
    }
  }

  async function replaceLink(entry: StaffEntry) {
    setBusy(true);
    setFailed(null);
    try {
      relinked(await api.replaceStaffLink(event.id, entry.id));
      if (held?.id === entry.id) setHeld(null);
      if (missed === entry.id) setMissed(null);
      setReplacing(null);
      say([t('roster.linkReplaced', { name: entry.fullName })]);
      focusAfter.current = 'sn-panel-title';
    } catch {
      setReplacing(null);
      setFailed(t('roster.linkNotIssued'));
      focusAfter.current = 'rs-failed';
    } finally {
      setBusy(false);
    }
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
    const locked = jobLocked();
    if (locked != null) found.job = locked;
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

  function jobLocked(): string | null {
    if (editing == null || editing.shifts.length === 0) return null;
    if (draft.job === (editing.job?.id ?? '')) return null;

    return t('roster.onShifts', { name: editing.fullName });
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
      job: draft.job === '' ? null : draft.job,
      ...(editing == null && draft.shift !== '' ? { shift: draft.shift } : {}),
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
      if (error instanceof ApiError && error.code === 'staff_on_shifts') {
        refused({ job: error.problem.detail ?? t('roster.onShifts', { name }) });
      } else if (error instanceof ApiError && error.code === 'staff_number_shared') {
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

  async function restation(entry: StaffEntry, station: string) {
    setBusy(true);
    setFailed(null);
    try {
      const next = await api.putOnStation(event.id, entry.id, station === '' ? null : station);
      onPlan(next);
      const now = next.staff.find((one) => one.id === entry.id)?.station ?? null;
      say([
        now == null
          ? t('stations.saidOff', { name: entry.fullName })
          : t('stations.saidOn', { name: entry.fullName, station: now.name }),
      ]);
    } catch {
      setFailed(t('stations.notSaved'));
      focusAfter.current = 'rs-failed';
    } finally {
      setBusy(false);
    }
  }

  const unsent = staff.some((one) => one.link === 'none' || unmarked(one.link));
  const acts = manage && !finished;
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
          <section className="sn-card">
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
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
              <div className="rs-frame" tabIndex={0} role="region" aria-labelledby="rs-roster">
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
                      <Fragment key={one.id}>
                        <tr className={lit === one.id ? 'is-lit' : undefined}>
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
                            {one.job?.name ?? t('roster.noJob')}
                          </td>
                          <td className={one.station == null ? 'rs-quiet' : undefined}>
                            <StationWords entry={one} />
                          </td>
                          <td
                            className={
                              one.shifts.length === 0 ? 'rs-no-shift rs-quiet' : 'rs-shift'
                            }
                          >
                            <ShiftCell entry={one} times={times} />
                          </td>
                          <td>
                            <LinkCell
                              entry={one}
                              times={times}
                              acts={acts}
                              busy={copying === one.id}
                              missed={missed === one.id}
                              onCopy={() => void copy(one)}
                              onMark={() => void markSent(one)}
                            />
                          </td>
                        </tr>
                        {held?.id === one.id && (
                          <tr className="rs-held-row">
                            <td colSpan={5}>
                              <HeldLink entry={one} url={held.url} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
                  plan={plan}
                  times={times}
                  manage={manage}
                  finished={finished}
                  failed={failed}
                  onStation={(station) => void restation(opened, station)}
                  onClose={close}
                  onEdit={() => open({ kind: 'edit', id: opened.id })}
                  onRemove={() => open({ kind: 'remove', id: opened.id })}
                  onReplace={acts ? () => setReplacing(opened.id) : null}
                />
              )}
              {panel.kind === 'remove' && opened != null && (
                <RemoveAsk
                  entry={opened}
                  times={times}
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
                  plan={plan}
                  times={times}
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
      {replacing != null && shown(replacing) != null && (
        <ConfirmDialog
          id="rs-replace"
          title={t('roster.replaceTitle', { name: firstName(shown(replacing)?.fullName ?? '') })}
          keep={t('roster.keepLink')}
          go={t('roster.replace')}
          pending={busy}
          onKeep={() => {
            setReplacing(null);
            focusAfter.current = 'rs-replace-open';
          }}
          onGo={() => {
            const entry = shown(replacing);
            if (entry != null) void replaceLink(entry);
          }}
        >
          <p>{t('roster.replaceLine')}</p>
        </ConfirmDialog>
      )}
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

function shiftLines(entry: StaffEntry, times: StaffTimes, t: TFunction): string[] {
  return entry.shifts.map((one) =>
    t('jobs.jobAndShift', {
      job: entry.job?.name ?? '',
      when: rangeWords(one.startsAt, one.endsAt, times, t),
    }),
  );
}

function ShiftCell({ entry, times }: { entry: StaffEntry; times: StaffTimes }) {
  const { t } = useTranslation();
  const [first, ...more] = entry.shifts;
  if (first == null) return <>{t('roster.noShift')}</>;

  return (
    <>
      {more.length > 0 ? (
        <Trans
          i18nKey="roster.moreShifts"
          values={{ first: shiftBreaks(rangeWords(first.startsAt, first.endsAt, times, t)) }}
          count={more.length}
          components={{ more: <span className="rs-more" /> }}
        />
      ) : (
        shiftBreaks(rangeWords(first.startsAt, first.endsAt, times, t))
      )}
    </>
  );
}

function ShiftList({
  entry,
  times,
  ask = false,
}: {
  entry: StaffEntry;
  times: StaffTimes;
  ask?: boolean;
}) {
  const { t } = useTranslation();
  const lines = shiftLines(entry, times, t);

  return (
    <ul className="rs-shifts">
      {(lines.length === 0 ? [t('roster.noShift')] : lines).map((line) => (
        <li key={line} className={ask ? 'rs-ask-shift' : undefined}>
          {line}
        </li>
      ))}
    </ul>
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

/** Who moved the link and when: "Copied by Amara Nwosu · 19:12 · not marked as sent". */
function trailLine(entry: StaffEntry, times: StaffTimes, t: TFunction): string | null {
  if (entry.linkAt == null) return null;
  const time = clockWords(entry.linkAt, times);
  const name = entry.linkBy ?? '';
  switch (entry.link) {
    case 'copied':
      return t('roster.trailCopied', { name, time });
    case 'sent':
      return t('roster.trailSent', { name, time });
    case 'opened':
      return t('roster.trailOpened', { time });
    default:
      return null;
  }
}

/** The row's Link: its word with a mark, who and when, and Copy link, then Mark as sent once copied. */
function LinkCell({
  entry,
  times,
  acts,
  busy,
  missed,
  onCopy,
  onMark,
}: {
  entry: StaffEntry;
  times: StaffTimes;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  onCopy: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation();
  const trail = trailLine(entry, times, t);
  const offered = acts && entry.mobile != null && !entry.contactsErased;

  return (
    <div className="rs-link-cell">
      <LinkWord link={entry.link} />
      {trail != null && <span className="rs-trail">{trail}</span>}
      {missed && (
        <span className="rs-missed">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('roster.linkNotIssued')}
        </span>
      )}
      {offered && (
        <span className="rs-link-acts">
          <button
            id={`rs-copy-${entry.id}`}
            type="button"
            className={busy ? 'desk-text is-busy' : 'desk-text'}
            aria-label={t('roster.copyLinkFor', { name: entry.fullName })}
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            onClick={onCopy}
          >
            {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
            {t('roster.copyLink')}
          </button>
          {unmarked(entry.link) && (
            <button
              type="button"
              className="desk-text"
              aria-label={t('roster.markSentFor', { name: entry.fullName })}
              onClick={onMark}
            >
              {t('roster.markSent')}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** A link the browser would not copy, shown to copy by hand; the field is named for whose link it is. */
function HeldLink({ entry, url }: { entry: StaffEntry; url: string }) {
  const { t } = useTranslation();
  const id = `rs-held-${entry.id}`;

  return (
    <div className="rs-held">
      <p className="rs-held-says">
        <Glyph name="alert" size={16} weight={2.2} />
        {t('roster.linkRefused')}
      </p>
      <label htmlFor={id} className="rs-held-label">
        {t('roster.linkFor', { name: entry.fullName })}
      </label>
      <input
        id={id}
        className="rs-held-field"
        type="text"
        readOnly
        value={url}
        onFocus={(focused) => focused.currentTarget.select()}
      />
    </div>
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

function StationWords({ entry }: { entry: StaffEntry }) {
  const { t } = useTranslation();
  if (entry.station == null && entry.stationRemoved != null)
    return <Gone section={entry.stationRemoved} />;
  if (entry.station == null) return <>{t('roster.noStation')}</>;

  return (
    <>
      {entry.station.name}
      {entry.leads && (
        <>
          {' '}
          <span className="sn-lead">{t('stations.lead')}</span>
        </>
      )}
    </>
  );
}

function Gone({ section }: { section: string }) {
  const { t } = useTranslation();

  return (
    <span className="rs-gone">
      <span className="rs-gone-now">{t('stations.noStation')}</span>
      <GoneWhy section={section} />
    </span>
  );
}

function GoneWhy({ section, id }: { section: string; id?: string }) {
  const { t } = useTranslation();

  return (
    <span className="rs-gone-why" id={id}>
      <Glyph name="alert" size={14} weight={2.4} />
      {t('stations.removedTitle', { name: section })}
    </span>
  );
}

function Details({
  entry,
  plan,
  times,
  manage,
  finished,
  failed,
  onStation,
  onClose,
  onEdit,
  onRemove,
  onReplace,
}: {
  entry: StaffEntry;
  plan: StaffPlan;
  times: StaffTimes;
  manage: boolean;
  finished: boolean;
  failed: string | null;
  onStation: (station: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReplace: (() => void) | null;
}) {
  const { t } = useTranslation();
  const next = entry.contactsErased
    ? null
    : finished
      ? t('roster.nextErasing')
      : unmarked(entry.link)
        ? t('roster.nextCopied')
        : null;
  const trail = trailLine(entry, times, t);

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
        {failed != null && <Failed words={failed} />}
        <dl className="rs-facts">
          <div>
            <dt>{t('roster.shift')}</dt>
            <dd>
              <ShiftList entry={entry} times={times} />
            </dd>
          </div>
          <div>
            <dt>{t('roster.station')}</dt>
            <dd>
              {manage ? (
                <StationSelect
                  id="rs-station"
                  label={t('stations.stationChange', { name: entry.fullName })}
                  value={entry.station?.id ?? ''}
                  shown={
                    entry.station != null
                      ? entry.station.name
                      : entry.stationRemoved != null
                        ? t('stations.noStation')
                        : t('roster.noStation')
                  }
                  {...(entry.station == null &&
                    entry.stationRemoved != null && { describedBy: 'rs-gone' })}
                  dense
                  onChange={onStation}
                  options={[{ value: '', label: t('roster.noStation') }]}
                  groups={stationGroups(plan.stations, t)}
                />
              ) : (
                <StationWords entry={entry} />
              )}
              {manage && entry.station == null && entry.stationRemoved != null && (
                <GoneWhy section={entry.stationRemoved} id="rs-gone" />
              )}
            </dd>
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
            <dd className="rs-link-fact">
              <LinkWord link={entry.link} />
              {trail != null && <span className="rs-trail">{trail}</span>}
              {onReplace != null && entry.mobile != null && entry.link !== 'none' && (
                <button
                  id="rs-replace-open"
                  type="button"
                  className="gs-pill is-secondary"
                  onClick={onReplace}
                >
                  {t('roster.replaceOpen')}
                </button>
              )}
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
  times,
  busy,
  failed,
  onKeep,
  onRemove,
}: {
  entry: StaffEntry;
  times: StaffTimes;
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
        <ShiftList entry={entry} times={times} ask />
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
  plan,
  times,
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
  plan: StaffPlan;
  times: StaffTimes;
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
  const openShifts = plan.shifts
    .filter((one) => one.job === draft.job && one.people.length < one.needed)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((one) => ({ id: one.id, words: rangeWords(one.startsAt, one.endsAt, times, t) }));
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
        <div className="desk-field">
          <label htmlFor={FIELD_IDS.job} className="desk-label">
            {t('roster.job')}
          </label>
          <div
            className={
              problems.job == null
                ? 'desk-box gs-select sn-select'
                : 'desk-box gs-select sn-select is-wrong'
            }
          >
            <span aria-hidden="true">
              {plan.jobs.find((one) => one.id === draft.job)?.name ?? t('roster.noJobOption')}
            </span>
            <Glyph name="chevdown" size={15} weight={2.4} />
            <select
              id={FIELD_IDS.job}
              value={draft.job}
              aria-invalid={problems.job != null || undefined}
              aria-describedby={
                problems.job == null ? undefined : `${FIELD_IDS.job}-error ${FIELD_IDS.job}-help`
              }
              onChange={(change) => onChange({ job: change.target.value, shift: '' })}
            >
              <option value="">{t('roster.noJobOption')}</option>
              {plan.jobs.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
          </div>
          {problems.job != null && (
            <>
              <FieldWrong id={`${FIELD_IDS.job}-error`}>{problems.job}</FieldWrong>
              <p id={`${FIELD_IDS.job}-help`} className="desk-help">
                {t('roster.onShiftsHint')}
              </p>
            </>
          )}
        </div>
        {!editing && draft.job !== '' && (
          <div className="desk-field">
            <label htmlFor="rs-f-shift" className="desk-label">
              {t('roster.shift')}
            </label>
            <div className="desk-box gs-select sn-select">
              <span aria-hidden="true">
                {openShifts.find((one) => one.id === draft.shift)?.words ??
                  t('roster.noShiftOption')}
              </span>
              <Glyph name="chevdown" size={15} weight={2.4} />
              <select
                id="rs-f-shift"
                value={draft.shift}
                onChange={(change) => onChange({ shift: change.target.value })}
              >
                <option value="">{t('roster.noShiftOption')}</option>
                {openShifts.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.words}
                  </option>
                ))}
              </select>
            </div>
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
