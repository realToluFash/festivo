import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
  type SentInvitation,
  type Suspension as MemberSuspension,
} from '@soirely/api-client';
import {
  type MemberFilter,
  type MemberStanding,
  approvalRoles,
  emailProblem,
  formatDay,
  grantableRoles,
  historyLine,
  initials,
  memberHeldNoRole,
  memberIsShown,
  memberRowLine,
  memberStanding,
  memberStatusWord,
  roleName,
  withheldRoles,
} from '@soirely/domain';
import {
  type FormEvent,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { OwnerClaimBanner } from '../../../components/OwnerClaimBanner.tsx';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { offButton } from '../../../offButton.ts';
import { dateLocale, useShownLanguage } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';
import { focusStep, useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';
import { Forbidden } from '../Forbidden.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; retried: boolean }
  | { kind: 'loaded'; list: MembersList; roles: OrganisationRole[] };

/** What answering a request to join leaves on the list (sc-392): the done line and its next step. */
interface Answered {
  text: string;
  next: { label: string; member: string } | { label: string; filter: MemberFilter };
}

type View =
  | { kind: 'list'; flash: string | null; answered?: Answered }
  | { kind: 'member'; id: string }
  | { kind: 'invite'; email: string; roleId: string | null; again: string | null };

const FILTERS: readonly MemberFilter[] = [
  'all',
  'active',
  'invited',
  'waiting',
  'suspended',
  'former',
];

/** Settings > Members (sc-67): everybody who has been a member, and every invitation sent. */
export function Members() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const organisationId = organisation?.id;
  const manages = can(session, 'members.manage');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const retrying = useRef(false);
  const [heading, arriveAtHeading] = useStepFocus();
  const [failedLine, arriveAtFailed] = useStepFocus<HTMLParagraphElement>();

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;
    const askedAgain = loadedFor.current === organisationId;

    Promise.all([api.members(organisationId), api.roles(organisationId)]).then(
      ([list, catalogue]) => {
        if (!current) return;
        loadedFor.current = organisationId;
        setLoad({ kind: 'loaded', list, roles: catalogue.roles });
        if (retrying.current) arriveAtHeading();
        retrying.current = false;
      },
      () => {
        if (!current) return;
        const retried = retrying.current;
        retrying.current = false;
        setLoad((before) =>
          askedAgain && before.kind === 'loaded' ? before : { kind: 'failed', retried },
        );
        if (retried) arriveAtFailed();
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, language, arriveAtHeading, arriveAtFailed]);

  if (organisation == null) return null;
  if (!can(session, 'members.read')) return <Forbidden />;

  return (
    <div className="settings settings-wide">
      <SettingsSections />
      {load.kind === 'loading' && (
        <p className="muted" role="status">
          {t('membersScreen.loading')}
        </p>
      )}
      {load.kind === 'failed' && (
        <div className="notice notice-broken" role={load.retried ? undefined : 'alert'}>
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p ref={failedLine} tabIndex={load.retried ? -1 : undefined}>
              {t('membersScreen.failedLoad')}
            </p>
            <button
              type="button"
              className="button"
              onClick={() => {
                retrying.current = true;
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('rolesScreen.retry')}
            </button>
          </div>
        </div>
      )}
      {load.kind === 'loaded' && (
        <MembersLoaded
          key={organisation.id}
          organisation={organisation}
          list={load.list}
          roles={load.roles}
          manages={manages}
          headingRef={heading}
          onChange={(list) => setLoad({ ...load, list })}
        />
      )}
    </div>
  );
}

function MembersLoaded({
  organisation,
  list,
  roles,
  manages,
  headingRef,
  onChange,
}: {
  organisation: Membership;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (list: MembersList) => void;
}) {
  const [view, setView] = useState<View>({ kind: 'list', flash: null });
  const member = view.kind === 'member' ? list.members.find((one) => one.id === view.id) : null;
  const land = useFocusOnceShown();
  const inviteButton = useRef<HTMLButtonElement>(null);
  const flashNotice = useRef<HTMLDivElement>(null);

  function backToList(find: () => HTMLElement | null | undefined): void {
    setView({ kind: 'list', flash: null });
    land(() => find() ?? headingRef.current);
  }

  if (view.kind === 'invite') {
    const again = view.again;

    return (
      <Invite
        organisation={organisation}
        roles={grantableRoles(roles, organisation)}
        email={view.email}
        roleId={view.roleId}
        onCancel={() =>
          backToList(() =>
            again == null
              ? inviteButton.current
              : document.querySelector<HTMLElement>(`[data-invite-again="${again}"]`),
          )
        }
        onSent={(invitation, flash) => {
          onChange({
            ...list,
            invitations: [
              invitation,
              ...list.invitations.filter((one) => one.id !== invitation.id),
            ],
          });
          setView({ kind: 'list', flash });
          land(() => flashNotice.current);
        }}
      />
    );
  }

  if (member != null) {
    return (
      <MemberDetail
        key={member.id}
        organisation={organisation}
        member={member}
        list={list}
        roles={grantableRoles(roles, organisation)}
        withheld={withheldRoles(roles, organisation)}
        manages={manages}
        caller={list.members.find((one) => one.self)?.user.id ?? null}
        onChanged={onChange}
        onAnswered={(changed, answered) => {
          onChange(changed);
          setView({ kind: 'list', flash: null, answered });
        }}
        onBack={() =>
          backToList(() => document.querySelector<HTMLElement>(`[data-member="${member.id}"]`))
        }
        onBackToMembers={() => backToList(() => headingRef.current)}
      />
    );
  }

  return (
    <MembersOverview
      organisation={organisation}
      list={list}
      roles={grantableRoles(roles, organisation)}
      manages={manages}
      headingRef={headingRef}
      inviteRef={inviteButton}
      flashRef={flashNotice}
      flash={view.kind === 'list' ? view.flash : null}
      answered={view.kind === 'list' ? (view.answered ?? null) : null}
      onAnswered={(changed, answered) => {
        onChange(changed);
        setView({ kind: 'list', flash: null, answered });
      }}
      onOpen={(id) => setView({ kind: 'member', id })}
      onInvite={(email, roleId, again) => setView({ kind: 'invite', email, roleId, again })}
      onRevoked={(invitation) =>
        onChange({
          ...list,
          invitations: list.invitations.map((one) => (one.id === invitation.id ? invitation : one)),
        })
      }
    />
  );
}

function MembersOverview({
  organisation,
  list,
  roles,
  manages,
  headingRef,
  inviteRef,
  flashRef,
  flash,
  answered,
  onAnswered,
  onOpen,
  onInvite,
  onRevoked,
}: {
  organisation: Membership;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  inviteRef: RefObject<HTMLButtonElement | null>;
  flashRef: RefObject<HTMLDivElement | null>;
  flash: string | null;
  answered: Answered | null;
  onAnswered: (list: MembersList, answered: Answered) => void;
  onOpen: (id: string) => void;
  onInvite: (email: string, roleId: string | null, again: string | null) => void;
  onRevoked: (invitation: SentInvitation) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<MemberFilter>('all');
  const invitations = list.invitations.filter((one) => one.status !== 'accepted');
  const pending = invitations.filter((one) => one.status === 'pending').length;
  const shown = list.members.filter((member) => memberIsShown(member.status, filter));
  const waiting = list.members.filter((member) => member.status === 'pending_approval');
  const filters = FILTERS.filter((one) => manages || one !== 'waiting');
  const done = useRef<HTMLDivElement>(null);
  const listed = useRef<HTMLElement>(null);
  const land = useFocusOnceShown();

  useEffect(() => {
    if (answered != null) done.current?.focus();
  }, [answered]);

  const count = (one: MemberFilter) =>
    one === 'invited'
      ? pending
      : list.members.filter((member) => memberIsShown(member.status, one)).length;

  return (
    <div className="members">
      <div className="members-head">
        <h1 ref={headingRef} tabIndex={-1}>
          {t('membersScreen.title')}
        </h1>
        <p className="muted">
          {t('membersScreen.subtitle', {
            organisation: organisation.name,
            active: count('active'),
            invited: pending,
          })}
        </p>
        {manages && (
          <button
            ref={inviteRef}
            type="button"
            className="button button-primary"
            onClick={() => onInvite('', null, null)}
          >
            {t('membersScreen.invite')}
          </button>
        )}
      </div>

      {organisation.role.seededAs === 'administrator' && (
        <OwnerClaimBanner
          organisationId={organisation.id}
          organisation={organisation.name}
          pageHeading={headingRef}
        />
      )}

      {flash != null && (
        <div ref={flashRef} className="notice notice-done" tabIndex={-1}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{flash}</p>
        </div>
      )}

      {answered != null && (
        <div ref={done} className="notice notice-done" tabIndex={-1}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <div className="notice-body">
            <p>{answered.text}</p>
            <p className="notice-action">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  const next = answered.next;
                  if ('member' in next) onOpen(next.member);
                  else setFilter(next.filter);
                }}
              >
                {answered.next.label}
              </button>
            </p>
          </div>
        </div>
      )}

      {manages && waiting.length > 0 && (
        <section className="card members-awaiting" aria-labelledby="awaiting-title">
          <h2 id="awaiting-title">{t('membersScreen.awaiting.title')}</h2>
          <p className="muted">{t('membersScreen.awaiting.note')}</p>
          {waiting.map((member) => (
            <div key={member.id} className="members-request">
              <button
                type="button"
                className="members-row"
                data-member={member.id}
                onClick={() => onOpen(member.id)}
              >
                <span className="org-tile" aria-hidden="true">
                  {initials(member.user.name)}
                </span>
                <span className="members-row-text">
                  <span className="members-row-name">{member.user.name}</span>
                  {member.user.email != null && <span className="muted">{member.user.email}</span>}
                  <RequestLines organisation={organisation} member={member} />
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <JoinRequestAnswer
                organisation={organisation}
                member={member}
                roles={roles}
                onAnswered={onAnswered}
              />
            </div>
          ))}
        </section>
      )}

      <div className="members-chips" role="group" aria-label={t('membersScreen.show')}>
        {filters.map((one) => (
          <button
            key={one}
            type="button"
            className="chip"
            aria-pressed={filter === one}
            onClick={() => setFilter(one)}
          >
            <span>{t(`membersScreen.filter.${one}`)}</span>
            <span className="chip-count">{count(one)}</span>
          </button>
        ))}
      </div>

      {filter !== 'invited' && (
        <section ref={listed} className="card members-list" aria-label={t('membersScreen.shown')}>
          {shown.map((member) => (
            <MemberRow
              key={member.id}
              organisation={organisation}
              member={member}
              onOpen={() => onOpen(member.id)}
            />
          ))}
          {shown.length === 0 && (
            <div className="members-empty">
              <p className="notice-title">{t(`membersScreen.empty.${filter}.title`)}</p>
              {filter !== 'all' && (
                <p className="muted">
                  {t(`membersScreen.empty.${filter}.body`, { organisation: organisation.name })}
                </p>
              )}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setFilter('all');
                  land(
                    () =>
                      listed.current?.querySelector<HTMLElement>('.members-row') ??
                      headingRef.current,
                  );
                }}
              >
                {t('membersScreen.showEveryone')}
              </button>
            </div>
          )}
        </section>
      )}

      {(filter === 'all' || filter === 'invited') && (
        <section className="card members-invitations" aria-labelledby="invitations-title">
          <h2 id="invitations-title">{t('membersScreen.invitations')}</h2>
          <p className="muted">{t('membersScreen.invitationsNote')}</p>
          {invitations.length === 0 && <p className="muted">{t('membersScreen.noInvitations')}</p>}
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              organisation={organisation}
              invitation={invitation}
              caller={list.members.find((one) => one.self)?.user.id ?? null}
              manages={manages}
              onAgain={() => onInvite(invitation.email, invitation.role?.id ?? null, invitation.id)}
              onRevoked={onRevoked}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function MemberRow({
  organisation,
  member,
  onOpen,
}: {
  organisation: Membership;
  member: OrganisationMember;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const line = memberRowLine(t, member, organisation.name, (at) => formatDay(at, dateLocale()));
  const content = (
    <>
      <span className="org-tile" aria-hidden="true">
        {initials(member.user.name)}
      </span>
      <span className="members-row-text">
        <span className="members-row-name">{member.user.name}</span>
        <span className="muted">{line}</span>
        <span className="members-state" data-state={member.status}>
          {memberStatusWord(t, member)}
        </span>
      </span>
    </>
  );

  return (
    <button type="button" className="members-row" data-member={member.id} onClick={onOpen}>
      {content}
      <span aria-hidden="true">›</span>
    </button>
  );
}

function InvitationRow({
  organisation,
  invitation,
  caller,
  manages,
  onAgain,
  onRevoked,
}: {
  organisation: Membership;
  invitation: SentInvitation;
  caller: string | null;
  manages: boolean;
  onAgain: () => void;
  onRevoked: (invitation: SentInvitation) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const again = useRef<HTMLButtonElement>(null);
  const land = useFocusOnceShown();
  const day = (at: string | null) => (at == null ? '' : formatDay(at, dateLocale()));
  const ended: Record<string, string | null> = {
    pending: invitation.expiresAt,
    expired: invitation.expiresAt,
    revoked: invitation.revokedAt,
    declined: invitation.declinedAt,
  };

  async function revoke(): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      const revoked = await api.revokeInvitation(organisation.id, invitation.id);
      land(() => again.current);
      onRevoked(revoked);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="members-invitation">
      <span className="members-row-name">{invitation.email}</span>
      <span className="muted">
        {t('membersScreen.invitedAs', {
          role: invitation.role == null ? '' : roleName(t, invitation.role),
          inviter:
            invitation.invitedBy?.id === caller
              ? t('membersScreen.you')
              : (invitation.invitedBy?.name ?? ''),
        })}
      </span>
      <span className="muted">
        {t(`membersScreen.dates.${invitation.status}`, {
          sent: day(invitation.sentAt),
          ended: day(ended[invitation.status] ?? null),
        })}
      </span>
      <div className="members-invitation-foot">
        <span className="members-state" data-state={invitation.status}>
          {t(`membersScreen.invitationState.${invitation.status}`)}
        </span>
        {manages && invitation.status === 'pending' && (
          <button
            type="button"
            className="button"
            {...offButton(busy)}
            onClick={() => void revoke()}
          >
            {t('membersScreen.revoke')}
          </button>
        )}
        {manages && invitation.status !== 'pending' && (
          <button
            ref={again}
            type="button"
            className="button"
            data-invite-again={invitation.id}
            onClick={onAgain}
          >
            {t('membersScreen.inviteAgain')}
          </button>
        )}
      </div>
      {failed && (
        <FieldError id={`revoke-${invitation.id}`} message={t('membersScreen.revokeFailed')} />
      )}
    </div>
  );
}

type Removal = 'resting' | 'confirming' | 'removing' | 'removed';

type Suspending = 'resting' | 'confirming' | 'suspending';

/** What the last suspend or restore came to, said at the top of the member's page (sc-3575). */
type AccessOutcome =
  { kind: 'suspended' } | { kind: 'restored'; role: string } | { kind: 'conflict' };

function MemberDetail({
  organisation,
  member,
  list,
  roles,
  withheld,
  manages,
  caller,
  onChanged,
  onAnswered,
  onBack,
  onBackToMembers,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  withheld: OrganisationRole[];
  manages: boolean;
  caller: string | null;
  onChanged: (list: MembersList) => void;
  onAnswered: (list: MembersList, answered: Answered) => void;
  onBack: () => void;
  onBackToMembers: () => void;
}) {
  const { t } = useTranslation();
  const [removal, setRemoval] = useState<Removal>('resting');
  const [failed, setFailed] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [suspending, setSuspending] = useState<Suspending>('resting');
  const [suspendFailed, setSuspendFailed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AccessOutcome | null>(null);
  const said = useRef<HTMLDivElement>(null);
  const asking = useRef<HTMLHeadingElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const [removeTitle, arriveAtRemove] = useStepFocus();
  const land = useFocusOnceShown();
  const suspendButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const removeSuspended = useRef<HTMLButtonElement>(null);
  const removedNotice = useRef<HTMLDivElement>(null);
  const [removedRead, setRemovedRead] = useState(false);
  const restoredNotice = useRef<HTMLDivElement>(null);
  const callerOwns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.members, {
    owns: callerOwns,
    manages,
    withholds: withheld,
  });
  const waiting = member.status === 'pending_approval';
  const noRole = memberHeldNoRole(member);
  const onlyOwner = standing === 'suspendedOnlyOwner';
  const acts = (standing === 'manageable' || onlyOwner) && !waiting;
  const refusal = useRef<HTMLDivElement>(null);
  const owner = member.role.seededAs === 'owner';
  const active = member.status === 'active';
  const byHand = member.status === 'suspended' && member.suspension?.reason === 'manual';

  useLayoutEffect(() => focusStep(name.current), []);

  useEffect(() => {
    if (onlyOwner && failed != null) refusal.current?.focus();
  }, [onlyOwner, failed]);

  function confirmRemoving(): void {
    setRemoval('confirming');
    arriveAtRemove();
  }

  useEffect(() => {
    if (outcome != null) said.current?.focus();
  }, [outcome]);

  const askOpened = useRef(false);

  useEffect(() => {
    if (!askOpened.current) return;

    askOpened.current = false;
    asking.current?.focus();
  }, [suspending]);

  async function reload(): Promise<void> {
    onChanged(await api.members(organisation.id));
  }

  function changedElsewhere(): void {
    setOutcome({ kind: 'conflict' });
    reload().catch(() => undefined);
  }

  async function suspend(): Promise<void> {
    setSuspending('suspending');
    setSuspendFailed(null);

    try {
      await api.suspendMember(organisation.id, member.id);
      setSuspending('resting');
      setOutcome({ kind: 'suspended' });
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSuspending('resting');
        changedElsewhere();
      } else {
        setSuspending('confirming');
        setSuspendFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  async function remove(): Promise<void> {
    setRemoval('removing');
    setFailed(null);

    try {
      await api.removeMember(organisation.id, member.id);
      setRemoval('removed');
      land(() => removedNotice.current);
      onChanged(await api.members(organisation.id));
    } catch (error) {
      setRemoval(onlyOwner ? 'resting' : 'confirming');
      setFailed(error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'));
    }
  }

  if (removal === 'removed') {
    return (
      <div className="members">
        <div
          ref={removedNotice}
          className="notice notice-done"
          tabIndex={-1}
          aria-describedby={removedRead ? undefined : 'member-removed-next'}
          onBlur={() => setRemovedRead(true)}
        >
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>
            {t('membersScreen.removed', {
              name: member.user.name,
              organisation: organisation.name,
            })}
          </p>
        </div>
        <p id="member-removed-next" className="muted">
          {t('membersScreen.removedNext')}
        </p>
        <button type="button" className="link-button" onClick={onBackToMembers}>
          {t('membersScreen.backToMembers')}
        </button>
      </div>
    );
  }

  const steps = member.history.map((step) => {
    const line = historyLine({ ...step, by: step.by?.id ?? null }, member.user.id);
    const by =
      step.by == null
        ? t('membersScreen.someone')
        : step.by.id === caller
          ? t('membersScreen.byYou')
          : step.by.name;

    return {
      what: t(`membersScreen.history.${line.key}`, { organisation: organisation.name, by }),
      at: step.at,
    };
  });
  const invited =
    member.invitedBy != null && member.invitedAt != null
      ? [
          {
            what: t('membersScreen.history.invitedBy', { by: member.invitedBy.name }),
            at: member.invitedAt,
          },
        ]
      : [];
  const history = [...invited, ...steps].sort(
    (one, other) => Date.parse(one.at) - Date.parse(other.at),
  );

  return (
    <div className="members">
      <button type="button" className="link-button members-back" onClick={onBack}>
        <span aria-hidden="true">‹ </span>
        {t('membersScreen.title')}
      </button>
      <div className="members-person">
        <span className="org-tile" aria-hidden="true">
          {initials(member.user.name)}
        </span>
        <div className="org-naming">
          <h1 ref={name} tabIndex={-1}>
            {member.user.name}
          </h1>
          <p className="muted">
            {member.self
              ? t('membersScreen.youAs', { role: roleName(t, member.role) })
              : `${noRole ? t('membersScreen.noRoleYet') : roleName(t, member.role)} · ${memberStatusWord(t, member)}`}
          </p>
          {member.user.email != null && <p className="muted">{member.user.email}</p>}
        </div>
      </div>
      {outcome != null && (
        <AccessNotice
          ref={said}
          outcome={outcome}
          name={member.user.name}
          organisation={organisation.name}
        />
      )}
      <section className="card" aria-labelledby="role-title">
        <h2 id="role-title">{t('membersScreen.roleTitle')}</h2>
        {waiting ? (
          <>
            <p className="members-row-name">{t('membersScreen.noRoleYet')}</p>
            <RequestLines organisation={organisation} member={member} />
            {manages && (
              <JoinRequestAnswer
                organisation={organisation}
                member={member}
                roles={roles}
                onAnswered={onAnswered}
              />
            )}
          </>
        ) : noRole ? (
          <p className="members-row-name">{t('membersScreen.noRoleYet')}</p>
        ) : member.self ? (
          <>
            <p className="members-row-name">{roleName(t, member.role)}</p>
            <p className="muted">{t('membersScreen.ownRole')}</p>
            <Link className="link-button" to="/app/settings">
              {t('membersScreen.goToGeneral')}
            </Link>
          </>
        ) : standing === 'onlyOwner' ? (
          <>
            <p className="members-row-name">{roleName(t, member.role)}</p>
            <div className="notice notice-quiet">
              <span className="mark mark-info" aria-hidden="true">
                i
              </span>
              <p>{t('membersScreen.onlyOwner', { name: member.user.name })}</p>
            </div>
            {!callerOwns && (
              <p className="muted">{t('membersScreen.askOwner', { name: member.user.name })}</p>
            )}
          </>
        ) : member.status === 'suspended' && standing === 'manageable' ? (
          <>
            <p className="members-row-name">{roleName(t, member.role)}</p>
            <p className="muted">{t('membersScreen.roleKeptWhileSuspended')}</p>
          </>
        ) : standing !== 'manageable' ? (
          <>
            <p className="members-row-name">{roleName(t, member.role)}</p>
            {member.suspension == null && <FixedLine standing={standing} />}
          </>
        ) : (
          <RolePicker
            organisation={organisation}
            member={member}
            roles={roles}
            onChanged={onChanged}
            onChangedElsewhere={changedElsewhere}
          />
        )}
      </section>

      <section className="card" aria-labelledby="history-title">
        <h2 id="history-title">{t('membersScreen.howTheyGotHere')}</h2>
        <ul className="members-history">
          {history.map((step, index) => (
            <li key={index}>
              <span>{step.what}</span>
              <span className="muted">{formatDay(step.at, dateLocale())}</span>
            </li>
          ))}
        </ul>
      </section>

      {restored ? (
        <div ref={restoredNotice} className="notice notice-done" tabIndex={-1}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>
            {t('membersScreen.restored', {
              name: member.user.name,
              organisation: organisation.name,
            })}
          </p>
        </div>
      ) : (
        member.suspension != null &&
        (!byHand || removal === 'resting') && (
          <Suspension
            organisation={organisation}
            member={member}
            suspension={member.suspension}
            standing={standing}
            acts={acts}
            removeRef={removeSuspended}
            onRestored={() => {
              if (byHand) {
                setOutcome({ kind: 'restored', role: roleName(t, member.role) });
              } else {
                setRestored(true);
                land(() => restoredNotice.current);
              }
            }}
            onChangedElsewhere={changedElsewhere}
            onRemove={confirmRemoving}
            onMembers={onBack}
            onChanged={onChanged}
          />
        )
      )}

      {manages && !member.self && owner && active && (
        <div className="notice notice-quiet">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <p>{t('membersScreen.ownerNoSuspend', { name: member.user.name })}</p>
        </div>
      )}

      {standing === 'manageable' && active && !owner && (
        <section className="card" aria-labelledby="suspend-title">
          {suspending === 'resting' ? (
            <>
              <h2 id="suspend-title">
                {t('membersScreen.suspendTitle', { name: member.user.name })}
              </h2>
              <p className="muted">
                {t('membersScreen.suspendBody', { organisation: organisation.name })}
              </p>
              <button
                ref={suspendButton}
                type="button"
                className="button"
                onClick={() => {
                  askOpened.current = true;
                  setSuspending('confirming');
                }}
              >
                {t('membersScreen.suspendButton')}
              </button>
            </>
          ) : (
            <>
              <h2 id="suspend-title" ref={asking} tabIndex={-1}>
                {t('membersScreen.suspendConfirmTitle', { name: member.user.name })}
              </h2>
              <p>
                {t('membersScreen.suspendConfirmBody', {
                  name: member.user.name,
                  organisation: organisation.name,
                })}
              </p>
              <p className="muted">{t('membersScreen.suspendConfirmEmail')}</p>
              {suspendFailed != null && <FieldError id="suspend-failed" message={suspendFailed} />}
              <div className="actions">
                <button
                  type="button"
                  className="button button-dark"
                  aria-busy={suspending === 'suspending'}
                  {...offButton(suspending === 'suspending')}
                  onClick={() => void suspend()}
                >
                  {t('membersScreen.suspendConfirm', { name: member.user.name })}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSuspendFailed(null);
                    setSuspending('resting');
                    land(() => suspendButton.current);
                  }}
                >
                  {t('membersScreen.suspendKeep', { name: member.user.name })}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {acts && (!byHand || removal !== 'resting') && (
        <section className="card" aria-labelledby="remove-title">
          {removal === 'resting' || (onlyOwner && removal === 'removing') ? (
            <>
              <h2 id="remove-title">
                {t('membersScreen.removeTitle', { name: member.user.name })}
              </h2>
              <p className="muted">
                {t('membersScreen.removeBody', { organisation: organisation.name })}
              </p>
              {onlyOwner && failed != null && (
                <div ref={refusal} tabIndex={-1}>
                  <FieldError id="remove-failed" message={failed}>
                    <p className="muted">
                      {t('membersScreen.onlyOwnerNotRemovable', { name: member.user.name })}
                    </p>
                    {member.suspension?.reason === 'address_gone' && (
                      <p className="muted">
                        {t('membersScreen.onlyOwnerRestoreNeedsAddress', {
                          domain: member.suspension.domain ?? '',
                        })}
                      </p>
                    )}
                  </FieldError>
                </div>
              )}
              <button
                ref={removeButton}
                type="button"
                className="button button-danger"
                aria-busy={removal === 'removing'}
                {...offButton(removal === 'removing')}
                onClick={() => (onlyOwner ? void remove() : confirmRemoving())}
              >
                {t('membersScreen.removeButton', { organisation: organisation.name })}
              </button>
            </>
          ) : (
            <>
              <h2 id="remove-title" ref={removeTitle} tabIndex={-1}>
                {t('membersScreen.removeConfirmTitle', { name: member.user.name })}
              </h2>
              <p>
                {t(
                  byHand ? 'membersScreen.suspendedRemoveBody' : 'membersScreen.removeConfirmBody',
                  {
                    name: member.user.name,
                    organisation: organisation.name,
                  },
                )}
              </p>
              {failed != null && <FieldError id="remove-failed" message={failed} />}
              <div className="actions">
                <button
                  type="button"
                  className="button button-danger"
                  aria-busy={removal === 'removing'}
                  {...offButton(removal === 'removing')}
                  onClick={() => void remove()}
                >
                  {t('membersScreen.removeConfirm', { name: member.user.name })}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setFailed(null);
                    setRemoval('resting');
                    land(() => (byHand ? removeSuspended.current : removeButton.current));
                  }}
                >
                  {byHand
                    ? t('membersScreen.suspendedRemoveKeep')
                    : t('membersScreen.removeKeep', { name: member.user.name })}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Suspended by the company domain (sc-564), Remove below, or by hand (sc-3575), Remove in the card; read-only to a viewer who can't act. */
function Suspension({
  organisation,
  member,
  suspension,
  standing,
  acts,
  removeRef,
  onRestored,
  onChangedElsewhere,
  onRemove,
  onMembers,
  onChanged,
}: {
  organisation: Membership;
  member: OrganisationMember;
  suspension: MemberSuspension;
  standing: MemberStanding;
  acts: boolean;
  removeRef: RefObject<HTMLButtonElement | null>;
  onRestored: () => void;
  onChangedElsewhere: () => void;
  onRemove: () => void;
  onMembers: () => void;
  onChanged: (list: MembersList) => void;
}) {
  const { t } = useTranslation();
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [seats, setSeats] = useState<number | null>(null);
  const byHand = suspension.reason === 'manual';
  const named = {
    name: member.user.name,
    organisation: organisation.name,
    domain: suspension.domain ?? '',
  };

  async function restore(): Promise<void> {
    setRestoring(true);
    setFailed(null);
    setSeats(null);

    try {
      await api.restoreMember(organisation.id, member.id);
      // Told by the member page: once the list reloads unsuspended, this card is gone (sc-564).
      onRestored();
      onChanged(await api.members(organisation.id));
    } catch (error) {
      setRestoring(false);

      if (error instanceof ApiError && error.is('team_seats_in_use')) {
        setSeats(error.problem.limit ?? 0);
      } else if (error instanceof ApiError && error.is('restore_needs_address')) {
        setFailed(t('membersScreen.restoreNeedsAddress', named));
      } else if (error instanceof ApiError && error.status === 409) {
        onChangedElsewhere();
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  return (
    <section className="card" aria-labelledby="suspension-title">
      {byHand ? (
        <>
          <h2 id="suspension-title">{t('membersScreen.suspendedTitle', named)}</h2>
          <p className="muted">{t('membersScreen.suspendedBody', named)}</p>
          {acts && (
            <p className="muted">
              {t('membersScreen.suspendedRestoreNote', { role: roleName(t, member.role) })}
            </p>
          )}
        </>
      ) : (
        <>
          <h2 id="suspension-title">
            <span className="mark mark-attention" aria-hidden="true">
              !
            </span>{' '}
            {t('membersScreen.state.domainSuspended')}
          </h2>
          <p>{t(`membersScreen.suspendedBecause.${suspension.reason}`, named)}</p>
          {suspension.onlyOwner ? (
            <p className="muted">{t('membersScreen.suspendedOnlyOwner', named)}</p>
          ) : (
            suspension.removesAt != null && (
              <p className="muted">
                {t('membersScreen.suspendedRemovedOn', { when: suspension.removesAt.written })}
              </p>
            )
          )}
        </>
      )}
      {seats != null && (
        <SeatsInUse
          name={member.user.name}
          limit={seats}
          owns={organisation.role.seededAs === 'owner'}
          onMembers={onMembers}
        />
      )}
      {failed != null && <FieldError id="restore-failed" message={failed} />}
      {acts ? (
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            aria-busy={restoring}
            {...offButton(restoring)}
            onClick={() => void restore()}
          >
            {t(byHand ? 'membersScreen.restoreAccess' : 'membersScreen.restore', named)}
          </button>
          {byHand && (
            <button
              ref={removeRef}
              type="button"
              className="button button-danger"
              onClick={onRemove}
            >
              {t('membersScreen.removeTitle', named)}
            </button>
          )}
        </div>
      ) : (
        <FixedLine standing={standing} />
      )}
    </section>
  );
}

/** Why a manager can't change this member: an owner's role, or one holding what the viewer lacks (sc-11160). */
function FixedLine({ standing }: { standing: MemberStanding }) {
  const { t } = useTranslation();

  if (standing === 'ownerOnly') return <p className="muted">{t('membersScreen.ownerOnly')}</p>;
  if (standing === 'beyondGrant') return <p className="muted">{t('membersScreen.beyondGrant')}</p>;

  return null;
}

/** Restore refused at the seat limit (sc-3575): the reason, the way through, and why suspending frees a seat. */
function SeatsInUse({
  name,
  limit,
  owns,
  onMembers,
}: {
  name: string;
  limit: number;
  owns: boolean;
  onMembers: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="notice notice-broken" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p className="notice-title">{t('membersScreen.seatsInUse', { count: limit })}</p>
        <p>
          {owns
            ? t('membersScreen.seatsWayOwner', { name })
            : t('membersScreen.seatsWayAdmin', { name })}
        </p>
        <div className="actions">
          <button type="button" className="link-button" onClick={onMembers}>
            {t('membersScreen.seatsOpenMembers')}
          </button>
        </div>
        <p className="muted">{t('membersScreen.seatsSuspendedFree')}</p>
      </div>
    </div>
  );
}

/** The status line after a suspend or restore, or the 409 when somebody else got there first; focus moves to it. */
function AccessNotice({
  ref,
  outcome,
  name,
  organisation,
}: {
  ref: Ref<HTMLDivElement>;
  outcome: AccessOutcome;
  name: string;
  organisation: string;
}) {
  const { t } = useTranslation();

  if (outcome.kind === 'conflict') {
    return (
      <div ref={ref} tabIndex={-1} className="notice notice-quiet">
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <p>{t('membersScreen.accessConflict', { name })}</p>
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} className="notice notice-done">
      <span className="mark mark-done" aria-hidden="true">
        ✓
      </span>
      <div className="notice-body">
        <p className="notice-title">
          {outcome.kind === 'suspended'
            ? t('membersScreen.suspendedNow', { name })
            : t('membersScreen.restoredNow', { name, role: outcome.role })}
        </p>
        <p>
          {outcome.kind === 'suspended'
            ? t('membersScreen.suspendedNowNext', { organisation })
            : t('membersScreen.restoredNowNext', { organisation })}
        </p>
      </div>
    </div>
  );
}

/** How and when somebody asked, and the instant their request is removed, as the server wrote it for the reader. */
function RequestLines({
  organisation,
  member,
}: {
  organisation: Membership;
  member: OrganisationMember;
}) {
  const { t } = useTranslation();

  return (
    <>
      <span className="muted">
        {t('membersScreen.awaiting.asked', {
          channel: t(`membersScreen.how.${member.channel ?? 'request'}`, {
            organisation: organisation.name,
          }),
          date: member.since == null ? '' : formatDay(member.since, dateLocale()),
        })}
      </span>
      {member.removesAt != null && (
        <span className="muted">
          {t('membersScreen.awaiting.removes', { deadline: member.removesAt.written })}
        </span>
      )}
    </>
  );
}

type Answering = 'resting' | 'approving' | 'turningDown';

/** Approve, with a role that starts on Read-only and always has a value, or Turn down, asked first (sc-392). */
function JoinRequestAnswer({
  organisation,
  member,
  roles,
  onAnswered,
}: {
  organisation: Membership;
  member: OrganisationMember;
  roles: OrganisationRole[];
  onAnswered: (list: MembersList, answered: Answered) => void;
}) {
  const { t } = useTranslation();
  const offered = approvalRoles(roles);
  const [answering, setAnswering] = useState<Answering>('resting');
  const [picked, setPicked] = useState(offered[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [left, setLeft] = useState<Answering | null>(null);
  const role = offered.find((one) => one.id === picked);
  const name = member.user.name;
  const step = useCallback((element: HTMLElement | null) => element?.focus(), []);

  async function answer(): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      if (answering === 'approving' && role != null) {
        await api.approveMember(organisation.id, member.id, role.id);
        onAnswered(await api.members(organisation.id), {
          text: t('membersScreen.awaiting.approved', { name, role: roleName(t, role) }),
          next: { label: t('membersScreen.awaiting.approvedNext', { name }), member: member.id },
        });
      } else {
        await api.turnDownMember(organisation.id, member.id);
        onAnswered(await api.members(organisation.id), {
          text: t('membersScreen.awaiting.turnedDown', { name }),
          next: { label: t('membersScreen.awaiting.turnedDownNext'), filter: 'former' },
        });
      }
    } catch (error) {
      setBusy(false);
      setFailed(
        error instanceof ApiError
          ? (error.problem.violations?.find((one) => one.propertyPath === 'roleId')?.message ??
              error.problem.title)
          : t('membersScreen.actionFailed'),
      );
    }
  }

  function open(next: Answering): void {
    setLeft(null);
    setAnswering(next);
  }

  function back(): void {
    setFailed(null);
    setLeft(answering);
    setAnswering('resting');
  }

  if (answering === 'resting') {
    return (
      <div className="actions">
        <button
          ref={left === 'approving' ? step : undefined}
          type="button"
          className="button button-primary"
          onClick={() => open('approving')}
        >
          {t('membersScreen.awaiting.approve')}
        </button>
        <button
          ref={left === 'turningDown' ? step : undefined}
          type="button"
          className="button"
          onClick={() => open('turningDown')}
        >
          {t('membersScreen.awaiting.turnDown')}
        </button>
      </div>
    );
  }

  if (answering === 'turningDown') {
    return (
      <div className="members-answer">
        <h3 ref={step} tabIndex={-1}>
          {t('membersScreen.awaiting.turnDownTitle', { name })}
        </h3>
        <p>{t('membersScreen.awaiting.turnDownBody', { name, organisation: organisation.name })}</p>
        {failed != null && <FieldError id={`turn-down-${member.id}`} message={failed} />}
        <div className="actions">
          <button
            type="button"
            className="button button-danger"
            aria-busy={busy}
            {...offButton(busy)}
            onClick={() => void answer()}
          >
            {t('membersScreen.awaiting.turnDownConfirm', { name })}
          </button>
          <button type="button" className="button" disabled={busy} onClick={back}>
            {t('membersScreen.awaiting.keep')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="members-answer">
      <fieldset className="members-roles">
        <legend>{t('membersScreen.awaiting.roleFor', { name })}</legend>
        {offered.map((one) => (
          <label key={one.id} className="members-role">
            <input
              ref={picked === one.id ? step : undefined}
              type="radio"
              name={`approve-role-${member.id}`}
              value={one.id}
              checked={picked === one.id}
              disabled={busy}
              onChange={() => setPicked(one.id)}
            />
            <span className="members-role-text">
              <span className="members-row-name">{roleName(t, one)}</span>
              {one.seededAs != null && (
                <span className="muted">{t(`membersScreen.roleMeans.${one.seededAs}`)}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      {failed != null && <FieldError id={`approve-${member.id}`} message={failed} />}
      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          aria-busy={busy}
          disabled={role == null}
          {...offButton(busy)}
          onClick={() => void answer()}
        >
          {t('membersScreen.awaiting.approveAs', { role: role == null ? '' : roleName(t, role) })}
        </button>
        <button type="button" className="button" disabled={busy} onClick={back}>
          {t('membersScreen.awaiting.cancel')}
        </button>
      </div>
    </div>
  );
}

function RolePicker({
  organisation,
  member,
  roles,
  onChanged,
  onChangedElsewhere,
}: {
  organisation: Membership;
  member: OrganisationMember;
  roles: OrganisationRole[];
  onChanged: (list: MembersList) => void;
  onChangedElsewhere: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(member.role.id);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const offered = roles.some((one) => one.id === member.role.id)
    ? roles
    : [
        {
          ...member.role,
          fixed: false,
          removable: false,
          permissions: [],
          holders: 0,
          holderNames: [],
        },
        ...roles,
      ];
  const role = offered.find((one) => one.id === picked);
  const changed = picked !== member.role.id && role != null;

  async function save(): Promise<void> {
    if (!changed) return;

    setBusy(true);
    setFailed(null);

    try {
      await api.changeMemberRole(organisation.id, member.id, picked);
      setDone(t('membersScreen.roleChanged', { name: member.user.name, role: roleName(t, role) }));
      onChanged(await api.members(organisation.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        onChangedElsewhere();
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {done != null && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{done}</p>
        </div>
      )}
      <fieldset className="members-roles">
        <legend>{t('membersScreen.roleFor', { name: member.user.name })}</legend>
        {offered.map((one) => (
          <label key={one.id} className="members-role">
            <input
              type="radio"
              name="member-role"
              value={one.id}
              checked={picked === one.id}
              disabled={busy}
              onChange={() => {
                setDone(null);
                setPicked(one.id);
              }}
            />
            <span className="members-role-text">
              <span className="members-row-name">{roleName(t, one)}</span>
              {one.seededAs != null && (
                <span className="muted">{t(`membersScreen.roleMeans.${one.seededAs}`)}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <Link className="link-button" to="/app/settings/roles">
        {t('membersScreen.seeRoles')}
      </Link>
      <p className="muted">{t('membersScreen.roleTakesEffect')}</p>
      {failed != null && <FieldError id="role-failed" message={failed} />}
      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          aria-busy={busy}
          {...offButton(!changed || busy)}
          onClick={() => void save()}
        >
          {changed
            ? t('membersScreen.roleSave', { role: roleName(t, role) })
            : t('membersScreen.rolePick')}
        </button>
      </div>
    </>
  );
}

function Invite({
  organisation,
  roles,
  email,
  roleId,
  onCancel,
  onSent,
}: {
  organisation: Membership;
  roles: OrganisationRole[];
  email: string;
  roleId: string | null;
  onCancel: () => void;
  onSent: (invitation: SentInvitation, flash: string) => void;
}) {
  const { t } = useTranslation();
  const startingRole =
    roles.find((role) => role.id === roleId) ??
    roles.find((role) => role.seededAs === 'coordinator') ??
    roles[0];
  const [picked, setPicked] = useState(startingRole?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const role = roles.find((one) => one.id === picked);
  const check = useCallback(
    (_field: 'email', value: string) => {
      const problem = emailProblem(value);
      if (problem == null) return null;

      return problem === 'blank' ? t('membersScreen.emailBlank') : t('membersScreen.emailShape');
    },
    [t],
  );
  const checks = useFormChecks(['email'] as const, check, () =>
    document.getElementById('invite-email')?.focus(),
  );
  const emailError = checks.errors.email ?? refused;
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => focusStep(heading.current), []);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('email') ?? '');

    if (!checks.passes({ email: typed }) || role == null) return;

    setBusy(true);
    setRefused(null);
    setFailed(null);

    try {
      const invitation = await api.inviteMember(organisation.id, typed.trim(), role.id);
      onSent(invitation, t('membersScreen.sent', { email: invitation.email }));
    } catch (error) {
      setBusy(false);

      if (
        error instanceof ApiError &&
        (error.is('already_a_member') || error.is('validation_failed'))
      ) {
        const violation = error.problem.violations?.find((one) => one.propertyPath === 'email');
        setRefused(violation?.message ?? error.problem.title);
        document.getElementById('invite-email')?.focus();
      } else if (error instanceof ApiError && error.is('grant_not_held')) {
        setFailed(error.problem.title);
      } else {
        setFailed(t('membersScreen.sendFailed'));
      }
    }
  }

  return (
    <div className="members">
      <button type="button" className="link-button members-back" onClick={onCancel}>
        <span aria-hidden="true">‹ </span>
        {t('membersScreen.title')}
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {t('membersScreen.invite')}
      </h1>
      <p className="muted">{organisation.name}</p>

      {failed != null && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{failed}</p>
        </div>
      )}

      <form className="card settings-form" noValidate onSubmit={(event) => void send(event)}>
        <h2>{t('membersScreen.whoToInvite')}</h2>
        <div className="field">
          <label htmlFor="invite-email">{t('register.email')}</label>
          <input
            className={emailError != null ? 'input input-wrong' : 'input'}
            id="invite-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={email}
            disabled={busy}
            aria-invalid={emailError != null}
            aria-describedby={emailError != null ? 'invite-email-error' : undefined}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => {
              setRefused(null);
              checks.edited('email', event.target.value);
            }}
          />
          {emailError != null && <FieldError id="invite-email-error" message={emailError} />}
        </div>

        <fieldset className="members-roles">
          <legend>{t('membersScreen.role')}</legend>
          {roles.map((one) => (
            <label key={one.id} className="members-role">
              <input
                type="radio"
                name="role"
                value={one.id}
                checked={picked === one.id}
                disabled={busy}
                onChange={() => setPicked(one.id)}
              />
              <span className="members-role-text">
                <span className="members-row-name">{roleName(t, one)}</span>
                {one.seededAs != null && (
                  <span className="muted">{t(`membersScreen.roleMeans.${one.seededAs}`)}</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="muted">
          {t('membersScreen.inviteNote', {
            organisation: organisation.name,
            role: role == null ? '' : roleName(t, role),
          })}
        </p>

        <div className="actions">
          <button className="button button-primary" type="submit" aria-busy={busy}>
            {t('membersScreen.send')}
          </button>
          <button className="button" type="button" onClick={onCancel}>
            {t('membersScreen.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
