import {
  ApiError,
  type Membership,
  type OrganisationDeletion,
  type OrganisationMember,
} from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { reloadSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field, FieldError, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

type Step =
  | { kind: 'resting'; flash: string | null }
  | { kind: 'transfer' }
  | { kind: 'leave' }
  | { kind: 'delete'; preview: OrganisationDeletion | null };

/** After leaving or deleting: launch reads the account again and opens its gate, or the app. */
function landAfterLeaving(): void {
  router.replace('/');
}

/** Settings > Organisation's "Ownership and leaving" (sc-68), `OrgGeneral-*`: transfer, leave, delete. */
export function OwnershipCard({
  organisation,
  kind,
}: {
  organisation: Membership;
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const owner = organisation.role.seededAs === 'owner';
  const [step, setStep] = useState<Step>({ kind: 'resting', flash: null });
  const [members, setMembers] = useState<OrganisationMember[] | null>(null);

  useEffect(() => {
    if (!owner) return;
    let current = true;

    api.members(organisation.id).then(
      (list) => current && setMembers(list.members),
      () => current && setMembers(null),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, owner]);

  const others = (members ?? []).filter((one) => one.status === 'active' && !one.self);
  const onlyOwner =
    owner &&
    members != null &&
    !members.some((one) => !one.self && one.status === 'active' && one.role.seededAs === 'owner');
  const name = organisation.name;

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
        {t('ownership.title')}
      </Text>

      {step.kind === 'resting' && (
        <>
          {step.flash != null && (
            <View accessibilityLiveRegion="polite">
              <Notice tone="done" mark={tokens.marks.done.glyph} body={step.flash} />
            </View>
          )}
          {owner && (
            <Row
              title={t('ownership.transfer')}
              note={t('ownership.transferNote', { organisation: name })}
              action={t('ownership.transfer')}
              onPress={() => setStep({ kind: 'transfer' })}
              testID="ownership.transfer"
            />
          )}
          <Row
            title={t('ownership.leave', { organisation: name })}
            note={t('ownership.leaveNote', { organisation: name })}
            action={t('ownership.leave', { organisation: name })}
            onPress={() => setStep({ kind: 'leave' })}
            testID="ownership.leave"
          />
          {owner && (
            <Row
              title={t('ownership.delete')}
              note={t('ownership.deleteNote')}
              action={t('ownership.delete')}
              onPress={() => {
                setStep({ kind: 'delete', preview: null });
                api.organisationDeletion(organisation.id).then(
                  (preview) => setStep({ kind: 'delete', preview }),
                  () => setStep({ kind: 'delete', preview: null }),
                );
              }}
              testID="ownership.delete"
            />
          )}
        </>
      )}

      {step.kind === 'transfer' && (
        <Transfer
          organisation={organisation}
          candidates={others}
          onCancel={() => setStep({ kind: 'resting', flash: null })}
          onDone={(to) =>
            setStep({
              kind: 'resting',
              flash: t('ownership.transferred', { name: to, organisation: name }),
            })
          }
        />
      )}

      {step.kind === 'leave' && (
        <Leave
          organisation={organisation}
          onlyOwner={onlyOwner}
          onTransfer={() => setStep({ kind: 'transfer' })}
          onStay={() => setStep({ kind: 'resting', flash: null })}
        />
      )}

      {step.kind === 'delete' && (
        <Delete
          organisation={organisation}
          preview={step.preview}
          onKeep={() => setStep({ kind: 'resting', flash: null })}
        />
      )}
    </View>
  );
}

function Row({
  title,
  note,
  action,
  onPress,
  testID,
}: {
  title: string;
  note: string;
  action: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={styles.row}>
      <Text size={tokens.typeButton.size} weight="semibold">
        {title}
      </Text>
      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {note}
      </Text>
      <SecondaryButton label={action} onPress={onPress} testID={testID} />
    </View>
  );
}

type TransferField = 'owner' | 'password' | 'code';

function Transfer({
  organisation,
  candidates,
  onCancel,
  onDone,
}: {
  organisation: Membership;
  candidates: OrganisationMember[];
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeAsked, setCodeAsked] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<{ field: TransferField | null; message: string } | null>(
    null,
  );
  const ownerRow = useRef<View>(null);
  const passwordInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  const chosen = candidates.find((one) => one.id === picked) ?? null;
  const name = organisation.name;

  const checks = useFormChecks<TransferField>(
    ['owner', 'password', 'code'],
    (field, value) => {
      if (field === 'owner') return value === '' ? t('ownership.ownerBlank') : null;
      if (field === 'password')
        return pending == null && value === '' ? t('ownership.passwordBlank') : null;

      return codeAsked && value.trim() === '' ? t('ownership.codeBlank') : null;
    },
    (field) => {
      if (field === 'password') passwordInput.current?.focus();
      if (field === 'code') codeInput.current?.focus();
    },
  );

  async function submit(): Promise<void> {
    if (busy || !checks.passes({ owner: picked ?? '', password, code }) || chosen == null) return;

    setBusy(true);
    setRefused(null);

    try {
      const first = pending != null ? { pendingProof: pending } : { password };
      const { proof } = await api.prove(first, codeAsked ? code.trim() : undefined);
      await api.transferOwnership(organisation.id, chosen.id, proof);
      await reloadSignedIn();
      onDone(chosen.user.name);
    } catch (error) {
      setBusy(false);
      if (!(error instanceof ApiError)) {
        setRefused({ field: null, message: t('ownership.failed') });

        return;
      }

      setPending(error.problem.pendingProof ?? pending);

      if (error.is('two_factor_required')) setCodeAsked(true);
      else if (error.is('invalid_credentials'))
        setRefused({ field: 'password', message: t('ownership.passwordWrong') });
      else if (error.is('two_factor_code_invalid') || error.is('recovery_code_used'))
        setRefused({ field: 'code', message: error.problem.title });
      else setRefused({ field: null, message: error.problem.title });
    }
  }

  const ownerError = checks.errors.owner ?? null;
  const passwordError =
    checks.errors.password ?? (refused?.field === 'password' ? refused.message : null);
  const codeError = checks.errors.code ?? (refused?.field === 'code' ? refused.message : null);

  return (
    <View style={styles.form}>
      <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
        {t('ownership.transfer')}
      </Text>
      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {t('ownership.transferBody', { organisation: name })}
      </Text>

      {refused?.field === null && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={refused.message} />
        </View>
      )}

      <View ref={ownerRow} accessibilityRole="radiogroup" style={styles.choices}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('ownership.newOwner')}
        </Text>
        {candidates.map((one) => (
          <Pressable
            key={one.id}
            style={[styles.choice, picked === one.id && styles.choiceOn]}
            onPress={() => {
              setPicked(one.id);
              checks.edited('owner', one.id);
            }}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked === one.id, disabled: busy }}
            testID={`ownership.owner.${one.id}`}
          >
            <Text size={tokens.typeButton.size} weight="semibold">
              {one.user.name}
            </Text>
            <Text size={tokens.typeSmall.size} style={styles.secondary}>
              {roleName(t, one.role)}
            </Text>
          </Pressable>
        ))}
        {ownerError != null && <FieldError message={ownerError} />}
      </View>

      {pending == null && (
        <Field
          label={t('ownership.password')}
          error={passwordError}
          help={t('ownership.passwordWhy', { organisation: name })}
        >
          <PasswordField
            ref={passwordInput}
            value={password}
            wrong={passwordError != null}
            submitting={busy}
            editable={!busy}
            autoComplete="current-password"
            onChangeText={(typed) => {
              setPassword(typed);
              if (refused?.field === 'password') setRefused(null);
              checks.edited('password', typed);
            }}
            onBlur={() => checks.left('password', password)}
            testID="ownership.password"
          />
        </Field>
      )}

      {codeAsked && (
        <Field label={t('ownership.code')} error={codeError}>
          <CodeField
            ref={codeInput}
            value={code}
            wrong={codeError != null}
            takesRecoveryCode
            editable={!busy}
            onChangeText={(typed) => {
              setCode(typed);
              if (refused?.field === 'code') setRefused(null);
              checks.edited('code', typed);
            }}
            onBlur={() => checks.left('code', code)}
            testID="ownership.code"
          />
        </Field>
      )}

      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {t('ownership.bothEmailed', { name: chosen?.user.name ?? t('ownership.theNewOwner') })}
      </Text>

      <PrimaryButton
        label={
          chosen == null
            ? t('ownership.transfer')
            : t('ownership.makeOwner', { name: chosen.user.name })
        }
        busy={busy}
        onPress={() => void submit()}
        testID="ownership.transfer.send"
      />
      <QuietButton
        label={t('ownership.keep')}
        onPress={onCancel}
        testID="ownership.transfer.keep"
      />
    </View>
  );
}

