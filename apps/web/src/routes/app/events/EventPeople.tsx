import {
  type AddableMember,
  ApiError,
  EVENT_ROLES,
  type EventPerson,
  type EventRole,
  type OrganisationEvent,
  type StaffLinkHolder,
} from '@soirely/api-client';
import { firstName, initials, listFormat, numberFormat } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import {
  Ask,
  Avatar,
  Choices,
  Dialog,
  Field,
  Head,
  RowWords,
  Tag,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree, LayersContext, useDeskLayers } from '../../../layers.ts';
import { canOn, outsideOn, useSession } from '../../../session.ts';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
import '../../../components/SettingsParts.css';
import { faceOf, outsideView, shownAddress } from './outside.ts';
import { clockWords, wallOf } from './staffTimes.ts';
import './people.css';

/** `addable` is null for whoever may not change People: the API refuses them that list. */
type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'loaded';
      people: EventPerson[];
      owners: string[];
      admins: string[];
      /** Absent from a list kept before staff links (sc-3912). */
      staffLinks?: StaffLinkHolder[];
      addable: AddableMember[] | null;
    };

type Open = { kind: 'person'; id: string; visit: number } | { kind: 'add' } | null;

/** A role reached by arrow sends once the arrows rest, so passing over a role on the way sends nothing. */
const SETTLE_MS = 600;
/** The row whose dialog closed stays lit this long, then its Tint fades. */
const LIT_MS = 2000;
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const LABEL_MOST = 60;

