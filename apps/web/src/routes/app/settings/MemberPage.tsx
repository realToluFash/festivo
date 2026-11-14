import type { TFunction } from 'i18next';
import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import {
  PROOF_MINUTES,
  firstName,
  formatDay,
  grantableRoles,
  historyLine,
  initials,
  memberHeldNoRole,
  memberStanding,
  ownRoleLine,
  roleName,
  withheldRoles,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { ConfirmItsYou } from '../../../components/ConfirmItsYou.tsx';
import {
  Ask,
  Card,
  CardStep,
  Choices,
  Dialog,
  Head,
  Mark,
  Note,
  OnCard,
  RedAction,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree } from '../../../layers.ts';
import { type Proving, dropProof, heldProof, howToProve } from '../../../recentProof.ts';
import { memberTag, roleChoices } from './memberWords.ts';
import { type OwnerReturn, provingOnReturn, signInOnReturn } from './ownerReturn.ts';

/** What the last change on this page came to, said on the person's card (sc-3575). */
type Outcome =
  | { kind: 'suspended' }
  | { kind: 'restored'; role: string }
  | { kind: 'roleChanged'; role: string }
  | { kind: 'conflict' };

type Asking = 'role' | 'suspend' | 'remove' | null;

type Refusal = { kind: 'seats'; limit: number } | { kind: 'line'; text: string };

/** A member in the list's place (sc-34200): their card, how they got here, and what the viewer may do, by their standing (sc-68). */
export function MemberPage({
  organisation,
  member,
  list,
  roles,
  manages,
  level,
  returned,
  onChanged,
  onRemoved,
  onBack,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  level: 1 | 2;
  returned: OwnerReturn | null;
  onChanged: (list: MembersList) => void;
  onRemoved: (list: MembersList, name: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [asking, setAsking] = useState<Asking>(returned == null ? null : 'role');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const said = useRef<HTMLDivElement>(null);
  const owns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.members, {
    owns,
    manages,
    withholds: withheldRoles(roles, organisation),
  });
  const name = member.user.name;
  const first = firstName(name);
  const role = roleName(t, member.role);
  const suspension = member.suspension;
  const suspended = member.status === 'suspended';
  const byHand = suspended && suspension?.reason === 'manual';
  const acts = standing === 'manageable' || standing === 'suspendedOnlyOwner';
  const owner = member.role.seededAs === 'owner';
  const named = { name, organisation: organisation.name, domain: suspension?.domain ?? '' };
  const tag = memberTag(t, member);
  const Name = level === 1 ? 'h1' : 'h2';

  useEffect(() => {
    if (outcome != null) focusWhenFree(() => said.current);
  }, [outcome]);

  async function reload(): Promise<void> {
    onChanged(await api.members(organisation.id));
  }

  function changedElsewhere(): void {
    setOutcome({ kind: 'conflict' });
    reload().catch(() => undefined);
  }

  function refused(error: unknown): string {
    return error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed');
  }

  async function suspend(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(null);

    try {
      await api.suspendMember(organisation.id, member.id);
      setAsking(null);
      setOutcome({ kind: 'suspended' });
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAsking(null);
        changedElsewhere();
      } else setFailed(refused(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    setRefusal(null);

    try {
      await api.removeMember(organisation.id, member.id);
      onRemoved(await api.members(organisation.id), name);
    } catch (error) {
      setBusy(false);
      if (asking === 'remove') setFailed(refused(error));
      else {
        setRefusal({
          kind: 'line',
          text: [
            refused(error),
            t('membersScreen.onlyOwnerNotRemovable', { name }),
            ...(suspension?.reason === 'address_gone'
              ? [
                  t('membersScreen.onlyOwnerRestoreNeedsAddress', {
                    domain: suspension.domain ?? '',
                  }),
                ]
              : []),
          ].join(' '),
        });
      }
    }
  }

  async function restore(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setRefusal(null);

    try {
      await api.restoreMember(organisation.id, member.id);
      setOutcome({ kind: 'restored', role });
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.is('team_seats_in_use')) {
        setRefusal({ kind: 'seats', limit: error.problem.limit ?? 0 });
      } else if (error instanceof ApiError && error.is('restore_needs_address')) {
        setRefusal({ kind: 'line', text: t('membersScreen.restoreNeedsAddress', named) });
      } else if (error instanceof ApiError && error.status === 409) {
        changedElsewhere();
      } else setRefusal({ kind: 'line', text: refused(error) });
    } finally {
      setBusy(false);
    }
  }

  const lines = cardLines();

  function cardLines(): string[] {
    switch (outcome?.kind) {
      case 'conflict':
        return [t('membersScreen.accessConflict', { name })];
      case 'roleChanged':
        return [
          t('membersScreen.roleNow', { name, role: outcome.role }),
          t('membersScreen.takesEffect'),
        ];
      case 'restored':
        if (!suspended)
          return [
            t('membersScreen.restoredNow', { name, role: outcome.role }),
            t('membersScreen.restoredNowNext', { organisation: organisation.name }),
          ];
        break;
      case 'suspended':
        if (suspended)
          return [t('membersScreen.suspendedNowNext', { organisation: organisation.name })];
        break;
      case undefined:
        break;
    }
    if (suspension == null || !suspended) return [];
    if (byHand)
      return [
        t('membersScreen.suspendedBody', named),
        ...(acts ? [t('membersScreen.suspendedRestoreNote', { role })] : []),
      ];

    return [
      t(`membersScreen.suspendedBecause.${suspension.reason}`, named),
      suspension.onlyOwner
        ? t('membersScreen.suspendedOnlyOwner', named)
        : suspension.removesAt == null
          ? ''
          : t('membersScreen.suspendedRemovedOn', { when: suspension.removesAt.written }),
    ].filter((line) => line !== '');
  }

  const step =
    acts && suspended
      ? {
          label: byHand ? t('membersScreen.restoreAccess') : t('membersScreen.restore'),
          onClick: () => void restore(),
        }
      : standing === 'manageable' && member.status === 'active'
        ? { label: t('membersScreen.changeRole'), onClick: () => setAsking('role') }
        : null;
  const after = afterLines();

  function afterLines(): string[] {
    switch (standing) {
      case 'self':
      case 'selfOwner':
        return [t(`membersScreen.${ownRoleLine(standing).key}`)];
      case 'onlyOwner':
        return [
          t('membersScreen.onlyOwner', { name }),
          ...(owns ? [] : [t('membersScreen.askOwner', { name })]),
          ...(manages ? [t('membersScreen.ownerNoSuspend', { name })] : []),
        ];
      case 'ownerOnly':
        return [t('membersScreen.ownerOnly')];
      case 'beyondGrant':
        return [t('membersScreen.beyondGrant')];
      default:
        return [];
    }
  }

  const history = historyRows(t, member, list, organisation.name);
  const canSuspend = standing === 'manageable' && member.status === 'active' && !owner;
  const canRemove = acts;

  return (
    <>
      <Card size="person">
        <div className="desk-who">
          <span className="desk-disc" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="desk-who-words">
            <Name className="desk-name" tabIndex={-1}>
              {name}
            </Name>
            {member.user.email != null && <OnCard>{member.user.email}</OnCard>}
          </div>
        </div>
        <ul className="desk-glass-tags">
          <li className="desk-glass">
            {memberHeldNoRole(member) ? t('membersScreen.noRoleYet') : role}
          </li>
          <li className="desk-glass">
            <Mark kind={tag.kind} />
            {tag.word}
          </li>
        </ul>
        <div ref={said} className="desk-said-lines" tabIndex={-1}>
          {lines.map((line) => (
            <OnCard key={line}>{line}</OnCard>
          ))}
        </div>
        {step != null && <CardStep label={step.label} onClick={step.onClick} />}
      </Card>
      {refusal != null && (
        <div className="desk-refusal" role="alert">
          {refusal.kind === 'seats' ? (
            <>
              <p className="desk-line is-ink">
                {t('membersScreen.seatsInUse', { count: refusal.limit })}
              </p>
              <p className="desk-line">
                {owns
                  ? t('membersScreen.seatsWayOwner', { name })
                  : t('membersScreen.seatsWayAdmin', { name })}
              </p>
              <p className="desk-line">{t('membersScreen.seatsSuspendedFree')}</p>
              <TextAction label={t('membersScreen.seatsOpenMembers')} onClick={onBack} />
            </>
          ) : (
            <p className="desk-line is-ink">{refusal.text}</p>
          )}
        </div>
      )}
      {acts && suspended && byHand && <Note>{t('membersScreen.roleKeptWhileSuspended')}</Note>}
      <section className="desk-block">
        <Head title={t('membersScreen.howTheyGotHere')} />
        <ul className="desk-rows">
          {history.map((one, index) => (
            <li key={index} className="desk-row is-plain">
              <RowWords title={one.what} lines={[formatDay(one.at, dateLocale())]} />
            </li>
          ))}
        </ul>
      </section>
      {after.length > 0 && (
        <div className="desk-after">
          {after.map((line) => (
            <Note key={line}>{line}</Note>
          ))}
          {standing === 'selfOwner' && (
            <TextAction
              label={t('membersScreen.goToGeneralWords')}
              after="chevron"
              onClick={() => void navigate('/app/settings')}
            />
          )}
        </div>
      )}
      {canSuspend && (
        <RedAction
          label={t('membersScreen.suspendButton')}
          line={t('membersScreen.suspendBody', { organisation: organisation.name })}
          onClick={() => setAsking('suspend')}
        />
      )}
      {canRemove && (
        <RedAction
          label={t('membersScreen.removeButtonOpen', { organisation: organisation.name })}
          wraps
          line={
            byHand
              ? t('membersScreen.suspendedRemoveBody', named)
              : t('membersScreen.removeBody', { organisation: organisation.name })
          }
          onClick={() => (standing === 'suspendedOnlyOwner' ? void remove() : setAsking('remove'))}
        />
      )}
      {asking === 'role' && (
        <RoleDialog
          organisation={organisation}
          member={member}
          roles={grantableRoles(roles, organisation)}
          returned={returned}
          onClose={() => setAsking(null)}
          onChanged={(changed, to) => {
            onChanged(changed);
            setOutcome({ kind: 'roleChanged', role: to });
            setAsking(null);
          }}
          onChangedElsewhere={() => {
            setAsking(null);
            changedElsewhere();
          }}
        />
      )}
      {asking === 'suspend' && (
        <Ask
          title={t('membersScreen.suspendConfirmTitle', { name })}
          line={`${t('membersScreen.suspendConfirmBody', named)} ${t('membersScreen.suspendConfirmEmail')}`}
          keep={t('membersScreen.suspendKeep', { name: first })}
          go={t('membersScreen.suspendGo')}
          busy={busy ? t('membersScreen.sending') : undefined}
          failed={failed ?? undefined}
          onKeep={() => {
            setFailed(null);
            setAsking(null);
          }}
          onGo={() => void suspend()}
        />
      )}
      {asking === 'remove' && (
        <Ask
          title={t('membersScreen.removeAskTitle', named)}
          line={
            byHand
              ? t('membersScreen.suspendedRemoveBody', named)
              : t('membersScreen.removeBody', { organisation: organisation.name })
          }
          keep={
            byHand
              ? t('membersScreen.suspendedRemoveKeep')
              : t('membersScreen.removeKeep', { name: first })
          }
          go={t('membersScreen.removeGo')}
          busy={busy ? t('membersScreen.sending') : undefined}
          failed={failed ?? undefined}
          onKeep={() => {
            setFailed(null);
            setAsking(null);
          }}
          onGo={() => void remove()}
        />
      )}
    </>
  );
}

type Word = TFunction;

/** How they got here, oldest first: the invitation, then each step, each by whoever caused it. */
function historyRows(
  t: Word,
  member: OrganisationMember,
  list: MembersList,
  organisation: string,
): { what: string; at: string }[] {
  const caller = list.members.find((one) => one.self)?.user.id ?? null;
  const steps = member.history.map((step) => {
    const line = historyLine({ ...step, by: step.by?.id ?? null }, member.user.id);
    const by =
      step.by == null
        ? t('membersScreen.someone')
        : step.by.id === caller
          ? t('membersScreen.byYou')
          : step.by.name;

    return { what: t(`membersScreen.history.${line.key}`, { organisation, by }), at: step.at };
  });
  const invited =
    member.invitedBy != null && member.invitedAt != null
      ? [
          {
            what: t('membersScreen.history.invitedBy', {
              by: member.invitedBy.id === caller ? t('membersScreen.byYou') : member.invitedBy.name,
            }),
            at: member.invitedAt,
          },
        ]
      : [];

  return [...invited, ...steps].sort((one, other) => Date.parse(one.at) - Date.parse(other.at));
}

/** A member's role, then, for Owner, Confirm it's you: Save waits until something changes. */
function RoleDialog({
  organisation,
  member,
  roles,
  returned,
  onClose,
  onChanged,
  onChangedElsewhere,
}: {
  organisation: Membership;
  member: OrganisationMember;
  roles: OrganisationRole[];
  returned: OwnerReturn | null;
  onClose: () => void;
  onChanged: (list: MembersList, role: string) => void;
  onChangedElsewhere: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(returned?.purpose.roleId ?? member.role.id);
  const [proving, setProving] = useState<Proving | null>(() => provingOnReturn(returned));
  const [fromTrip, setFromTrip] = useState(() => signInOnReturn(returned));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
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
  const toOwner = role?.seededAs === 'owner';
  const name = member.user.name;
  const first = firstName(name);
  const owns = organisation.role.seededAs === 'owner';
  const none = useRef<HTMLElement>(null);

  async function confirmFirst(): Promise<void> {
    setBusy(true);

    try {
      setProving(await howToProve());
    } catch {
      setFailed(t('membersScreen.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function save(proved?: string): Promise<void> {
    if (!changed || busy) return;

    // Making an owner asks for a recent proof (sc-18930); one held from the last five minutes stands.
    const proof = toOwner ? (proved ?? heldProof()) : null;
    setFailed(null);
    if (toOwner && proof == null) return confirmFirst();

    setProving(null);
    setBusy(true);

    try {
      await api.changeMemberRole(organisation.id, member.id, picked, proof ?? undefined);
      onChanged(await api.members(organisation.id), roleName(t, role));
    } catch (error) {
      setBusy(false);
      if (toOwner && error instanceof ApiError && error.is('proof_required')) {
        dropProof();
        return confirmFirst();
      }
      if (error instanceof ApiError && error.status === 409) onChangedElsewhere();
      else
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
    }
  }

  return (
    <>
      <Dialog
        title={
          proving == null
            ? t('membersScreen.roleDialogTitle', { name: first })
            : t('membersScreen.makeOwnerTitle', { name: first })
        }
        verb={proving == null ? t('membersScreen.save') : null}
        on={changed}
        locked={busy}
        first={none}
        onDismiss={() => {
          if (proving != null) {
            setFromTrip(null);
            setProving(null);
          } else if (changed) setAsking(true);
          else onClose();
        }}
        onConfirm={() => void save()}
      >
        {proving != null && role != null ? (
          <ConfirmItsYou
            idPrefix="role-prove"
            intro={t('membersScreen.proveOwner', {
              organisation: organisation.name,
              count: PROOF_MINUTES,
            })}
            via={proving.via}
            twoFactorOn={proving.twoFactorOn}
            returned={fromTrip}
            purpose={{ kind: 'makeOwner', roleId: picked, to: { member: member.id } }}
            onProved={(proof) => {
              setFromTrip(null);
              void save(proof);
            }}
            onCancel={() => {
              setFromTrip(null);
              setProving(null);
            }}
          />
        ) : (
          <>
            <Note>
              {changed
                ? t('membersScreen.roleBecomes', { name, role: roleName(t, role) })
                : t('membersScreen.takesEffect')}
            </Note>
            {failed != null && (
              <p className="desk-error" role="alert">
                {failed}
              </p>
            )}
            <Choices
              legend={t('membersScreen.roleFor', { name })}
              hideLegend
              choices={roleChoices(t, offered, member.role.id)}
              picked={role == null ? '' : roleName(t, role)}
              onPick={(word) =>
                setPicked(offered.find((one) => roleName(t, one) === word)?.id ?? picked)
              }
              foot={
                owns
                  ? t('membersScreen.eventsFromPeople')
                  : `${t('membersScreen.ownerMakesOwner')} ${t('membersScreen.eventsFromPeople')}`
              }
            />
          </>
        )}
      </Dialog>
      {asking && (
        <Ask
          title={t('membersScreen.discardTitle')}
          line={t('membersScreen.roleDiscard', { name, role: roleName(t, member.role) })}
          keep={t('membersScreen.keepEditing')}
          go={t('membersScreen.discard')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}