function Leave({
  organisation,
  onlyOwner,
  onTransfer,
  onStay,
}: {
  organisation: Membership;
  onlyOwner: boolean;
  onTransfer: () => void;
  onStay: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [refusedLast, setRefusedLast] = useState(false);
  const name = organisation.name;

  async function leave(): Promise<void> {
    setBusy(true);
    setRefused(null);

    try {
      await api.leaveOrganisation(organisation.id);
      landAfterLeaving();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.is('last_owner')) setRefusedLast(true);
      else setRefused(refusalTitle(error, t('ownership.failed')));
    }
  }

  return (
    <View style={styles.form}>
      <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
        {t('ownership.leaveTitle', { organisation: name })}
      </Text>
      {onlyOwner || refusedLast ? (
        <>
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
            <Notice
              tone="attention"
              mark="!"
              title={t('ownership.onlyOwnerTitle')}
              body={t('ownership.onlyOwnerBody')}
            />
          </View>
          <PrimaryButton
            label={t('ownership.transfer')}
            onPress={onTransfer}
            testID="ownership.leave.transfer"
          />
          <QuietButton label={t('ownership.stay')} onPress={onStay} testID="ownership.leave.stay" />
        </>
      ) : (
        <>
          <Text size={tokens.typeBodyPhone.size}>
            {t('ownership.leaveBody', { organisation: name })}
          </Text>
          {refused != null && <FieldError message={refused} />}
          <PrimaryButton
            label={t('ownership.leave', { organisation: name })}
            busy={busy}
            onPress={() => void leave()}
            testID="ownership.leave.send"
          />
          <QuietButton label={t('ownership.stay')} onPress={onStay} testID="ownership.leave.stay" />
        </>
      )}
    </View>
  );
}

