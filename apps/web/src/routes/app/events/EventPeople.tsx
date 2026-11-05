import {
  ApiError,
  EVENT_ROLES,
  type EventPerson,
  type EventRole,
  type OrganisationEvent,
  type OrganisationMember,
} from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx';
import { FieldError } from '../../../components/FieldError.tsx';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { can, useSession } from '../../../session.ts';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; people: EventPerson[] };

/** Read only for whoever may list the organisation's members: the API offers nobody else either. */
interface Organisation {
  members: OrganisationMember[];
  managers: string[];
}

type Open = { kind: 'person'; id: string } | { kind: 'add' } | null;

/** People on an event (sc-29915): who has which of its four roles, changed by Owners, Admins and its Lead. */
export function EventPeople({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const session = useSession();
  const organisationName = session.organisation?.name ?? '';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [toast, setToast] = useState<string | null>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const reads = can(session, 'members.read');

  useEffect(() => {
    let current = true;

    api.eventPeople(event.id).then(
      (people) => current && setLoad({ kind: 'loaded', people }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  useEffect(() => {
    if (!reads) return;
    let current = true;

    Promise.all([api.members(event.organisationId), api.roles(event.organisationId)]).then(
      ([list, catalogue]) =>
        current &&
        setOrganisation({
          members: list.members.filter((member) => member.status === 'active'),
          managers: catalogue.roles
            .filter((role) => role.seededAs === 'owner' || role.seededAs === 'administrator')
            .flatMap((role) => role.holderNames.filter((one) => !one.suspended))
            .map((one) => one.name),
        }),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [event.organisationId, reads]);

  const close = useCallback(() => {
    setOpen(null);
    const back = opener.current;
    if (back?.isConnected === true) back.focus();
  }, []);

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

  const people = inListOrder(load.people);
  const own = people.find((person) => person.user.id === session.userId);
  const manages = can(session, 'people.manage') || own?.role === 'lead';
  const adds = manages && organisation != null;
  const opened = open?.kind === 'person' ? people.find((one) => one.id === open.id) : undefined;

  function replaced(person: EventPerson): void {
    setLoad({
      kind: 'loaded',
      people: people.map((one) => (one.id === person.id ? person : one)),
    });
  }

  return (
    <section className="card event-people" aria-labelledby="event-people-title">
      <h2 id="event-people-title">{t('eventPeople.title')}</h2>
      {adds && (
        <button
          type="button"
          className="button event-people-add"
          onClick={(click) => {
            opener.current = click.currentTarget;
            setOpen({ kind: 'add' });
          }}
        >
          {t('eventPeople.add')}
        </button>
      )}

      {people.length === 0 ? (
        <div className="event-people-nobody">
          <p className="members-row-name">{t('eventPeople.nobody')}</p>
          <p className="muted">{t('eventPeople.nobodyLine')}</p>
        </div>
      ) : (
        <>
          <h3 className="event-people-head">
            <span>{t('eventPeople.onEvent')}</span>
            <span className="muted">{t('eventPeople.count', { count: people.length })}</span>
          </h3>
          <ul className="event-people-list">
            {people.map((person) => {
              const yours = person.id === own?.id;
              const content = (
                <>
                  <span className="person-tile" aria-hidden="true">
                    {initials(person.user.name)}
                  </span>
                  <span className="members-row-text">
                    <span className="members-row-name">{person.user.name}</span>
                    <span className="muted">
                      {[
                        t(`eventPeople.role.${person.role}`),
                        ...(person.jobLabel == null ? [] : [person.jobLabel]),
                        ...(yours ? [t('eventPeople.you')] : []),
                      ].join(' · ')}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={person.id}>
                  {manages && !yours ? (
                    <button
                      type="button"
                      className="members-row"
                      aria-haspopup="dialog"
                      onClick={(click) => {
                        opener.current = click.currentTarget;
                        setOpen({ kind: 'person', id: person.id });
                      }}
                    >
                      {content}
                      <span aria-hidden="true">⌄</span>
                    </button>
                  ) : (
                    <div className="members-row">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="event-people-foot">
        {!manages && <p className="muted">{t('eventPeople.readOnly')}</p>}
        <p className="muted">
          {organisation == null || organisation.managers.length === 0
            ? t('eventPeople.managersUnnamed', { organisation: organisationName })
            : t('eventPeople.managers', {
                names: new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(
                  organisation.managers,
                ),
                organisation: organisationName,
              })}
        </p>
      </div>

      {opened != null && (
        <RoleDialog
          eventId={event.id}
          person={opened}
          organisationName={organisationName}
          onChanged={replaced}
          onRemoved={() => {
            setLoad({ kind: 'loaded', people: people.filter((one) => one.id !== opened.id) });
            setOpen(null);
            setToast(t('eventPeople.removed', { name: opened.user.name }));
            document.getElementById('event-people-title')?.focus();
          }}
          onClose={close}
        />
      )}
      {open?.kind === 'add' && organisation != null && (
        <AddDialog
          eventId={event.id}
          organisationName={organisationName}
          members={organisation.members.filter(
            (member) => !people.some((one) => one.membershipId === member.id),
          )}
          onAdded={(added, role) => {
            setLoad({ kind: 'loaded', people: [...people, ...added] });
            close();
            setToast(
              added.length === 1
                ? t(`eventPeople.nowOne.${role}`, { name: added[0]?.user.name ?? '' })
                : t(`eventPeople.nowMany.${role}`, { count: added.length }),
            );
          }}
          onClose={close}
        />
      )}
      {toast != null && <Toast words={toast} onClose={() => setToast(null)} />}
    </section>
  );
}

function inListOrder(people: readonly EventPerson[]): EventPerson[] {
  return [...people].sort(
    (a, b) =>
      EVENT_ROLES.indexOf(a.role) - EVENT_ROLES.indexOf(b.role) ||
      a.user.name.localeCompare(b.user.name, currentLocale()),
  );
}

function RoleChoice({
  name,
  legend,
  picked,
  disabled,
  focusFirst,
  onPick,
  saying,
}: {
  name: string;
  legend: string;
  picked: EventRole;
  disabled: boolean;
  focusFirst?: boolean;
  onPick: (role: EventRole) => void;
  saying?: (role: EventRole) => string | null;
}) {
  const { t } = useTranslation();
  const focus = useCallback(
    (input: HTMLInputElement | null) => {
      if (focusFirst === true) input?.focus();
    },
    [focusFirst],
  );

  return (
    <fieldset className="members-roles">
      <legend>{legend}</legend>
      {EVENT_ROLES.map((role) => (
        <label key={role} className="members-role">
          <input
            ref={role === picked ? focus : undefined}
            type="radio"
            name={name}
            value={role}
            checked={picked === role}
            disabled={disabled}
            onChange={() => onPick(role)}
          />
          <span className="members-role-text">
            <span className="members-row-name">{t(`eventPeople.role.${role}`)}</span>
            <span className="muted">{t(`eventPeople.roleMeans.${role}`)}</span>
            {saying?.(role) != null && <span className="muted">{saying(role)}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** A role saves as it is picked and the dialog stays open, so a pick never changes the context by itself (WCAG 3.2.2). */
function RoleDialog({
  eventId,
  person,
  organisationName,
  onChanged,
  onRemoved,
  onClose,
}: {
  eventId: string;
  person: EventPerson;
  organisationName: string;
  onChanged: (person: EventPerson) => void;
  onRemoved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [saving, setSaving] = useState<'saving' | 'saved' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const name = person.user.name;

  useDialogKeys(dialog, onClose, removing);

  async function pick(role: EventRole): Promise<void> {
    const held = person.role;
    setPicked(role);
    setFailed(null);
    setSaving('saving');

    try {
      onChanged(await api.changeEventPerson(eventId, person.id, role));
      setSaving('saved');
    } catch (error) {
      setPicked(held);
      setSaving(null);
      setFailed(
        error instanceof ApiError && error.status !== 0 && error.status < 500
          ? error.problem.title
          : t('eventPeople.changeFailed', { name, role: t(`eventPeople.role.${held}`) }),
      );
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setRefused(null);

    try {
      await api.removeEventPerson(eventId, person.id);
      onRemoved();
    } catch (error) {
      setBusy(false);
      setRefused(error instanceof ApiError ? error.problem.title : t('eventPeople.removeFailed'));
    }
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-person-title"
      >
        <div className="dialog-heading">
          <h2 id="event-person-title">{name}</h2>
          <p>
            {[
              t('eventPeople.memberOf', { organisation: organisationName }),
              ...(person.jobLabel == null ? [] : [person.jobLabel]),
            ].join(' · ')}
          </p>
        </div>
        {failed != null && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <p>{failed}</p>
          </div>
        )}
        <RoleChoice
          name="event-person-role"
          legend={t('eventPeople.roleFor', { name })}
          picked={picked}
          disabled={saving === 'saving' || removing}
          focusFirst
          onPick={(role) => void pick(role)}
          saying={(role) =>
            role !== picked || saving == null
              ? null
              : t(saving === 'saving' ? 'eventPeople.saving' : 'eventPeople.saved')
          }
        />
        <p className="visually-hidden" role="status">
          {saving === 'saving'
            ? t('eventPeople.saving')
            : saving === 'saved'
              ? t('eventPeople.savedHeard', {
                  said: t(`eventPeople.nowOne.${picked}`, { name }),
                })
              : ''}
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-danger"
            disabled={saving === 'saving'}
            onClick={() => setRemoving(true)}
          >
            {t('eventPeople.remove')}
          </button>
          <button type="button" className="button button-primary" onClick={onClose}>
            {t('eventPeople.done')}
          </button>
        </div>
      </div>
      {removing && (
        <ConfirmDialog
          id="event-person-remove"
          title={t('eventPeople.removeTitle', { name })}
          keep={t('eventPeople.keep', { name })}
          go={t('eventPeople.removeConfirm')}
          pending={busy}
          stacks
          refusal={
            refused != null && <FieldError id="event-person-remove-refused" message={refused} />
          }
          onKeep={() => {
            setRefused(null);
            setRemoving(false);
          }}
          onGo={() => void remove()}
        >
          <p>{t('eventPeople.removeLine', { organisation: organisationName })}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

/** Members of the organisation only: someone from outside waits on sc-71's grant. */
function AddDialog({
  eventId,
  organisationName,
  members,
  onAdded,
  onClose,
}: {
  eventId: string;
  organisationName: string;
  members: OrganisationMember[];
  onAdded: (added: EventPerson[], role: EventRole) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<EventRole>('can_view');
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const wording = typed.trim().toLocaleLowerCase(currentLocale());
  const shown = members.filter(
    (member) =>
      ticked.includes(member.id) ||
      member.user.name.toLocaleLowerCase(currentLocale()).includes(wording),
  );
  const touched = ticked.length > 0 || typed.trim() !== '';
  const cancel = useCallback(() => (touched ? setDiscarding(true) : onClose()), [touched, onClose]);

  useDialogKeys(dialog, cancel, busy || discarding);

  async function add(): Promise<void> {
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
      setFailed(error instanceof ApiError ? error.problem.title : t('eventPeople.addFailed'));
    }
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-people-add-title"
      >
        <div className="dialog-heading">
          <h2 id="event-people-add-title">{t('eventPeople.addTitle')}</h2>
        </div>
        {failed != null && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <p>{failed}</p>
          </div>
        )}
        <RoleChoice
          name="event-people-add-role"
          legend={t('eventPeople.theirRole')}
          picked={role}
          disabled={busy}
          onPick={setRole}
        />
        <div className="field">
          <label htmlFor="event-people-find">{t('eventPeople.find')}</label>
          <input
            id="event-people-find"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={busy}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog opens to find somebody
            autoFocus
            onChange={(change) => setTyped(change.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <div role="status">
            <p className="members-row-name">
              {members.length === 0
                ? t('eventPeople.everyoneOn', { organisation: organisationName })
                : t('eventPeople.noMatch', { organisation: organisationName, typed: typed.trim() })}
            </p>
          </div>
        ) : (
          <fieldset className="members-roles">
            <legend>{t('eventPeople.inOrganisation', { organisation: organisationName })}</legend>
            {shown.map((member) => (
              // The name sits two spans down, deeper than the rule looks for a label's text.
              // eslint-disable-next-line jsx-a11y/label-has-associated-control
              <label key={member.id} className="members-role">
                <input
                  type="checkbox"
                  checked={ticked.includes(member.id)}
                  disabled={busy}
                  onChange={(change) =>
                    setTicked(
                      change.target.checked
                        ? [...ticked, member.id]
                        : ticked.filter((id) => id !== member.id),
                    )
                  }
                />
                <span className="members-role-text">
                  <span className="members-row-name">{member.user.name}</span>
                  <span className="muted">
                    {[
                      t(`eventPeople.orgRole.${member.role.seededAs ?? 'member'}`),
                      ...(member.self ? [t('eventPeople.youLower')] : []),
                    ].join(' · ')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="dialog-actions">
          <button type="button" className="link-button" disabled={busy} onClick={cancel}>
            {t('eventPeople.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            aria-busy={busy}
            {...offButton(ticked.length === 0 || busy)}
            onClick={() => void add()}
          >
            {t('eventPeople.addConfirm')}
          </button>
        </div>
      </div>
      {discarding && (
        <ConfirmDialog
          id="event-people-discard"
          title={t('eventPeople.discardTitle')}
          keep={t('eventPeople.discardKeep')}
          go={t('eventPeople.discard')}
          pending={false}
          onKeep={() => setDiscarding(false)}
          onGo={onClose}
        >
          <p>{t('eventPeople.discardLine')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
