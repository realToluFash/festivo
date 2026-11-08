import {
  type AddableMember,
  ApiError,
  EVENT_ROLES,
  type EventPerson,
  type EventRole,
  type OrganisationEvent,
} from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
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
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhenFree, LayersContext, useDeskLayers } from '../../../layers.ts';
import { canOn, useSession } from '../../../session.ts';
import '../../../components/SettingsParts.css';
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
      addable: AddableMember[] | null;
    };

type Open = { kind: 'person'; id: string; visit: number } | { kind: 'add' } | null;

/** A role reached by arrow sends once the arrows rest, so passing over a role on the way sends nothing. */
const SETTLE_MS = 600;
/** The row whose dialog closed stays lit this long, then its Tint fades. */
const LIT_MS = 2000;
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** People on an event (sc-29915), as the People demo draws it at a desk: who has which of its four roles, changed by Owners, Admins and its Lead. */
export function EventPeople({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const session = useSession();
  const { layers, covered, setHost } = useDeskLayers();
  const organisationName = session.organisation?.name ?? '';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
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

    (async () => {
      const read = await api.eventPeople(event.id);
      const addable = manages ? await api.addableEventMembers(event.id) : null;

      return { ...read, addable };
    })().then(
      (loaded) => current && setLoad({ kind: 'loaded', ...loaded }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, manages]);

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

  if (load.kind === 'loading')
    return <Skeleton words={t('eventPeople.loading')} shape="rows" rowHeight={60} />;

  if (load.kind === 'failed')
    return (
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
    );

  const loaded = load;
  const people = inListOrder(loaded.people);
  const own = people.find((person) => person.user.id === userId);
  const addable = loaded.addable;
  const managers = [...loaded.owners, ...loaded.admins];
  const list = new Intl.ListFormat(currentLocale(), { type: 'conjunction' });
  const count = new Intl.NumberFormat(currentLocale());
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
    <LayersContext value={layers}>
      <div className="desk event-people-desk">
        <section
          className="card desk-column event-people"
          aria-labelledby="event-people-title"
          inert={covered}
        >
          <h2 id="event-people-title" ref={title} className="desk-title" tabIndex={-1}>
            {t('eventPeople.title')}
          </h2>
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

          {people.length === 0 ? (
            <div className="people-nobody">
              <p className="desk-empty-title">{t('eventPeople.nobody')}</p>
              <p className="desk-line">{t('eventPeople.nobodyLine')}</p>
            </div>
          ) : (
            <section className="desk-block" aria-labelledby="event-people-on">
              <Head title={<span id="event-people-on">{t('eventPeople.onEvent')}</span>}>
                <span className="people-count">{count.format(people.length)}</span>
              </Head>
              <ul className="desk-rows has-lead people-rows">
                {people.map((person, tone) => {
                  const yours = person.id === own?.id;
                  const words = (
                    <>
                      <Avatar initials={initials(person.user.name)} tone={tone} />
                      <RowWords
                        title={person.user.name}
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
        </section>
        <div ref={setHost} className="desk-layers" />

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
                  addable == null
                    ? null
                    : [...addable, { membershipId: opened.membershipId, name: opened.user.name }],
              });
              setOpen(null);
              setLit(null);
              setToast(t('eventPeople.removed', { name: opened.user.name }));
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
            members={addable}
            onPartlyAdded={joined}
            onAdded={(added, role) => {
              joined(added);
              closeAdd();
              setToast(
                added.length === 1
                  ? t(`eventPeople.nowOne.${role}`, { name: added[0]?.user.name ?? '' })
                  : t(`eventPeople.nowMany.${role}`, { count: added.length }),
              );
            }}
            onClose={closeAdd}
          />
        )}
        {toast != null && <Toast key={toast} words={toast} onClose={() => setToast(null)} />}
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
      a.user.name.localeCompare(b.user.name, currentLocale()),
  );
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
  const name = person.user.name;
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
                t('eventPeople.memberOf', { organisation: organisationName }),
                ...(person.jobLabel == null ? [] : [person.jobLabel]),
              ].join(' · '),
            ]}
          />
        </div>
        {failed != null && <Lost words={failed} />}
        <fieldset className="desk-choices">
          <legend className="desk-unseen">{t('eventPeople.roleFor', { name })}</legend>
          <ul className="desk-rows">
            {EVENT_ROLES.map((role) => (
              <li key={role}>
                <label className={role === picked ? 'desk-row is-picked' : 'desk-row'}>
                  <RowWords
                    title={t(`eventPeople.role.${role}`)}
                    tag={role === picked && <SavingTag saving={saving} />}
                    lines={[t(`eventPeople.roleMeans.${role}`)]}
                  />
                  <input
                    ref={role === picked ? pickedRadio : undefined}
                    type="radio"
                    className="desk-radio"
                    name={radios}
                    value={role}
                    checked={role === picked}
                    onKeyDown={(key: KeyboardEvent<HTMLInputElement>) => {
                      byArrow.current = ARROWS.has(key.key);
                    }}
                    onChange={() => pick(role)}
                  />
                </label>
              </li>
            ))}
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
          line={t('eventPeople.removeLine', { organisation: organisationName })}
          keep={t('eventPeople.keep', { name })}
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

/** Members of the organisation only: someone from outside waits on sc-71's grant. */
function AddDialog({
  eventId,
  organisationName,
  members,
  onPartlyAdded,
  onAdded,
  onClose,
}: {
  eventId: string;
  organisationName: string;
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
  const wording = typed.trim().toLocaleLowerCase(currentLocale());
  const shown = [...members]
    .sort((a, b) => a.name.localeCompare(b.name, currentLocale()))
    .filter(
      (member) =>
        ticked.includes(member.membershipId) ||
        member.name.toLocaleLowerCase(currentLocale()).includes(wording),
    );
  const touched = ticked.length > 0 || role !== 'can_view';
  const cancel = useCallback(() => (touched ? setDiscarding(true) : onClose()), [touched, onClose]);
  const inOrganisation = t('eventPeople.inOrganisation', { organisation: organisationName });

  async function add(): Promise<void> {
    if (busy || ticked.length === 0) return;
    setBusy(true);
    setFailed(null);
    const added: EventPerson[] = [];

    try {
      for (const membershipId of ticked) {
        added.push(await api.addEventPerson(eventId, membershipId, role));
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
        on={ticked.length > 0}
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
            label={t('eventPeople.find')}
            value={typed}
            onChange={setTyped}
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
              {shown.length === 0 && (
                <p className="desk-line">
                  {members.length === 0
                    ? t('eventPeople.everyoneOn', { organisation: organisationName })
                    : t('eventPeople.noMatch', {
                        organisation: organisationName,
                        typed: typed.trim(),
                      })}
                </p>
              )}
            </div>
          </section>
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
