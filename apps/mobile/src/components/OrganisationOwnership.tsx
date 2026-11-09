import { ApiError, type OrganisationDeletion, type Provider } from '@soirely/api-client';
import { PROOF_MINUTES, typedNameMatches } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { refusalTitle } from '../kit/refusal.ts';
import {
  keptProof,
  keptProofRanOut,
  signedInWith,
  transferSentKept,
  tripRefused,
} from '../kit/waysProof.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { FailureLine } from './FailureLine.tsx';
import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { type OrganisationCalls } from './OrganisationJoining.tsx';
import { PasswordField } from './PasswordField.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import {
  Ask,
  type AskProps,
  ChoiceRow,
  FocusedScreen,
  Line,
  RowList,
  SectionHead,
  ShapeMark,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';

export interface Candidate {
  id: string;
  name: string;
  role: string;
}

type OwnershipStep = 'transfer' | 'leave' | 'delete';

export interface OwnershipOpening {
  screen: 'transfer' | 'delete' | null;
  ask: 'leave' | 'onlyOwner' | null;
  transfer: { password: string } | null;
  mistyped: string | null;
}

export const AT_REST: OwnershipOpening = {
  screen: null,
  ask: null,
  transfer: null,
  mistyped: null,
};

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Transfer, leave and delete as text actions (sc-68); transfer and delete on screens of their own, leaving as an Ask. */
export function OwnershipSection({
  organisation,
  calls,
  owner,
  onlyOwner,
  candidates,
  via,
  opening = AT_REST,
  leaveRef: givenLeaveRef,
  onLeave,
  onTransferred,
  onGone,
}: {
  organisation: { id: string; name: string };
  calls: OrganisationCalls;
  owner: boolean;
  onlyOwner: boolean;
  candidates: readonly Candidate[];
  /** How the owner proves it is them: a password, or the provider they sign in with. */
  via: 'password' | Provider;
  opening?: OwnershipOpening;
  /** Leave without the plain Ask, as the demo hands over first (sc-614); the product has no handover yet. */
  onLeave?: (() => void) | undefined;
  leaveRef?: RefObject<ViewInstance | null>;
  onTransferred: (name: string) => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const name = organisation.name;
  const [screen, setScreen] = useState<'transfer' | 'delete' | null>(opening.screen);
  const [visit, setVisit] = useState(0);
  const [ask, setAsk] = useState<'leave' | 'onlyOwner' | null>(opening.ask);
  const [leaving, setLeaving] = useState(false);
  const [notLeft, setNotLeft] = useState<string | null>(null);
  const transferRef = useRef<ViewInstance>(null);
  const ownLeaveRef = useRef<ViewInstance>(null);
  const leaveRef = givenLeaveRef ?? ownLeaveRef;
  const deleteRef = useRef<ViewInstance>(null);
  const refs = { transfer: transferRef, leave: leaveRef, delete: deleteRef };
  const steps: OwnershipStep[] = owner ? ['transfer', 'leave', 'delete'] : ['leave'];
  const rows: Record<OwnershipStep, { label: string; note: string; removes: boolean }> = {
    transfer: {
      label: t('ownership.transfer'),
      note:
        via === 'password'
          ? t('ownership.transferNote', { organisation: name })
          : t('ownership.transferNoteProvider', {
              organisation: name,
              provider: PROVIDER_NAMES[via],
            }),
      removes: false,
    },
    leave: {
      label: t('ownership.leaveOpener', { organisation: name }),
      note: t('ownership.leaveNote', { organisation: name }),
      removes: true,
    },
    delete: {
      label: t('ownership.deleteOpener'),
      note: t('ownership.deleteNote'),
      removes: true,
    },
  };

  function open(step: OwnershipStep): void {
    if (step === 'leave') {
      setNotLeft(null);
      if (owner && onlyOwner) setAsk('onlyOwner');
      else if (onLeave != null) onLeave();
      else setAsk('leave');
      return;
    }
    setVisit((count) => count + 1);
    setScreen(step);
  }

  async function leave(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    setNotLeft(null);

    try {
      await calls.leaveOrganisation(organisation.id);
      setAsk(null);
      onGone();
    } catch (error) {
      if (error instanceof ApiError && error.is('last_owner')) setAsk('onlyOwner');
      else setNotLeft(refusalTitle(error, t('ownership.failed')));
    } finally {
      setLeaving(false);
    }
  }

  const asked: AskProps =
    ask === 'onlyOwner'
      ? {
          title: t('ownership.onlyOwnerTitle'),
          line: t('ownership.onlyOwnerBody'),
          keep: { label: t('ownership.stay'), testID: 'organisation.leave.stay' },
          confirm: owner
            ? { label: t('ownership.transfer'), testID: 'organisation.leave.transfer' }
            : null,
          onKeep: () => setAsk(null),
          onConfirm: () => {
            setAsk(null);
            open('transfer');
          },
        }
      : {
          title: t('ownership.leaveTitle', { organisation: name }),
          line: t('ownership.leaveBody', { organisation: name }),
          keep: { label: t('ownership.stay'), testID: 'organisation.leave.stay', off: leaving },
          confirm: {
            label: t('ownership.leave', { organisation: name }),
            testID: 'organisation.leave.confirm',
            removes: true,
            busy: leaving ? t('ownership.leave', { organisation: name }) : undefined,
          },
          failed: notLeft,
          onKeep: () => {
            if (!leaving) setAsk(null);
          },
          onConfirm: () => void leave(),
        };
  return (
    <>
      <View>
        <SectionHead title={t('ownership.title')} />
        <RowList
          items={steps.map((step) => ({
            key: step,
            row: (
              <View style={styles.step}>
                <TextAction
                  ref={refs[step]}
                  label={rows[step].label}
                  removes={rows[step].removes}
                  onPress={() => open(step)}
                  consequence={rows[step].note}
                  testID={`organisation.ownership.${step}`}
                />
              </View>
            ),
          }))}
        />
      </View>
      <Ask open={ask != null} opener={leaveRef} {...asked} />
      {owner && (
        <TransferScreen
          key={`transfer.${visit}`}
          open={screen === 'transfer'}
          organisation={organisation}
          calls={calls}
          candidates={candidates}
          via={via}
          typed={visit === 0 ? opening.transfer : null}
          opener={transferRef}
          onClose={() => setScreen(null)}
          onDone={(to) => {
            setScreen(null);
            onTransferred(to);
          }}
        />
      )}
      {owner && (
        <DeleteScreen
          key={`delete.${visit}`}
          open={screen === 'delete'}
          organisation={organisation}
          calls={calls}
          mistyped={visit === 0 ? opening.mistyped : null}
          opener={deleteRef}
          onClose={() => setScreen(null)}
          onDeleted={onGone}
        />
      )}
    </>
  );
}

type TransferField = 'owner' | 'password' | 'code';

/** Google or Apple brought the owner back: the proof, or the code still to come when two-factor is on. */
interface Vouched {
  email: string | null;
  proof: string | null;
}

function TransferScreen({
  open,
  organisation,
  calls,
  candidates,
  via,
  typed,
  opener,
  onClose,
  onDone,
}: {
  open: boolean;
  organisation: { id: string; name: string };
  calls: OrganisationCalls;
  candidates: readonly Candidate[];
  via: 'password' | Provider;
  typed: { password: string } | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const provider = via === 'password' ? null : via;
  const name = organisation.name;
  const [startPassword] = useState(typed?.password ?? '');
  const [picked, setPicked] = useState<string | null>(
    typed == null ? null : (candidates[0]?.id ?? null),
  );
  const [vouched, setVouched] = useState<Vouched | null>(null);
  // The five minutes from Google's or Apple's sign-in ran out before the press: back to Continue, the owner kept.
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [codeAsked, setCodeAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<TransferField, string>>>({});
  const [ownerAnswer, setOwnerAnswer] = useState<object | undefined>(undefined);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ field: null; message: string } | null>(null);
  const password = useRef(startPassword);
  const code = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const chosen = candidates.find((one) => one.id === picked) ?? null;

  function drop(field: TransferField): void {
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];

      return next;
    });
  }

  function checked(): boolean {
    const found: Partial<Record<TransferField, string>> = {
      ...(chosen == null && { owner: t('ownership.ownerBlank') }),
      ...(provider == null &&
        pending == null &&
        password.current === '' && { password: t('ownership.passwordBlank') }),
      ...(codeAsked && code.current.trim() === '' && { code: t('ownership.codeBlank') }),
    };
    setErrors(found);
    if (found.owner != null) setOwnerAnswer({});
    else if (found.password != null) focusChecked(passwordInput);
    else if (found.code != null) focusChecked(codeInput);

    return Object.keys(found).length === 0;
  }

  async function continueWith(by: Provider): Promise<void> {
    if (busy) return;

    setBusy(true);
    setProviderError(null);
    setExpired(false);

    try {
      const { proof } = await calls.prove({
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
        setProviderError(
          tripRefused(error)
            ? t('waysCard.providerRefused', { provider: PROVIDER_NAMES[by] })
            : t('waysCard.providerFailed', { provider: PROVIDER_NAMES[by] }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(): Promise<void> {
    if (busy || !checked() || chosen == null) return;
    if (provider != null && vouched == null) return;

    keysStayDown();
    setBusy(true);
    setRefused(null);

    try {
      const proof =
        vouched?.proof ??
        (
          await calls.prove(
            pending != null ? { pendingProof: pending } : { password: password.current },
            codeAsked ? code.current.trim() : undefined,
          )
        ).proof;
      await calls.transferOwnership(organisation.id, chosen.id, proof);
      setBusy(false);
      onDone(chosen.name);
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
        code.current = '';
        setExpired(true);
        if (provider == null) setRefused({ field: null, message: error.problem.title });

        return;
      }

      setPending(error.problem.pendingProof ?? pending);

      if (error.is('two_factor_required')) setCodeAsked(true);
      else if (error.is('invalid_credentials')) {
        setErrors({ password: t('ownership.passwordWrong') });
        focusRefused(passwordInput);
      } else if (error.is('two_factor_code_invalid') || error.is('recovery_code_used')) {
        setErrors({ code: error.problem.title });
        focusRefused(codeInput);
      } else setRefused({ field: null, message: error.problem.title });
    }
  }

  const lapsed = expired && provider != null;

  return (
    <FocusedScreen
      open={open}
      title={t('ownership.transfer')}
      verb={{
        label: t('ownership.transferVerb'),
        on: !busy && (provider == null || vouched != null),
        onPress: () => void submit(),
        testID: 'organisation.transfer.send',
      }}
      onCancel={onClose}
      waits={busy}
      cancelTestID="organisation.transfer.cancel"
      opener={opener}
      testID="organisation.transfer"
    >
      <Line text={t('ownership.transferBody', { organisation: name })} />
      {refused != null && (
        <FailureLine words={refused.message} testID="organisation.transfer.failed" />
      )}
      <View>
        <SectionHead title={t('ownership.newOwner')} />
        {errors.owner != null && <FieldError message={errors.owner} answer={ownerAnswer} />}
        <View accessibilityRole="radiogroup">
          <RowList
            items={candidates.map((member) => ({
              key: member.id,
              row: (
                <ChoiceRow
                  title={member.name}
                  line={member.role}
                  on={member.id === picked}
                  onPress={() => {
                    setPicked(member.id);
                    drop('owner');
                  }}
                  testID={`organisation.transfer.${member.id}`}
                />
              ),
            }))}
          />
        </View>
      </View>
      {provider == null && (
        <Field
          label={t('ownership.password')}
          error={errors.password}
          help={t('ownership.passwordWhy', { organisation: name })}
        >
          <PasswordField
            ref={passwordInput}
            defaultValue={startPassword}
            onChangeText={(text) => {
              password.current = text;
              if (errors.password != null && text !== '') drop('password');
            }}
            wrong={errors.password != null}
            submitting={busy || pending != null}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            submitBehavior="submit"
            accessibilityLabel={t('ownership.password')}
            testID="organisation.transfer.password"
          />
        </Field>
      )}
      {provider != null && vouched == null && (
        <View style={styles.prove}>
          <Line text={t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[provider] })} />
          <Pill
            kind="secondary"
            label={t('waysCard.continueWith', { provider: PROVIDER_NAMES[provider] })}
            onPress={() => void continueWith(provider)}
            testID="organisation.transfer.provider"
          />
          {providerError != null && <FieldError message={providerError} />}
          {lapsed && (
            <FieldError
              message={t('waysCard.proofExpired', {
                provider: PROVIDER_NAMES[provider],
                count: PROOF_MINUTES,
              })}
            />
          )}
        </View>
      )}
      {provider != null && vouched != null && (
        <View style={styles.signedIn} testID="organisation.transfer.signedIn">
          <View {...hidden}>
            <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />
          </View>
          <Text size={15} weight="semibold">
            {t('waysCard.signedInWith', { provider: PROVIDER_NAMES[provider] })}
          </Text>
        </View>
      )}
      {codeAsked && (
        <Field label={t('ownership.code')} error={errors.code}>
          <CodeField
            ref={codeInput}
            takesRecoveryCode
            defaultValue=""
            onChangeText={(text) => {
              code.current = text;
              if (errors.code != null && text.trim() !== '') drop('code');
            }}
            wrong={errors.code != null}
            submitting={busy}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            submitBehavior="submit"
            accessibilityLabel={t('ownership.code')}
            testID="organisation.transfer.code"
          />
        </Field>
      )}
      <Line
        text={t('ownership.bothEmailed', { name: chosen?.name ?? t('ownership.theNewOwner') })}
      />
    </FocusedScreen>
  );
}

type Counted =
  { kind: 'counting' } | { kind: 'counted'; counted: OrganisationDeletion } | { kind: 'failed' };

function DeleteScreen({
  open,
  organisation,
  calls,
  mistyped,
  opener,
  onClose,
  onDeleted,
}: {
  open: boolean;
  organisation: { id: string; name: string };
  calls: OrganisationCalls;
  mistyped: string | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const name = organisation.name;
  const [counted, setCounted] = useState<Counted>({ kind: 'counting' });
  const [attempt, setAttempt] = useState(0);
  const [startTyped] = useState(mistyped ?? '');
  const [matches, setMatches] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(
    mistyped == null ? null : t('ownership.deleteMismatch', { organisation: name }),
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = useRef(startTyped);
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;

    calls.organisationDeletion(organisation.id).then(
      (found) => current && setCounted({ kind: 'counted', counted: found }),
      () => current && setCounted({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [calls, organisation.id, attempt, open]);

  async function remove(): Promise<void> {
    if (busy) return;
    if (!typedNameMatches(typed.current, name)) {
      setMismatch(t('ownership.deleteMismatch', { organisation: name }));
      focusChecked(input);
      return;
    }

    keysStayDown();
    setBusy(true);
    setFailed(null);

    try {
      await calls.deleteOrganisation(organisation.id, typed.current);
      setBusy(false);
      onDeleted();
    } catch (error) {
      setBusy(false);
      const violation =
        error instanceof ApiError
          ? error.problem.violations?.find((one) => one.propertyPath === 'name')
          : undefined;

      if (violation != null) {
        setMismatch(violation.message);
        focusRefused(input);
      } else setFailed(refusalTitle(error, t('ownership.failed')));
    }
  }

  return (
    <FocusedScreen
      open={open}
      title={t('ownership.deleteScreenTitle', { organisation: name })}
      verb={{
        label: t('ownership.deleteVerb'),
        on: !busy,
        removes: true,
        onPress: () => void remove(),
        testID: 'organisation.delete.send',
      }}
      onCancel={onClose}
      waits={busy}
      cancelTestID="organisation.delete.cancel"
      opener={opener}
      testID="organisation.delete"
    >
      <View style={styles.warning}>
        <Text size={18} weight="bold" accessibilityRole="header">
          {t('ownership.deleteWarningTitle')}
        </Text>
        {counted.kind === 'counting' && <Line text={t('ownership.deleteLoading')} />}
        {counted.kind === 'counted' && (
          <Line
            text={`${t('ownership.deleteCounts', {
              events: t('ownership.events', { count: counted.counted.events }),
              guests: t('ownership.guests', { count: counted.counted.guests }),
              members: t('ownership.members', { count: counted.counted.members }),
            })} ${t('ownership.deleteWindow', { deadline: counted.counted.restoreCloses })}`}
          />
        )}
        {counted.kind === 'failed' && (
          <View>
            <View style={styles.uncounted} testID="organisation.delete.uncounted">
              <View style={styles.uncountedMark} {...hidden}>
                <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
              </View>
              <Text size={15} weight="medium" style={styles.grow}>
                {t('ownership.deleteUncounted')}
              </Text>
            </View>
            <TextAction
              label={t('ownership.deleteRetry')}
              onPress={() => {
                setCounted({ kind: 'counting' });
                setAttempt((count) => count + 1);
              }}
              testID="organisation.delete.retry"
            />
          </View>
        )}
      </View>
      {failed != null && <FailureLine words={failed} testID="organisation.delete.failed" />}
      <View>
        <Field
          label={t('ownership.deleteType', { organisation: name })}
          error={mismatch}
          help={matches ? undefined : t('ownership.deleteExactly')}
        >
          <TextField
            ref={input}
            defaultValue={startTyped}
            onChangeText={(text) => {
              typed.current = text;
              const same = typedNameMatches(text, name);
              setMatches(same);
              if (same) setMismatch(null);
            }}
            wrong={mismatch != null}
            submitting={busy}
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => void remove()}
            submitBehavior="submit"
            accessibilityLabel={t('ownership.deleteType', { organisation: name })}
            testID="organisation.delete.name"
          />
        </Field>
        {matches && (
          <View style={styles.matches} testID="organisation.delete.matches">
            <ShapeMark kind="yes" side={16} ink={tokens.marks.done.ink} />
            <Text size={tokens.typeSmall.size} weight="medium" style={styles.secondary}>
              {t('ownership.deleteMatches')}
            </Text>
          </View>
        )}
      </View>
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  grow: { flex: 1, minWidth: 0, lineHeight: 15 * 1.45 },
  step: { paddingVertical: tokens.spaceXs },
  warning: { gap: tokens.spaceXs },
  prove: { gap: tokens.spaceSm },
  signedIn: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  uncounted: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  uncountedMark: { marginTop: tokens.spaceHair },
  matches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceXs,
  },
});
