import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import { PROOF_MINUTES, roleName } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { api } from '../api.ts';
import { membersAfterWrite, withRole } from '../kit/membersAfterWrite.ts';
import { firstName } from '../kit/membersSummary.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { PROVIDER_NAMES } from '../providerSignIn.ts';
import { dropProof, heldProof, howToProve, type Proving } from '../recentProof.ts';
import { tokens } from '../theme/tokens.ts';
import { useProof } from './ConfirmItsYou.tsx';
import { CodeField, Field, FieldError, focusChecked, focusRefused } from './Field.tsx';
import { roleLines, roleNamed } from './MemberRequest.tsx';
import { PasswordField } from './PasswordField.tsx';
import { RoleChoices } from './RoleChoices.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type AskProps, FocusedScreen, Line, TextAction } from './Summary.tsx';

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
        busy={busy}
        failed={failed}
        opener={opener}
        onCancel={() => {
          setFailed(null);
          setProving(null);
        }}
        onProved={(proof) => void save(proof)}
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
            : `${t('membersScreen.ownerMakesOwner')} ${t('membersScreen.eventsFromPeople')}`
        }
      />
    </FocusedScreen>
  );
}

/** Make an owner, after confirming it is you: the password, or Google or Apple, then the code with two-factor on. */
function ProveScreen({
  open,
  organisation,
  first,
  proving,
  busy,
  failed,
  opener,
  onCancel,
  onProved,
}: {
  open: boolean;
  organisation: string;
  first: string;
  proving: Proving;
  busy: boolean;
  failed: string | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onProved: (proof: string) => void;
}) {
  const { t } = useTranslation();
  const { via, twoFactorOn } = proving;
  const proof = useProof(via, twoFactorOn);
  const { codeAsked, signedIn, checking, refusal, setRefusal } = proof;
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const [blank, setBlank] = useState<'password' | 'code' | null>(null);
  const provider = via !== 'password' && via != null ? via : null;
  const waiting = checking || busy;

  async function submit(): Promise<void> {
    if (waiting) return;
    if (provider == null && password.current === '') {
      setBlank('password');
      focusChecked(passwordInput);
      return;
    }
    if (codeAsked && code.current.trim() === '') {
      setBlank('code');
      focusChecked(codeInput);
      return;
    }
    setBlank(null);
    const outcome = await proof.submit(password.current, code.current);
    if (outcome.kind === 'expired') code.current = '';
    if (outcome.kind === 'refused' && outcome.refusal.field === 'password')
      focusRefused(passwordInput);
    if (outcome.kind === 'refused' && outcome.refusal.field === 'code') focusRefused(codeInput);
    if (outcome.kind === 'proved') onProved(outcome.proof);
  }

  const passwordError =
    blank === 'password'
      ? t('waysCard.passwordBlank')
      : refusal?.field === 'password'
        ? refusal.message
        : null;
  const codeError =
    blank === 'code' ? t('waysCard.codeBlank') : refusal?.field === 'code' ? refusal.message : null;
  const general = refusal?.field === 'failed' ? refusal.message : failed;

  return (
    <FocusedScreen
      open={open}
      title={t('membersScreen.makeOwnerTitle', { first })}
      verb={{
        label: t('membersScreen.makeOwner'),
        on: !waiting,
        busy: waiting,
        onPress: () => void submit(),
        testID: 'members.prove.continue',
      }}
      waits={waiting}
      onCancel={onCancel}
      cancelLabel={t('membersScreen.awaiting.cancel')}
      cancelTestID="members.prove.cancel"
      opener={opener}
    >
      <Line text={t('membersScreen.proveOwner', { organisation, count: PROOF_MINUTES })} />
      {general != null && (
        <View accessibilityRole="alert">
          <FieldError message={general} />
        </View>
      )}
      <View style={styles.fields}>
        {provider == null && (
          <Field label={t('waysCard.yourPassword')} error={passwordError}>
            <PasswordField
              ref={passwordInput}
              wrong={passwordError != null}
              submitting={waiting}
              autoComplete="current-password"
              textContentType="password"
              onChangeText={(text) => {
                password.current = text;
                if (refusal?.field === 'password') setRefusal(null);
                if (blank === 'password' && text !== '') setBlank(null);
              }}
              returnKeyType={codeAsked ? 'next' : 'done'}
              onSubmitEditing={() => (codeAsked ? codeInput.current?.focus() : void submit())}
              submitBehavior="submit"
              accessibilityLabel={t('waysCard.yourPassword')}
              testID="members.prove.password"
            />
          </Field>
        )}
        {provider != null && signedIn == null && (
          <View style={styles.provider}>
            <Line text={t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[provider] })} />
            <TextAction
              label={t('waysCard.continueWith', { provider: PROVIDER_NAMES[provider] })}
              off={waiting}
              onPress={() => void submit()}
              testID="members.prove.provider"
            />
          </View>
        )}
        {provider != null && signedIn != null && (
          <Line
            quiet={false}
            text={t('waysCard.signedInWith', { provider: PROVIDER_NAMES[provider] })}
          />
        )}
        {codeAsked && (
          <Field label={t('waysCard.code')} error={codeError} help={t('membersScreen.codeHelp')}>
            <CodeField
              ref={codeInput}
              takesRecoveryCode
              wrong={codeError != null}
              submitting={waiting}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onChangeText={(text) => {
                code.current = text;
                if (refusal?.field === 'code') setRefusal(null);
                if (blank === 'code' && text.trim() !== '') setBlank(null);
              }}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              submitBehavior="submit"
              accessibilityLabel={t('waysCard.code')}
              testID="members.prove.code"
            />
          </Field>
        )}
      </View>
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.spaceXl, paddingTop: tokens.spaceXs },
  provider: { gap: tokens.spaceXs },
});