function Delete({
  organisation,
  preview,
  onKeep,
}: {
  organisation: Membership;
  preview: OrganisationDeletion | null;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const aboveKeyboard = useAboveKeyboard();
  const name = organisation.name;
  const matches = typed.trim() === name;

  async function submit(): Promise<void> {
    if (busy) return;

    if (!matches) {
      setMismatch(t('ownership.deleteMismatch', { organisation: name }));
      input.current?.focus();

      return;
    }

    setBusy(true);
    setFailed(null);

    try {
      await api.deleteOrganisation(organisation.id, typed);
      landAfterLeaving();
    } catch (error) {
      setBusy(false);
      const violation =
        error instanceof ApiError
          ? error.problem.violations?.find((one) => one.propertyPath === 'name')
          : undefined;

      if (violation != null) setMismatch(violation.message);
      else setFailed(refusalTitle(error, t('ownership.failed')));
    }
  }

  return (
    <View style={styles.form}>
      <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
        {t('ownership.deleteTitle', { organisation: name })}
      </Text>
      <Notice
        tone="attention"
        mark="!"
        title={t('ownership.deleteWarningTitle')}
        body={
          preview == null
            ? t('ownership.deleteLoading')
            : `${t('ownership.deleteCounts', {
                events: t('ownership.events', { count: preview.events }),
                guests: t('ownership.guests', { count: preview.guests }),
                members: t('ownership.members', { count: preview.members }),
              })} ${t('ownership.deleteWindow', { deadline: preview.restoreCloses })}`
        }
      />
      {failed != null && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failed} />
        </View>
      )}
      <View {...aboveKeyboard} style={styles.form}>
        <Field
          label={t('ownership.deleteType', { organisation: name })}
          error={mismatch}
          help={matches ? t('ownership.deleteMatches') : t('ownership.deleteExactly')}
        >
          <TextField
            ref={input}
            value={typed}
            wrong={mismatch != null}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            onChangeText={(value) => {
              setTyped(value);
              if (value.trim() === name) setMismatch(null);
            }}
            testID="ownership.delete.name"
          />
        </Field>
        <PrimaryButton
          label={t('ownership.deleteButton', { organisation: name })}
          busy={busy}
          onPress={() => void submit()}
          testID="ownership.delete.send"
        />
      </View>
      <QuietButton
        label={t('ownership.deleteKeep', { organisation: name })}
        onPress={onKeep}
        testID="ownership.delete.keep"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  form: { gap: tokens.spaceLg },
  choices: { gap: tokens.spaceSm },
  choice: {
    gap: tokens.spaceXxs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceOn: { borderWidth: 2, borderColor: tokens.colorAccent },
  secondary: { color: tokens.colorInkSecondary },
});
