import {
  ApiError,
  type Membership,
  type OrganisationDeletion,
  type OrganisationMember,
  type Provider,
} from '@soirely/api-client';
import { PROOF_MINUTES, confirmWith, roleName, typedNameMatches } from '@soirely/domain';
import { router } from 'expo-router';
import { type Ref, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { refusalTitle } from '../kit/refusal.ts';
import {
  keptProof,
  keptProofRanOut,
  signedInWith,
  transferSentKept,
  tripRefused,
} from '../kit/waysProof.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { reloadSignedIn, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field, FieldError, focusChecked, keysStayDown, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { PasswordField } from './PasswordField.tsx';
import { ProviderButton } from './ProviderSignIn.tsx';
import { AnswerHeading } from './AnswerHeading.tsx';
import { type StepClosed, stepClosed, useAboveKeyboard, useFocusBackToOpener } from './Screen.tsx';
import { Text } from './Text.tsx';

type Preview =
  { kind: 'counting' } | { kind: 'counted'; counted: OrganisationDeletion } | { kind: 'failed' };

type Step =
  | { kind: 'resting'; flash: string | null; closed?: StepClosed }
  | { kind: 'transfer'; fromLeave: boolean }
  | { kind: 'leave' }
  | { kind: 'delete' };

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
  const { account } = useSignedIn();
  const via = account == null ? 'password' : confirmWith(account.hasPassword, account.providers);
  const [step, setStep] = useState<Step>({ kind: 'resting', flash: null });
  const [members, setMembers] = useState<OrganisationMember[] | null>(null);
  const opener = useFocusBackToOpener(step.kind === 'resting' ? step.closed : undefined);
  const backTo = (to: string) => setStep({ kind: 'resting', flash: null, closed: stepClosed(to) });

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
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={step.flash}
              answer={step}
              takesFocus
            />
          )}
          {owner && (
            <Row
              title={t('ownership.transfer')}
              note={
                via === 'password' || via == null
                  ? t('ownership.transferNote', { organisation: name })
                  : t('ownership.transferNoteProvider', {
                      organisation: name,
                      provider: PROVIDER_NAMES[via],
                    })
              }
              action={t('ownership.transfer')}
              opener={opener('transfer')}
              onPress={() => setStep({ kind: 'transfer', fromLeave: false })}
              testID="ownership.transfer"
            />
          )}
          <Row
            title={t('ownership.leave', { organisation: name })}
            note={t('ownership.leaveNote', { organisation: name })}
            action={t('ownership.leave', { organisation: name })}
            opener={opener('leave')}
            onPress={() => setStep({ kind: 'leave' })}
            testID="ownership.leave"
          />
          {owner && (
            <Row
              title={t('ownership.delete')}
              note={t('ownership.deleteNote')}
              action={t('ownership.delete')}
              opener={opener('delete')}
              onPress={() => setStep({ kind: 'delete' })}
              testID="ownership.delete"
            />
          )}
        </>
      )}

      {step.kind === 'transfer' && (
        <Transfer
          answer={step}
          organisation={organisation}
          via={via}
          candidates={others}
          onCancel={() => backTo(step.fromLeave ? 'leave' : 'transfer')}
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
          answer={step}
          organisation={organisation}
          onlyOwner={onlyOwner}
          onTransfer={() => setStep({ kind: 'transfer', fromLeave: true })}
          onStay={() => backTo('leave')}
        />
      )}

      {step.kind === 'delete' && (
        <Delete answer={step} organisation={organisation} onKeep={() => backTo('delete')} />
      )}
    </View>
  );
}

function Row({
  title,
  note,
  action,
  opener,
  onPress,
  testID,
}: {
  title: string;
  note: string;
  action: string;
  opener: Ref<ViewInstance>;
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
      <SecondaryButton ref={opener} label={action} onPress={onPress} testID={testID} />
    </View>
  );
}

type TransferField = 'owner' | 'password' | 'code';

/** Google or Apple brought the owner back: the proof, or the code still to come when two-factor is on. */
interface Vouched {
  email: string | null;
  proof: string | null;
}

