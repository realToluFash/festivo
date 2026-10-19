import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
  type SentInvitation,
} from '@soirely/api-client';
import {
  type MemberFilter,
  emailProblem,
  formatDay,
  historyLine,
  initials,
  memberIsShown,
  roleName,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; list: MembersList; roles: OrganisationRole[] };

type View =
  | { kind: 'list'; flash: string | null }
  | { kind: 'member'; id: string }
  | { kind: 'invite'; email: string; roleId: string | null };

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

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    Promise.all([api.members(organisationId), api.roles(organisationId)]).then(
      ([list, catalogue]) => current && setLoad({ kind: 'loaded', list, roles: catalogue.roles }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

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
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('membersScreen.failedLoad')}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
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
  onChange,
}: {
  organisation: Membership;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  onChange: (list: MembersList) => void;
}) {
  const [view, setView] = useState<View>({ kind: 'list', flash: null });
  const member = view.kind === 'member' ? list.members.find((one) => one.id === view.id) : null;

  if (view.kind === 'invite') {
    return (
      <Invite
        organisation={organisation}
        roles={grantable(roles, organisation)}
        email={view.email}
        roleId={view.roleId}
        onCancel={() => setView({ kind: 'list', flash: null })}
        onSent={(invitation, flash) => {
          onChange({
            ...list,
            invitations: [
              invitation,
              ...list.invitations.filter((one) => one.id !== invitation.id),
            ],
          });
          setView({ kind: 'list', flash });
        }}
      />
    );
  }

  if (member != null) {
    return (
      <MemberDetail
        organisation={organisation}
        member={member}
        caller={list.members.find((one) => one.self)?.user.id ?? null}
        onBack={() => setView({ kind: 'list', flash: null })}
      />
    );
  }

  return (
    <MembersOverview
      organisation={organisation}
      list={list}
      manages={manages}
      flash={view.kind === 'list' ? view.flash : null}
      onOpen={(id) => setView({ kind: 'member', id })}
      onInvite={(email, roleId) => setView({ kind: 'invite', email, roleId })}
      onRevoked={(invitation) =>
        onChange({
          ...list,
          invitations: list.invitations.map((one) => (one.id === invitation.id ? invitation : one)),
        })
      }
    />
  );
}

/** The inviter may grant only what they hold, and only an owner makes an owner, as the API refuses otherwise. */
function grantable(roles: OrganisationRole[], organisation: Membership): OrganisationRole[] {
  const owner = organisation.role.seededAs === 'owner';

  return roles.filter(
    (role) =>
      (owner || role.seededAs !== 'owner') &&
      role.permissions.every((permission) => organisation.permissions.includes(permission)),
  );
}

function MembersOverview({
  organisation,
  list,
  manages,
  flash,
  onOpen,
  onInvite,
  onRevoked,
}: {
  organisation: Membership;
  list: MembersList;
  manages: boolean;
  flash: string | null;
  onOpen: (id: string) => void;
  onInvite: (email: string, roleId: string | null) => void;
  onRevoked: (invitation: SentInvitation) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<MemberFilter>('all');
  const invitations = list.invitations.filter((one) => one.status !== 'accepted');
  const pending = invitations.filter((one) => one.status === 'pending').length;
  const shown = list.members.filter((member) => memberIsShown(member.status, filter));
  const filters = FILTERS.filter((one) => manages || one !== 'waiting');
  const count = (one: MemberFilter) =>
    one === 'invited'
      ? pending
      : list.members.filter((member) => memberIsShown(member.status, one)).length;

  return (
    <div className="members">
      <div className="members-head">
        <h1>{t('membersScreen.title')}</h1>
        <p className="muted">
          {t('membersScreen.subtitle', {
            organisation: organisation.name,
            active: count('active'),
            invited: pending,
          })}
        </p>
        {manages && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => onInvite('', null)}
          >
            {t('membersScreen.invite')}
          </button>
        )}
      </div>

      {flash != null && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{flash}</p>
        </div>
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
        <section className="card members-list" aria-label={t('membersScreen.shown')}>
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
              <button type="button" className="link-button" onClick={() => setFilter('all')}>
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
              onAgain={() => onInvite(invitation.email, invitation.role?.id ?? null)}
              onRevoked={onRevoked}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function statusWord(t: TFunction, member: OrganisationMember): string {
  if (member.status === 'left_or_removed')
    return t(`membersScreen.state.${member.former ?? 'removed'}`);

  return t(`membersScreen.state.${member.status}`);
}

function channelWords(t: TFunction, member: OrganisationMember, organisation: string): string {
  if (member.channel === 'invitation' && member.invitedBy != null) {
    return t('membersScreen.how.invitationFrom', { inviter: member.invitedBy.name });
  }

  return t(`membersScreen.how.${member.channel ?? 'invitation'}`, { organisation });
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
  const former = member.status === 'left_or_removed';
  const when = member.since == null ? '' : formatDay(member.since, currentLocale());
  const verb =
    member.status === 'pending_approval'
      ? 'asked'
      : member.status === 'suspended'
        ? 'suspended'
        : former
          ? (member.former ?? 'removed')
          : 'since';
  const line = [
    roleName(t, member.role),
    ...(member.self ? [t('membersScreen.you')] : []),
    channelWords(t, member, organisation.name),
    t(`membersScreen.when.${verb}`, { date: when }),
  ].join(' · ');
  const content = (
    <>
      <span className="org-tile" aria-hidden="true">
        {initials(member.user.name)}
      </span>
      <span className="members-row-text">
        <span className="members-row-name">{member.user.name}</span>
        <span className="muted">{line}</span>
        <span className="members-state" data-state={member.status}>
          {statusWord(t, member)}
        </span>
      </span>
    </>
  );

  return former ? (
    <div className="members-row">{content}</div>
  ) : (
    <button type="button" className="members-row" onClick={onOpen}>
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
  const day = (at: string | null) => (at == null ? '' : formatDay(at, currentLocale()));
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
      onRevoked(await api.revokeInvitation(organisation.id, invitation.id));
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
          <button type="button" className="button" disabled={busy} onClick={() => void revoke()}>
            {t('membersScreen.revoke')}
          </button>
        )}
        {manages && invitation.status !== 'pending' && (
          <button type="button" className="button" onClick={onAgain}>
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

function MemberDetail({
  organisation,
  member,
  caller,
  onBack,
}: {
  organisation: Membership;
  member: OrganisationMember;
  caller: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
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
      when: formatDay(step.at, currentLocale()),
    };
  });
  const invited =
    member.invitedBy != null && member.invitedAt != null
      ? [
          {
            what: t('membersScreen.history.invitedBy', { by: member.invitedBy.name }),
            when: formatDay(member.invitedAt, currentLocale()),
          },
        ]
      : [];

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
          <h1>{member.user.name}</h1>
          <p className="muted">
            {member.self
              ? t('membersScreen.youAs', { role: roleName(t, member.role) })
              : `${roleName(t, member.role)} · ${statusWord(t, member)}`}
          </p>
          {member.user.email != null && <p className="muted">{member.user.email}</p>}
        </div>
      </div>
      <section className="card" aria-labelledby="history-title">
        <h2 id="history-title">{t('membersScreen.howTheyGotHere')}</h2>
        <ul className="members-history">
          {[...invited, ...steps].map((step, index) => (
            <li key={index}>
              <span>{step.what}</span>
              <span className="muted">{step.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
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
      <h1>{t('membersScreen.invite')}</h1>
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
