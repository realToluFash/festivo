import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import { firstName, PROOF_MINUTES, roleName } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { api } from '../api.ts';
import { membersAfterWrite, withRole } from '../kit/membersAfterWrite.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { codeHelp } from '../kit/waysProof.ts';
import { PROVIDER_NAMES } from '../providerSignIn.ts';
import { dropProof, heldProof, howToProve, type Proving } from '../recentProof.ts';
import { ConfirmScreen, type ConfirmSays } from './AccountConfirm.tsx';
import { useProof } from './ConfirmItsYou.tsx';
import { FieldError } from './Field.tsx';
import { roleLines, roleNamed } from './MemberRequest.tsx';
import { RoleChoices } from './RoleChoices.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type AskProps, FocusedScreen, Line } from './Summary.tsx';

/** Change role on its own screen: only the roles the viewer may give, and an owner made here asks for proof first (sc-18930). */
export function RoleScreen({
  organisation,
  member,
  list,
  roles,
  open,
  opener,
  onClose,
  onChanged,
  onChangedElsewhere,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: readonly OrganisationRole[];
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onChanged: (list: MembersList, said: string) => void;
  onChangedElsewhere: () => void;
}) {
  const { t } = useTranslation();
  const current = member.role.id;
  const offered = roles.some((one) => one.id === current)
    ? roles
    : [{ ...member.role, fixed: false, removable: false, permissions: [], holders: 0 }, ...roles];
  const [picked, setPicked] = useState(current);
  const [proving, setProving] = useState<Proving | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const role = offered.find((one) => one.id === picked);
  const changed = picked !== current && role != null;
  const toOwner = role?.seededAs === 'owner';
  const owner = offered.find((one) => one.seededAs === 'owner');
  const first = firstName(member.user.name);
  const callerOwns = organisation.role.seededAs === 'owner';

  async function askProof(): Promise<void> {
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
    if (!changed || role == null) return;
    const proof = toOwner ? (proved ?? heldProof()) : null;
    setFailed(null);
    if (toOwner && proof == null) return askProof();

    setBusy(true);
    try {
      await api.changeMemberRole(organisation.id, member.id, picked, proof ?? undefined);
    } catch (error) {
      setBusy(false);
      if (toOwner && error instanceof ApiError && error.is('proof_required')) {
        dropProof();
        return askProof();
      }
      if (error instanceof ApiError && error.status === 409) {
        onChangedElsewhere();
        return;
      }
      setProving(null);
      setFailed(refusalTitle(error, t('membersScreen.actionFailed')));
      return;
    }
    const list_ = await membersAfterWrite(
      () => api.members(organisation.id),
      list,
      withRole(member.id, role),
    );
    onChanged(
      list_,
      t('membersScreen.roleNow', { name: member.user.name, role: roleName(t, role) }),
    );
  }

  const ask: AskProps | null = discarding
    ? {
        title: t('membersScreen.discardTitle'),
        line: t('membersScreen.roleStays', {
          name: member.user.name,
          role: roleName(t, member.role),
        }),
        keep: { label: t('membersScreen.keepEditing'), testID: 'members.role.keep' },
        confirm: {
          label: t('membersScreen.discard'),
          testID: 'members.role.discard',
          removes: true,
        },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;

  if (proving != null)
    return (
      <ProveScreen
        open={open}
        organisation={organisation.name}
        first={first}
        proving={proving}
        opener={opener}
        onCancel={() => {
          setFailed(null);
          setProving(null);
        }}
        onProved={save}
      />
    );

  return (
    <FocusedScreen
      open={open}
      title={t('membersScreen.roleScreenTitle', { first })}
      verb={{
        label: t('membersScreen.save'),
        on: changed && !busy,
        busy,
        onPress: () => void save(),
        testID: 'members.role.save',
      }}
      waits={busy}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelLabel={t('membersScreen.awaiting.cancel')}
      cancelTestID="members.role.cancel"
      opener={opener}
      ask={ask}
    >
      <Line
        text={
          changed
            ? t('membersScreen.roleBecomes', { name: member.user.name, role: roleName(t, role) })
            : t('membersScreen.takesEffect')
        }
      />
      <View accessibilityRole="radiogroup">
        <RoleChoices
          roles={offered.map((one) => one.id)}
          picked={picked}
          name={(id) => roleNamed(t, offered, id)}
          now={{ role: current, word: t('membersScreen.now') }}
          {...(owner != null && {
            owned: { role: owner.id, line: t('membersScreen.ownerAsks') },
          })}
          lines={roleLines(t, offered)}
          onPick={(id) => {
            setFailed(null);
            setPicked(id);
          }}
          testID="members.role"
        />
      </View>
      {failed != null && (
        <View accessibilityRole="alert">
          <FieldError message={failed} />
        </View>
      )}
      <Line
        size={14}
        text={
          callerOwns
            ? t('membersScreen.eventsFromPeople')
            : t('membersScreen.ownerMakesOwnerEvents')
        }
      />
    </FocusedScreen>
  );
}

/** Make an owner, after confirming it is you: Confirm it's you, titled for the owner it makes (sc-18930). */
function ProveScreen({
  open,
  organisation,
  first,
  proving,
  opener,
  onCancel,
  onProved,
}: {
  open: boolean;
  organisation: string;
  first: string;
  proving: Proving;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onProved: (proof: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { via, twoFactorOn } = proving;
  const proof = useProof(via, twoFactorOn);
  const provider = via === 'password' || via == null ? null : PROVIDER_NAMES[via];
  const stepTwo = provider != null && proof.signedIn != null ? provider : null;

  return (
    <ConfirmScreen
      open={open}
      title={t('membersScreen.makeOwnerTitle', { first })}
      verb={t('membersScreen.makeOwner')}
      asks={{
        lead: t('membersScreen.proveOwner', { organisation, count: PROOF_MINUTES }),
        note:
          provider == null || proof.codeAsked
            ? undefined
            : t('waysCard.proveWithProvider', { provider }),
        expired:
          proof.expired != null && provider != null
            ? {
                text: t('waysCard.proofExpired', { provider, count: PROOF_MINUTES }),
                answer: proof.expired,
              }
            : undefined,
        password: via === 'password',
        code: proof.codeAsked,
        codeHelp: codeHelp(t, stepTwo),
        instead: provider,
      }}
      opener={opener}
      onClose={onCancel}
      onContinue={async (password, code): Promise<ConfirmSays | null> => {
        const blank = {
          password: via === 'password' && password === '' ? t('waysCard.passwordBlank') : null,
          code: proof.codeAsked && code.trim() === '' ? t('waysCard.codeBlank') : null,
        };
        if (blank.password != null || blank.code != null) return { ...blank, checked: true };
        const outcome = await proof.submit(password, code);
        if (outcome.kind === 'proved') {
          await onProved(outcome.proof);
          return null;
        }
        if (outcome.kind !== 'refused') return { password: null, code: null, checked: false };
        const { field, message } = outcome.refusal;
        return {
          password: field === 'password' ? message : null,
          code: field === 'code' ? message : null,
          checked: false,
          other: field === 'failed' ? message : null,
        };
      }}
      testID="members.prove"
    />
  );
}