function Transfer({
  answer,
  organisation,
  via,
  candidates,
  onCancel,
  onDone,
}: {
  answer: Step;
  organisation: Membership;
  via: 'password' | Provider | null;
  candidates: OrganisationMember[];
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const provider = via === 'password' ? null : via;
  const [vouched, setVouched] = useState<Vouched | null>(null);
  // The five minutes from Google's or Apple's sign-in ran out before the press: back to Continue, the owner kept.
  const [expired, setExpired] = useState<object | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeAsked, setCodeAsked] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<{ field: TransferField | null; message: string } | null>(
    null,
  );
  const ownerRow = useRef<ViewInstance>(null);
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const chosen = candidates.find((one) => one.id === picked) ?? null;
  const name = organisation.name;

  const checks = useFormChecks<TransferField>(
    ['owner', 'password', 'code'],
    (field, value) => {
      if (field === 'owner') return value === '' ? t('ownership.ownerBlank') : null;
      if (field === 'password')
        return provider == null && pending == null && value === ''
          ? t('ownership.passwordBlank')
          : null;

      return codeAsked && value.trim() === '' ? t('ownership.codeBlank') : null;
    },
    (field) => {
      if (field === 'password') focusChecked(passwordInput);
      if (field === 'code') focusChecked(codeInput);
    },
  );

  async function continueWith(by: Provider): Promise<void> {
    if (busy || !checks.passes({ owner: picked ?? '', password, code })) return;

    setBusy(true);
    setRefused(null);
    setExpired(null);

    try {
      const { proof } = await api.prove({
        provider: by,
        signIn: await confirmWithProvider(by, true),
      });
      setVouched({ email: null, proof });
    } catch (error) {
      const signedIn = signedInWith(by, error, null);
      if (signedIn != null) {
        setPending(keptProof(error, null));
        setVouched({ ...signedIn, proof: null });
        setCodeAsked(true);
      } else {
        // Closing Google or Apple says so too: nothing was transferred, and the owner stays chosen.
        setRefused({
          field: null,
          message: tripRefused(error)
            ? t('waysCard.providerRefused', { provider: PROVIDER_NAMES[by] })
            : t('waysCard.providerFailed', { provider: PROVIDER_NAMES[by] }),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(): Promise<void> {
    if (busy || !checks.passes({ owner: picked ?? '', password, code }) || chosen == null) return;
    if (provider != null && vouched == null) return;

    keysStayDown();
    setBusy(true);
    setRefused(null);

    try {
      const proof =
        vouched?.proof ??
        (
          await api.prove(
            pending != null ? { pendingProof: pending } : { password },
            codeAsked ? code.trim() : undefined,
          )
        ).proof;
      await api.transferOwnership(organisation.id, chosen.id, proof);
      await reloadSignedIn();
      onDone(chosen.user.name);
    } catch (error) {
      setBusy(false);
      if (!(error instanceof ApiError)) {
        setRefused({ field: null, message: t('ownership.failed') });

        return;
      }

      if (keptProofRanOut(error, transferSentKept(vouched, pending))) {
        setVouched(null);
        setPending(null);
        setCodeAsked(false);
        setCode('');
        setExpired({});
        if (provider == null) setRefused({ field: null, message: error.problem.title });

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
      <AnswerHeading answer={answer} size={tokens.typeButton.size} weight="semibold">
        {t('ownership.transfer')}
      </AnswerHeading>
      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {t('ownership.transferBody', { organisation: name })}
      </Text>

      {refused?.field === null && (
        <ReadOut words={refused.message} interrupts accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={refused.message} />
        </ReadOut>
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

      {expired != null && provider != null && (
        <Notice
          tone="attention"
          mark="!"
          body={t('waysCard.proofExpired', {
            provider: PROVIDER_NAMES[provider],
            count: PROOF_MINUTES,
          })}
          answer={expired}
        />
      )}

      {provider == null && (
        <Field
          label={t('ownership.password')}
          error={passwordError}
          help={t('ownership.passwordWhy', { organisation: name })}
        >
          <PasswordField
            ref={passwordInput}
            accessibilityLabel={t('ownership.password')}
            value={password}
            wrong={passwordError != null}
            submitting={busy || pending != null}
            autoComplete="current-password"
            textContentType="password"
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

      {provider != null && vouched == null && (
        <>
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[provider] })}
          </Text>
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {t('ownership.passwordWhy', { organisation: name })}
          </Text>
        </>
      )}

      {provider != null && vouched != null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.done.glyph}
          markTone="done"
          title={t('waysCard.signedInWith', { provider: PROVIDER_NAMES[provider] })}
          accentTitle
          detail={vouched.email}
          announce
        />
      )}

      {codeAsked && (
        <Field label={t('ownership.code')} error={codeError}>
          <CodeField
            ref={codeInput}
            accessibilityLabel={t('ownership.code')}
            value={code}
            wrong={codeError != null}
            takesRecoveryCode
            submitting={busy}
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

      {provider != null && vouched == null ? (
        <ProviderButton
          provider={provider}
          label={t('waysCard.continueWith', { provider: PROVIDER_NAMES[provider] })}
          busy={busy}
          onPress={() => void continueWith(provider)}
          testID="ownership.transfer.provider"
        />
      ) : (
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
      )}
      <QuietButton
        label={t('ownership.keep')}
        onPress={onCancel}
        off={busy}
        testID="ownership.transfer.keep"
      />
    </View>
  );
}

function Leave({
  answer,
  organisation,
  onlyOwner,
  onTransfer,
  onStay,
}: {
  answer: Step;
  organisation: Membership;
  onlyOwner: boolean;
  onTransfer: () => void;
  onStay: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [refusedLast, setRefusedLast] = useState(false);
  const [onlyOwnerAsOpened] = useState(onlyOwner);
  const name = organisation.name;
  const onlyOwnerTitle = t('ownership.onlyOwnerTitle');
  const onlyOwnerBody = t('ownership.onlyOwnerBody');

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
      <AnswerHeading
        answer={onlyOwnerAsOpened ? undefined : answer}
        size={tokens.typeButton.size}
        weight="semibold"
      >
        {t('ownership.leaveTitle', { organisation: name })}
      </AnswerHeading>
      {onlyOwner || refusedLast ? (
        <>
          {onlyOwnerAsOpened ? (
            <Notice
              tone="attention"
              mark="!"
              title={onlyOwnerTitle}
              body={onlyOwnerBody}
              answer={answer}
              takesFocus
            />
          ) : refusedLast ? (
            <Notice
              tone="attention"
              mark="!"
              title={onlyOwnerTitle}
              body={onlyOwnerBody}
              answer={refusedLast}
              takesFocus
            />
          ) : (
            <ReadOut
              words={`${onlyOwnerTitle}\n${onlyOwnerBody}`}
              interrupts
              accessibilityRole="alert"
            >
              <Notice tone="attention" mark="!" title={onlyOwnerTitle} body={onlyOwnerBody} />
            </ReadOut>
          )}
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
          <QuietButton
            label={t('ownership.stay')}
            onPress={onStay}
            off={busy}
            testID="ownership.leave.stay"
          />
        </>
      )}
    </View>
  );
}

function Delete({
  answer,
  organisation,
  onKeep,
}: {
  answer: Step;
  organisation: Membership;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<Preview>({ kind: 'counting' });
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const input = useRef<TextInputInstance>(null);
  const aboveKeyboard = useAboveKeyboard();
  const name = organisation.name;
  const matches = typedNameMatches(typed, name);
  const heard = useMemo(() => ({ answer, attempt }), [answer, attempt]);

  useEffect(() => {
    let current = true;

    api.organisationDeletion(organisation.id).then(
      (counted) => current && setPreview({ kind: 'counted', counted }),
      () => current && setPreview({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, attempt]);

  async function submit(): Promise<void> {
    if (busy) return;

    if (!matches) {
      setMismatch(t('ownership.deleteMismatch', { organisation: name }));
      focusChecked(input);

      return;
    }

    keysStayDown();
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
      <AnswerHeading answer={heard} size={tokens.typeButton.size} weight="semibold">
        {t('ownership.deleteTitle', { organisation: name })}
      </AnswerHeading>
      {preview.kind === 'failed' ? (
        <View style={styles.choices}>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('ownership.deleteWarningTitle')}
            body={t('ownership.deleteUncounted')}
            announce
          />
          <SecondaryButton
            label={t('ownership.deleteRetry')}
            onPress={() => {
              setPreview({ kind: 'counting' });
              setAttempt((n) => n + 1);
            }}
            testID="ownership.delete.retry"
          />
        </View>
      ) : (
        <Notice
          tone="attention"
          mark="!"
          title={t('ownership.deleteWarningTitle')}
          body={
            preview.kind === 'counting'
              ? t('ownership.deleteLoading')
              : `${t('ownership.deleteCounts', {
                  events: t('ownership.events', { count: preview.counted.events }),
                  guests: t('ownership.guests', { count: preview.counted.guests }),
                  members: t('ownership.members', { count: preview.counted.members }),
                })} ${t('ownership.deleteWindow', { deadline: preview.counted.restoreCloses })}`
          }
        />
      )}
      {failed != null && (
        <ReadOut
          words={failed}
          interrupts
          accessibilityRole="alert"
          testID="ownership.delete.refused"
        >
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failed} />
        </ReadOut>
      )}
      <View {...aboveKeyboard} style={styles.form}>
        <Field
          label={t('ownership.deleteType', { organisation: name })}
          error={mismatch}
          help={matches ? t('ownership.deleteMatches') : t('ownership.deleteExactly')}
        >
          <TextField
            ref={input}
            accessibilityLabel={t('ownership.deleteType', { organisation: name })}
            value={typed}
            wrong={mismatch != null}
            submitting={busy}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            onChangeText={(value) => {
              setTyped(value);
              if (typedNameMatches(value, name)) setMismatch(null);
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
        <QuietButton
          label={t('ownership.deleteKeep', { organisation: name })}
          onPress={onKeep}
          off={busy}
          testID="ownership.delete.keep"
        />
      </View>
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