/** People on an event (sc-29915), as the People demo draws it at a desk, on its own title under the crumb (sc-69635): who has which of its four roles, changed by Owners, Admins and its Lead. */
export function EventPeople({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const session = useSession();
  const { layers, covered, setHost } = useDeskLayers();
  const organisationName =
    outsideOn(session, event.id)?.organisationName ?? session.organisation?.name ?? '';
  const country = session.organisation?.countryCode ?? '';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();
  const [open, setOpen] = useState<Open>(null);
  const [lit, setLit] = useState<{ id: string; held: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const addBox = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const manages = canOn(event, 'people.manage');
  const userId = session.userId;

  useEffect(() => {
    let current = true;

    keptLoad(
      keptKeys.people(event.id),
      (async () => {
        const read = await api.eventPeople(event.id);
        const addable = manages ? await api.addableEventMembers(event.id) : null;

        return { ...read, addable };
      })(),
    ).then(
      (loaded) => current && setLoad({ kind: 'loaded', ...loaded }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, manages, answeredAgain]);

  const shown = useMemo(() => {
    if (load.kind !== 'loaded') return null;
    const { kind: _loaded, ...people } = load;

    return people;
  }, [load]);
  useKeptAsShown(keptKeys.people(event.id), shown);

  useEffect(() => {
    if (lit == null || lit.held) return;
    const timer = window.setTimeout(() => setLit(null), LIT_MS);

    return () => window.clearTimeout(timer);
  }, [lit]);

  const closeRole = useCallback(() => {
    setOpen(null);
    setLit((was) => (was == null ? null : { ...was, held: false }));
  }, []);
  const closeAdd = useCallback(() => setOpen(null), []);

  const top = (
    <header className="desk-top">
      <h1 ref={title} className="desk-title" tabIndex={-1}>
        {t('eventPeople.title')}
      </h1>
    </header>
  );

  if (load.kind === 'loading')
    return (
      <PeopleDesk layers={layers} covered={covered} setHost={setHost} top={top}>
        <Skeleton words={t('eventPeople.loading')} shape="rows" rowHeight={60} />
      </PeopleDesk>
    );

  if (load.kind === 'failed')
    return (
      <PeopleDesk layers={layers} covered={covered} setHost={setHost} top={top}>
        <ArrivalNotice
          role={attempt > 0 ? undefined : 'alert'}
          line={t('eventPeople.failed')}
          lineRef={failedLine}
          focusable
          retry={t('eventPeople.retry')}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </PeopleDesk>
    );

  const loaded = load;
  const people = inListOrder(loaded.people);
  const own = people.find((person) => person.user?.id === userId);
  const addable = loaded.addable;
  const managers = [...loaded.owners, ...loaded.admins];
  const staffLinks = loaded.staffLinks ?? [];
  const list = listFormat(currentLocale(), { type: 'conjunction' });
  const count = numberFormat(currentLocale());
  const adds = manages && addable != null;
  const opened = open?.kind === 'person' ? people.find((one) => one.id === open.id) : undefined;

  function replaced(person: EventPerson): void {
    setLoad({ ...loaded, people: people.map((one) => (one.id === person.id ? person : one)) });
  }

  function joined(added: readonly EventPerson[]): void {
    setLoad({
      ...loaded,
      people: [...people, ...added],
      addable:
        addable?.filter(
          (one) => !added.some((person) => person.membershipId === one.membershipId),
        ) ?? null,
    });
  }

  return (
    <PeopleDesk
      layers={layers}
      covered={covered}
      setHost={setHost}
      top={top}
      beside={
        <>
          {opened != null && open?.kind === 'person' && (
            <RoleDialog
              key={open.visit}
              eventId={event.id}
              person={opened}
              tone={people.indexOf(opened)}
              organisationName={organisationName}
              onChanged={replaced}
              onRemoved={() => {
                setLoad({
                  ...loaded,
                  people: people.filter((one) => one.id !== opened.id),
                  addable:
                    addable == null || opened.membershipId == null
                      ? addable
                      : [
                          ...addable,
                          { membershipId: opened.membershipId, name: nameOf(opened, t) },
                        ],
                });
                setOpen(null);
                setLit(null);
                setToast(t('eventPeople.removed', { name: nameOf(opened, t) }));
                // The row it came from has gone, so focus lands on Add once the dialogs have handed it back.
                focusWhenFree(() => addBox.current ?? title.current);
              }}
              onClose={closeRole}
            />
          )}
          {open?.kind === 'add' && addable != null && (
            <AddDialog
              eventId={event.id}
              organisationName={organisationName}
              country={country}
              people={people}
              members={addable}
              onPartlyAdded={joined}
              onAdded={(added, role) => {
                joined(added);
                closeAdd();
                setToast(
                  added.length === 1
                    ? t(`eventPeople.nowOne.${role}`, { name: added[0] ? nameOf(added[0], t) : '' })
                    : t(`eventPeople.nowMany.${role}`, { count: added.length }),
                );
              }}
              onClose={closeAdd}
            />
          )}
          {toast != null && <Toast key={toast} words={toast} onClose={() => setToast(null)} />}
        </>
      }
    >
      {adds && (
        <button
          ref={addBox}
          type="button"
          className="people-add"
          onClick={() => {
            setToast(null);
            setOpen({ kind: 'add' });
          }}
        >
          <Glyph name="plus" size={19} weight={2.4} />
          {t('eventPeople.addPrompt')}
        </button>
      )}

      {people.length + staffLinks.length === 0 ? (
        <div className="people-nobody">
          <p className="desk-empty-title">{t('eventPeople.nobody')}</p>
          <p className="desk-line">{t('eventPeople.nobodyLine')}</p>
        </div>
      ) : (
        <section className="desk-block" aria-labelledby="event-people-on">
          <Head title={<span id="event-people-on">{t('eventPeople.onEvent')}</span>}>
            <span className="people-count">{count.format(people.length + staffLinks.length)}</span>
          </Head>
          <ul className="desk-rows has-lead people-rows">
            {people.map((person, tone) => {
              const yours = person.id === own?.id;
              const face = faceOf(person);
              const words = (
                <>
                  {face == null ? (
                    <Avatar initials={initials(nameOf(person, t))} tone={tone} />
                  ) : (
                    <span className="people-outside-face" aria-hidden="true">
                      <Glyph name={face} size={18} />
                    </span>
                  )}
                  <RowWords
                    title={nameOf(person, t)}
                    tag={
                      person.outside && (
                        <Tag
                          kind="now"
                          word={t('eventPeople.outsideTag', { organisation: organisationName })}
                        />
                      )
                    }
                    lines={[
                      [
                        t(`eventPeople.role.${person.role}`),
                        ...(person.jobLabel == null ? [] : [person.jobLabel]),
                        ...(yours ? [t('eventPeople.you')] : []),
                      ].join(' · '),
                    ]}
                  />
                </>
              );

              return (
                <li key={person.id}>
                  {manages && !yours ? (
                    <button
                      type="button"
                      className={lit?.id === person.id ? 'desk-row is-on' : 'desk-row'}
                      aria-haspopup="dialog"
                      onClick={() => {
                        setToast(null);
                        setLit({ id: person.id, held: true });
                        setOpen((was) => ({
                          kind: 'person',
                          id: person.id,
                          visit: (was?.kind === 'person' ? was.visit : 0) + 1,
                        }));
                      }}
                    >
                      {words}
                      <Glyph name="chevdown" size={18} weight={2.3} className="desk-chevron" />
                    </button>
                  ) : (
                    <div className="desk-row">{words}</div>
                  )}
                </li>
              );
            })}
            {staffLinks.map((holder) => (
              <li key={`staff-link-${holder.id}`}>
                <StaffLinkRow holder={holder} event={event} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="people-foot">
        {!manages && <p className="desk-foot">{t('eventPeople.readOnly')}</p>}
        {managers.length > 0 && (
          <p className="desk-foot">
            {t('eventPeople.managers', {
              count: managers.length,
              names: list.format(managers),
              roles: list.format(
                (['owner', 'admin'] as const)
                  .map((role) => ({ role, count: loaded[`${role}s`].length }))
                  .filter(({ count: held }) => held > 0)
                  .map(({ role, count: held }) =>
                    t(`eventPeople.managerRole.${role}`, { count: held }),
                  ),
              ),
              organisation: organisationName,
            })}
          </p>
        )}
      </div>
    </PeopleDesk>
  );
}

/** One desk around every state, so the title stays the same node and keeps focus as the list arrives. */
function PeopleDesk({
  layers,
  covered,
  setHost,
  top,
  beside,
  children,
}: {
  layers: ReturnType<typeof useDeskLayers>['layers'];
  covered: boolean;
  setHost: (host: HTMLElement | null) => void;
  top: ReactNode;
  beside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LayersContext value={layers}>
      <div className="desk event-people-desk">
        <div className="desk-column event-people" inert={covered}>
          {top}
          {children}
        </div>
        <div ref={setHost} className="desk-layers" />
        {beside}
      </div>
    </LayersContext>
  );
}

/** The API's reason when it refused the request, or the fallback when it never answered. */
function refusal(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) return fallback;
  const { violations, detail, title } = error.problem;

  return violations?.[0]?.message ?? detail ?? title;
}

function inListOrder(people: readonly EventPerson[]): EventPerson[] {
  return [...people].sort(
    (a, b) =>
      EVENT_ROLES.indexOf(a.role) - EVENT_ROLES.indexOf(b.role) ||
      (a.user?.name ?? a.address ?? '').localeCompare(
        b.user?.name ?? b.address ?? '',
        currentLocale(),
      ),
  );
}

/** Someone added by an address goes by it until they join, and by 'Not joined yet' to whoever is not shown it. */
function nameOf(person: EventPerson, t: (key: string) => string): string {
  return person.user?.name ?? shownAddress(person) ?? t('eventPeople.notJoined');
}

function Lost({ words }: { words: string }) {
  return (
    <p className="desk-error people-lost" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {words}
    </p>
  );
}

type Saving = 'saving' | 'saved' | null;

function SavingTag({ saving }: { saving: Saving }) {
  const { t } = useTranslation();
  if (saving == null) return null;

  return (
    <span className={`desk-tag ${saving === 'saving' ? 'is-now' : 'is-yes'}`} aria-hidden="true">
      {saving === 'saving' ? (
        <span className="people-spinner" />
      ) : (
        <Glyph name="tick" size={14} weight={3} />
      )}
      {t(saving === 'saving' ? 'eventPeople.saving' : 'eventPeople.saved')}
    </span>
  );
}

/** A role saves as it is picked and the dialog stays open, so a pick never changes the context by itself (WCAG 3.2.2). */
function RoleDialog({
  eventId,
  person,
  tone,
  organisationName,
  onChanged,
  onRemoved,
  onClose,
}: {
  eventId: string;
  person: EventPerson;
  tone: number;
  organisationName: string;
  onChanged: (person: EventPerson) => void;
  onRemoved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const radios = useId();
  const pickedRadio = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [saving, setSaving] = useState<Saving>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [removingNow, setRemovingNow] = useState(false);
  const name = nameOf(person, t);
  const held = useRef<EventRole>(person.role);
  const byArrow = useRef(false);
  const settle = useRef<{ timer: number; role: EventRole } | null>(null);
  const asked = useRef(0);
  const answered = useRef(0);
  const inFlight = useRef(0);
  const removal = useRef(false);
  const flush = useRef<(role: EventRole) => Promise<void>>(async () => {});

  async function send(role: EventRole): Promise<void> {
    const ask = ++asked.current;
    inFlight.current += 1;

    try {
      const changed = await api.changeEventPerson(eventId, person.id, role);
      if (ask < answered.current) return;
      answered.current = ask;
      held.current = changed.role;
      onChanged(changed);
      if (ask === asked.current) setSaving('saved');
    } catch (error) {
      if (ask !== asked.current) return;
      const was = held.current;
      setPicked(was);
      setSaving(null);
      setFailed(
        refusal(error, t('eventPeople.changeFailed', { name, role: t(`eventPeople.role.${was}`) })),
      );
    } finally {
      inFlight.current -= 1;
    }
  }

  useEffect(() => {
    flush.current = send;
  });

  // Done during the rest still sends the role the arrows stopped on.
  useEffect(
    () => () => {
      const waiting = settle.current;
      if (waiting == null) return;
      window.clearTimeout(waiting.timer);
      void flush.current(waiting.role);
    },
    [],
  );

  function pick(role: EventRole): void {
    const arrowed = byArrow.current;
    byArrow.current = false;
    if (settle.current != null) window.clearTimeout(settle.current.timer);
    settle.current = null;
    setPicked(role);
    setFailed(null);

    if (role === held.current && inFlight.current === 0) {
      setSaving(null);

      return;
    }

    setSaving('saving');
    if (!arrowed) {
      void send(role);

      return;
    }
    settle.current = {
      role,
      timer: window.setTimeout(() => {
        settle.current = null;
        void send(role);
      }, SETTLE_MS),
    };
  }

  async function remove(): Promise<void> {
    if (removal.current) return;
    removal.current = true;
    setRemovingNow(true);
    setRefused(null);

    try {
      await api.removeEventPerson(eventId, person.id);
      onRemoved();
    } catch (error) {
      setRefused(refusal(error, t('eventPeople.removeFailed')));
    } finally {
      removal.current = false;
      setRemovingNow(false);
    }
  }

  return (
    <>
      <Dialog
        title={t('eventPeople.roleTitle')}
        verb={t('eventPeople.done')}
        cancel={false}
        first={pickedRadio}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        <div className="people-who">
          <Avatar initials={initials(name)} tone={tone} size="face" />
          <RowWords
            title={name}
            lines={[
              [
                t(person.outside ? 'eventPeople.fromOutside' : 'eventPeople.memberOf', {
                  organisation: organisationName,
                }),
                ...(person.jobLabel == null ? [] : [person.jobLabel]),
              ].join(' · '),
            ]}
          />
        </div>
        {person.outside && <p className="desk-line people-ends">{t('eventPeople.outsideEnds')}</p>}
        {failed != null && <Lost words={failed} />}
        <fieldset className="desk-choices">
          <legend className="desk-unseen">{t('eventPeople.roleFor', { name })}</legend>
          <ul className="desk-rows">
            {EVENT_ROLES.map((role) => {
              const off = person.outside && role === 'lead';
              const rowClass = ['desk-row', role === picked && 'is-picked', off && 'is-off'];

              return (
                <li key={role}>
                  <label className={rowClass.filter(Boolean).join(' ')}>
                    <RowWords
                      title={t(`eventPeople.role.${role}`)}
                      tag={role === picked && <SavingTag saving={saving} />}
                      lines={[
                        off
                          ? t('eventPeople.leadOff', { organisation: organisationName })
                          : t(`eventPeople.roleMeans.${role}`),
                      ]}
                    />
                    <input
                      ref={role === picked ? pickedRadio : undefined}
                      type="radio"
                      className="desk-radio"
                      name={radios}
                      value={role}
                      disabled={off}
                      checked={role === picked}
                      onKeyDown={(key: KeyboardEvent<HTMLInputElement>) => {
                        byArrow.current = ARROWS.has(key.key);
                      }}
                      onChange={() => pick(role)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <p className="desk-unseen" role="status">
          {saving === 'saving'
            ? t('eventPeople.saving')
            : saving === 'saved'
              ? t('eventPeople.savedHeard', {
                  said: t(`eventPeople.nowOne.${picked}`, { name }),
                })
              : ''}
        </p>
        <div className="people-remove">
          <TextAction label={t('eventPeople.remove')} red onClick={() => setRemoving(true)} />
        </div>
      </Dialog>
      {removing && (
        <Ask
          title={t('eventPeople.removeTitle', { name })}
          line={
            person.outside
              ? t('eventPeople.removeOutsideLine')
              : t('eventPeople.removeLine', { organisation: organisationName })
          }
          keep={t('eventPeople.keep', { name: firstName(name) })}
          go={t('eventPeople.removeConfirm')}
          busy={removingNow ? t('eventPeople.removing') : undefined}
          failed={refused ?? undefined}
          onKeep={() => {
            setRefused(null);
            setRemoving(false);
          }}
          onGo={() => void remove()}
        />
      )}
    </>
  );
}

/** Members found by name, and someone from outside by email address or mobile number (sc-71). */
function AddDialog({
  eventId,
  organisationName,
  country,
  people,
  members,
  onPartlyAdded,
  onAdded,
  onClose,
}: {
  eventId: string;
  organisationName: string;
  country: string;
  people: readonly EventPerson[];
  members: readonly AddableMember[];
  onPartlyAdded: (added: EventPerson[]) => void;
  onAdded: (added: EventPerson[], role: EventRole) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const nameBox = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<EventRole>('can_view');
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [outsideOn, setOutsideOn] = useState(true);
  const [job, setJob] = useState('');
  const outside = outsideView(typed, country, role, people);
  const address = outside.kind === 'offer' ? outside.address : null;
  const sendsOutside = address != null && outsideOn;
  const quiet = outside.kind === 'offer' || outside.kind === 'leadOff';
  const fromOutside = t('eventPeople.fromOutside', { organisation: organisationName });
  const wording = typed.trim().toLocaleLowerCase(currentLocale());
  const shown = [...members]
    .sort((a, b) => a.name.localeCompare(b.name, currentLocale()))
    .filter(
      (member) =>
        ticked.includes(member.membershipId) ||
        member.name.toLocaleLowerCase(currentLocale()).includes(wording),
    );
  const touched = ticked.length > 0 || role !== 'can_view' || sendsOutside;
  const cancel = useCallback(() => (touched ? setDiscarding(true) : onClose()), [touched, onClose]);
  const inOrganisation = t('eventPeople.inOrganisation', { organisation: organisationName });

  async function add(): Promise<void> {
    if (busy || (ticked.length === 0 && !sendsOutside)) return;
    setBusy(true);
    setFailed(null);
    const added: EventPerson[] = [];

    try {
      for (const membershipId of ticked) {
        added.push(await api.addEventPerson(eventId, membershipId, role));
      }
      if (sendsOutside) {
        const label = job.trim();
        added.push(
          await api.addEventPersonFromOutside(
            eventId,
            address.address,
            role,
            label === '' ? null : label,
          ),
        );
      }
      onAdded(added, role);
    } catch (error) {
      setBusy(false);
      setTicked(ticked.filter((id) => !added.some((one) => one.membershipId === id)));
      if (added.length > 0) onPartlyAdded(added);
      setFailed(refusal(error, t('eventPeople.addFailed')));
    }
  }

  return (
    <>
      <Dialog
        title={t('eventPeople.addTitle')}
        verb={t('eventPeople.addConfirm')}
        dismiss={t('eventPeople.cancel')}
        on={ticked.length > 0 || sendsOutside}
        locked={busy}
        first={nameBox}
        onDismiss={cancel}
        onConfirm={() => void add()}
      >
        <div className="people-add-body">
          {failed != null && <Lost words={failed} />}
          <Choices
            legend={t('eventPeople.theirRole')}
            choices={EVENT_ROLES.map((one) => ({
              name: t(`eventPeople.role.${one}`),
              line: t(`eventPeople.roleMeans.${one}`),
            }))}
            picked={t(`eventPeople.role.${role}`)}
            onPick={(word) =>
              setRole(EVENT_ROLES.find((one) => t(`eventPeople.role.${one}`) === word) ?? role)
            }
          />
          <Field
            label={t(role === 'lead' ? 'eventPeople.find' : 'eventPeople.findAny')}
            value={typed}
            onChange={(value) => {
              setTyped(value);
              setOutsideOn(true);
            }}
            inputRef={nameBox}
            autoComplete="off"
          />
          <section className="desk-block" aria-label={inOrganisation}>
            <Head title={inOrganisation} level={3} />
            {shown.length > 0 && (
              <ul className="desk-rows has-lead">
                {shown.map((member, tone) => {
                  const on = ticked.includes(member.membershipId);

                  return (
                    <li key={member.membershipId}>
                      <label className={on ? 'desk-row is-picked' : 'desk-row'}>
                        <Avatar initials={initials(member.name)} tone={tone} />
                        <RowWords title={member.name} lines={[]} />
                        <input
                          type="checkbox"
                          className="people-check"
                          checked={on}
                          disabled={busy}
                          onChange={(change) =>
                            setTicked(
                              change.target.checked
                                ? [...ticked, member.membershipId]
                                : ticked.filter((id) => id !== member.membershipId),
                            )
                          }
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div role="status">
              {shown.length === 0 && !quiet && (
                <p className="desk-line">
                  {members.length === 0
                    ? t('eventPeople.everyoneOn', { organisation: organisationName })
                    : t('eventPeople.noMatch', {
                        organisation: organisationName,
                        typed: typed.trim(),
                      })}
                </p>
              )}
              {outside.kind === 'unusable' && (
                <p className="desk-line">{t('eventPeople.unusable')}</p>
              )}
              {outside.kind === 'onEvent' && (
                <p className="desk-line">{t('eventPeople.onAlready', { name: outside.name })}</p>
              )}
              {outside.kind === 'leadOff' && (
                <>
                  <p className="desk-empty-title">
                    {t('eventPeople.leadOff', { organisation: organisationName })}
                  </p>
                  <p className="desk-line">{t('eventPeople.pickAnother')}</p>
                </>
              )}
            </div>
          </section>
          {address != null && (
            <section className="desk-block" aria-label={fromOutside}>
              <Head title={fromOutside} level={3} />
              <ul className="desk-rows has-lead">
                <li>
                  <label className={outsideOn ? 'desk-row is-picked' : 'desk-row'}>
                    <span className="people-outside-face" aria-hidden="true">
                      <Glyph name={address.kind === 'email' ? 'mail' : 'phone'} size={18} />
                    </span>
                    <RowWords title={address.shown} lines={[]} />
                    <input
                      type="checkbox"
                      className="people-check"
                      checked={outsideOn}
                      disabled={busy}
                      onChange={() => setOutsideOn((was) => !was)}
                    />
                  </label>
                </li>
              </ul>
              {outsideOn && (
                <Field
                  label={t('eventPeople.jobLabel')}
                  value={job}
                  help={t('eventPeople.jobHelp', {
                    length: Array.from(job).length,
                    most: LABEL_MOST,
                  })}
                  autoComplete="off"
                  onChange={(value) => setJob(Array.from(value).slice(0, LABEL_MOST).join(''))}
                />
              )}
            </section>
          )}
        </div>
      </Dialog>
      {discarding && (
        <Ask
          title={t('eventPeople.discardTitle')}
          line={t('eventPeople.discardLine')}
          keep={t('eventPeople.discardKeep')}
          go={t('eventPeople.discard')}
          onKeep={() => setDiscarding(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** In by their own link from the roster (sc-3912): one row a person, however many links they were given, and it opens nothing, since a link is changed on the roster. */
function StaffLinkRow({ holder, event }: { holder: StaffLinkHolder; event: OrganisationEvent }) {
  const { t } = useTranslation();
  const time = endsWords(holder.endsAt, event, t);

  return (
    <div className="desk-row">
      <span className="people-outside-face" aria-hidden="true">
        <Glyph name="link" size={18} />
      </span>
      <RowWords
        title={
          holder.job == null
            ? t('eventPeople.staffLinkNoJob', { name: holder.name, time })
            : t('eventPeople.staffLink', { name: holder.name, job: holder.job, time })
        }
        tag={
          !holder.signedIn && (
            <span className="desk-tag people-not-signed">
              <span className="people-not-signed-mark" aria-hidden="true" />
              {t('eventPeople.notSignedIn')}
            </span>
          )
        }
        lines={holder.access == null ? [] : [t(`jobs.access.${holder.access}`)]}
      />
    </div>
  );
}

/** "03:00", or "03:00 on Sunday 25 Oct" when the link ends on a later day than the event starts. */
function endsWords(endsAt: string, event: OrganisationEvent, t: TFunction): string {
  const times = { long: false, timeZone: event.timeZone, locale: dateLocale() };
  const time = clockWords(endsAt, times);
  if (wallOf(endsAt, event.timeZone).date === wallOf(event.startsAt, event.timeZone).date)
    return time;
  const date = new Intl.DateTimeFormat(times.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: event.timeZone,
  }).format(new Date(endsAt));

  return t('eventPeople.endsOn', { time, date });
}
