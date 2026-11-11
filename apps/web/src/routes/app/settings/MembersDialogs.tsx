import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
  type SentInvitation,
} from '@soirely/api-client';
import {
  PROOF_MINUTES,
  approvalRoles,
  emailProblem,
  firstName,
  formatDay,
  initials,
  roleName,
} from '@soirely/domain';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { ConfirmItsYou } from '../../../components/ConfirmItsYou.tsx';
import {
  Ask,
  Avatar,
  Choices,
  Dialog,
  Field,
  Head,
  Note,
  RedAction,
} from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { type Proving, dropProof, heldProof, howToProve } from '../../../recentProof.ts';
import { type Notice } from './membersCard.ts';
import { roleChoices } from './memberWords.ts';
import { type OwnerReturn, provingOnReturn, signInOnReturn } from './ownerReturn.ts';

/** Who to invite and as what; Send invitation checks the address before it sends, and Owner asks for the proof. */
export function InviteDialog({
  organisation,
  roles,
  start,
  returned,
  onClose,
  onSent,
}: {
  organisation: Membership;
  roles: OrganisationRole[];
  start: { email: string; roleId: string | null; again: string | null };
  returned: OwnerReturn | null;
  onClose: () => void;
  onSent: (invitation: SentInvitation) => void;
}) {
  const { t } = useTranslation();
  const first =
    roles.find((role) => role.id === start.roleId) ??
    roles.find((role) => role.seededAs === 'member') ??
    roles[0];
  const [email, setEmail] = useState(start.email);
  const [picked, setPicked] = useState(first?.id ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proving, setProving] = useState<Proving | null>(() => provingOnReturn(returned));
  // Google's or Apple's sign-in is single-use: sent once, never again by a second Confirm it's you.
  const [fromTrip, setFromTrip] = useState(() => signInOnReturn(returned));
  const [asking, setAsking] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const role = roles.find((one) => one.id === picked);
  const toOwner = role?.seededAs === 'owner';
  const changed = email !== start.email || picked !== (first?.id ?? '');

  function wrong(typed: string): string | null {
    switch (emailProblem(typed)) {
      case 'blank':
        return t('membersScreen.emailBlank');
      case 'shape':
        return t('membersScreen.emailShape');
      default:
        return null;
    }
  }

  async function confirmFirst(): Promise<void> {
    setBusy(true);

    try {
      setProving(await howToProve());
    } catch {
      setFailed(t('membersScreen.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function deliver(proved?: string): Promise<void> {
    if (role == null || busy) return;

    const proof = toOwner ? (proved ?? heldProof()) : null;
    setFailed(null);
    if (toOwner && proof == null) return confirmFirst();

    setProving(null);
    setBusy(true);

    try {
      onSent(await api.inviteMember(organisation.id, email.trim(), role.id, proof ?? undefined));
    } catch (error) {
      setBusy(false);

      if (toOwner && error instanceof ApiError && error.is('proof_required')) {
        dropProof();
        return confirmFirst();
      }
      if (
        error instanceof ApiError &&
        (error.is('already_a_member') || error.is('validation_failed'))
      ) {
        const violation = error.problem.violations?.find((one) => one.propertyPath === 'email');
        setProblem(violation?.message ?? error.problem.title);
        field.current?.focus();
      } else if (error instanceof ApiError && error.is('grant_not_held')) {
        setFailed(error.problem.title);
      } else {
        setFailed(t('membersScreen.sendFailed'));
      }
    }
  }

  return (
    <>
      <Dialog
        title={t('membersScreen.invite')}
        verb={proving == null ? t('membersScreen.send') : null}
        first={field}
        locked={busy}
        onDismiss={() => {
          if (proving != null) {
            setFromTrip(null);
            setProving(null);
          } else if (changed) setAsking(true);
          else onClose();
        }}
        onConfirm={() => {
          const typed = wrong(email);
          setProblem(typed);
          if (typed != null) return field.current?.focus();

          void deliver();
        }}
      >
        {proving != null && role != null ? (
          <ConfirmItsYou
            idPrefix="invite-prove"
            intro={t('membersScreen.proveOwner', {
              organisation: organisation.name,
              count: PROOF_MINUTES,
            })}
            via={proving.via}
            twoFactorOn={proving.twoFactorOn}
            returned={fromTrip}
            purpose={{ kind: 'makeOwner', roleId: role.id, to: { email, again: start.again } }}
            onProved={(proof) => {
              setFromTrip(null);
              void deliver(proof);
            }}
            onCancel={() => {
              setFromTrip(null);
              setProving(null);
            }}
          />
        ) : (
          <>
            {failed != null && (
              <p className="desk-error" role="alert">
                {failed}
              </p>
            )}
            <div className="desk-group-in">
              <Head title={t('membersScreen.whoToInvite')} level={3} />
              <Field
                label={t('register.email')}
                value={email}
                inputMode="email"
                autoComplete="off"
                inputRef={field}
                error={problem}
                onChange={(value) => {
                  setEmail(value);
                  setProblem(null);
                }}
              />
            </div>
            <Choices
              legend={t('membersScreen.role')}
              choices={roleChoices(t, roles)}
              picked={role == null ? '' : roleName(t, role)}
              onPick={(name) =>
                setPicked(roles.find((one) => roleName(t, one) === name)?.id ?? picked)
              }
            />
            <p className="desk-line is-small">
              {t('membersScreen.inviteNote', {
                organisation: organisation.name,
                role: role == null ? '' : roleName(t, role),
              })}
            </p>
          </>
        )}
      </Dialog>
      {asking && (
        <Ask
          title={t('membersScreen.discardTitle')}
          line={t('membersScreen.inviteDiscard')}
          keep={t('membersScreen.keepEditing')}
          go={t('membersScreen.discard')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** A request to join: who asked and until when, the role to let them in with, and turning it down (sc-392). */
export function RequestDialog({
  organisation,
  member,
  roles,
  onClose,
  onAnswered,
}: {
  organisation: Membership;
  member: OrganisationMember;
  roles: OrganisationRole[];
  onClose: () => void;
  onAnswered: (list: MembersList, notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const offered = approvalRoles(roles);
  const [picked, setPicked] = useState(offered[0]?.id ?? '');
  const [ask, setAsk] = useState<'turnDown' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const role = offered.find((one) => one.id === picked);
  const name = member.user.name;
  const asked = member.since == null ? '' : formatDay(member.since, dateLocale());

  async function answer(approve: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(null);

    try {
      if (approve && role != null) {
        await api.approveMember(organisation.id, member.id, role.id);
        onAnswered(await api.members(organisation.id), {
          kind: 'approved',
          member: member.id,
          role: roleName(t, role),
        });
      } else {
        await api.turnDownMember(organisation.id, member.id);
        onAnswered(await api.members(organisation.id), { kind: 'turnedDown', name });
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

  return (
    <>
      <Dialog
        title={t('membersScreen.requestTitle', { name: firstName(name) })}
        verb={t('membersScreen.awaiting.approve')}
        on={role != null}
        locked={busy && ask == null}
        onDismiss={() => (picked === offered[0]?.id ? onClose() : setAsk('discard'))}
        onConfirm={() => void answer(true)}
      >
        <div className="desk-asker">
          <Avatar initials={initials(name)} tone={0} size="request" />
          <div className="desk-who-words">
            <h3>{name}</h3>
            {member.user.email != null && <p className="desk-line">{member.user.email}</p>}
          </div>
        </div>
        <Note strong>
          {member.removesAt == null
            ? t('membersScreen.requestAsked', { organisation: organisation.name, date: asked })
            : t('membersScreen.requestAskedRemoves', {
                organisation: organisation.name,
                date: asked,
                deadline: member.removesAt.written,
              })}
        </Note>
        <Note>{t('membersScreen.awaiting.note')}</Note>
        {failed != null && ask == null && (
          <p className="desk-error" role="alert">
            {failed}
          </p>
        )}
        <Choices
          legend={t('membersScreen.role')}
          choices={roleChoices(t, offered)}
          picked={role == null ? '' : roleName(t, role)}
          onPick={(word) =>
            setPicked(offered.find((one) => roleName(t, one) === word)?.id ?? picked)
          }
          foot={t('membersScreen.requestOwnerLater')}
        />
        <RedAction
          label={t('membersScreen.requestTurnDown')}
          line={t('membersScreen.awaiting.turnDownBody', {
            name,
            organisation: organisation.name,
          })}
          onClick={() => {
            setFailed(null);
            setAsk('turnDown');
          }}
        />
      </Dialog>
      {ask === 'turnDown' && (
        <Ask
          title={t('membersScreen.awaiting.turnDownTitle', { name })}
          line={t('membersScreen.requestTurnDownLine')}
          keep={t('membersScreen.awaiting.keep')}
          go={t('membersScreen.awaiting.turnDown')}
          busy={busy ? t('membersScreen.sending') : undefined}
          failed={failed ?? undefined}
          onKeep={() => {
            setFailed(null);
            setAsk(null);
          }}
          onGo={() => void answer(false)}
        />
      )}
      {ask === 'discard' && (
        <Ask
          title={t('membersScreen.discardTitle')}
          line={t('membersScreen.requestDiscard', { name: firstName(name) })}
          keep={t('membersScreen.keepEditing')}
          go={t('membersScreen.discard')}
          onKeep={() => setAsk(null)}
          onGo={onClose}
        />
      )}
    </>
  );
}
