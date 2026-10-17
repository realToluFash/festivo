import { ApiError, type RecoveryOpening, type RecoveryState } from '@soirely/api-client';
import { cleanCode, codeWording, formatCountdown, formatPhone } from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { heldChallenge } from '../src/challenge.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { CodeField, Field, FieldError } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { StatusMark, type StatusTone } from '../src/components/StatusMark.tsx';
import { Text } from '../src/components/Text.tsx';
import { dropRecovery, heldRecovery, holdRecovery } from '../src/heldRecovery.ts';
import { currentLocale } from '../src/i18n/index.ts';
import { retryAfter } from '../src/kit/code.ts';
import {
  type RecoveryField,
  recoveryCodeProblems,
  replacedElsewhere,
  startRefusal,
  wrongRecoveryCodes,
} from '../src/kit/recovery.ts';
import { tokens } from '../src/theme/tokens.ts';

type Shown =
  | { kind: 'loading' }
  | { kind: 'start'; opening: RecoveryOpening; limitedUntil: string | null; sending: boolean }
  | { kind: 'nobody'; supportAddress: string }
  | { kind: 'request'; recovery: string; state: RecoveryState }
  | { kind: 'replaced' }
  | { kind: 'signIn' }
  | { kind: 'failed' };

/** Lost both the authenticator and the recovery codes (sc-509): nothing on this screen signs anybody in. */
export default function LostTwoFactor() {
  const challenge = heldChallenge()?.challenge ?? null;
  const [view, setView] = useState<Shown>({ kind: 'loading' });

  const load = useCallback(async (): Promise<Shown> => {
    const held = await heldRecovery();

    if (held != null) {
      try {
        return { kind: 'request', recovery: held, state: await api.recoveryState(held) };
      } catch (refusal) {
        if (replacedElsewhere(refusal)) return { kind: 'replaced' };
        if (!(refusal instanceof ApiError && refusal.is('recovery_request_invalid')))
          return { kind: 'failed' };

        await dropRecovery();
      }
    }

    if (challenge == null) return { kind: 'signIn' };

    try {
      const opening = await api.recoveryOpening(challenge);

      if (opening.open != null) {
        await holdRecovery(opening.open.recovery);
        return { kind: 'request', ...opening.open };
      }

      return opening.nobody
        ? { kind: 'nobody', supportAddress: opening.supportAddress }
        : { kind: 'start', opening, limitedUntil: null, sending: false };
    } catch (refusal) {
      return startRefusal(refusal) === 'signIn' ? { kind: 'signIn' } : { kind: 'failed' };
    }
  }, [challenge]);

  useEffect(() => {
    let live = true;

    void load().then((next) => {
      if (live) setView(next);
    });

    return () => {
      live = false;
    };
  }, [load]);

  const reload = (): void => {
    void load().then(setView);
  };

  /** "Start again" from a replaced request: the start screen, never the newer request another device holds. */
  async function startAgain(): Promise<void> {
    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    try {
      const opening = await api.recoveryOpening(challenge);
      setView({ kind: 'start', opening, limitedUntil: null, sending: false });
    } catch (refusal) {
      setView(startRefusal(refusal) === 'signIn' ? { kind: 'signIn' } : { kind: 'failed' });
    }
  }

  async function start(opening: RecoveryOpening): Promise<void> {
    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    setView({ kind: 'start', opening, limitedUntil: null, sending: true });

    try {
      const started = await api.startRecovery(challenge);
      await holdRecovery(started.recovery);
      setView({ kind: 'request', ...started });
    } catch (refusal) {
      const why = startRefusal(refusal);

      if (why === 'limited') {
        setView({
          kind: 'start',
          opening,
          limitedUntil: refusal instanceof ApiError ? (refusal.problem.retryAt ?? '') : '',
          sending: false,
        });
      } else if (why === 'nobody') {
        setView({ kind: 'nobody', supportAddress: opening.supportAddress });
      } else {
        setView(why === 'signIn' ? { kind: 'signIn' } : { kind: 'failed' });
      }
    }
  }

  if (view.kind === 'signIn') return <Redirect href="/sign-in" />;
  if (view.kind === 'loading') return <AuthFrame>{null}</AuthFrame>;
  if (view.kind === 'start') {
    return (
      <Start
        opening={view.opening}
        limitedUntil={view.limitedUntil}
        sending={view.sending}
        onSend={() => void start(view.opening)}
      />
    );
  }
  if (view.kind === 'nobody') return <Nobody supportAddress={view.supportAddress} />;
  if (view.kind === 'replaced') return <Replaced onStartAgain={() => void startAgain()} />;
  if (view.kind === 'failed') return <Failed onRetry={reload} />;

  return (
    <Request
      recovery={view.recovery}
      state={view.state}
      onState={(state) => setView({ ...view, state })}
      onNobody={() => {
        void dropRecovery();
        setView({ kind: 'nobody', supportAddress: view.state.supportAddress });
      }}
      onAskAgain={() => {
        void dropRecovery().then(reload);
      }}
      onReplaced={() => {
        void dropRecovery();
        setView({ kind: 'replaced' });
      }}
    />
  );
}

type Tone = StatusTone;

function Saying({
  title,
  intro,
  mark,
}: {
  title: string;
  intro: string;
  mark?: { tone: Tone; word: string };
}) {
  return (
    <View style={styles.saying}>
      {mark != null && <StatusMark tone={mark.tone} word={mark.word} />}
      <AuthHeading title={title} intro={intro} />
    </View>
  );
}

/** A newer request was started on another device (pm #1267): its codes went there, so this one starts again. */
function Replaced({ onStartAgain }: { onStartAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <AuthFrame
      saying={
        <Saying
          title={t('lostTwoFactor.replacedTitle')}
          intro={t('lostTwoFactor.replacedIntro')}
          mark={{ tone: 'skipped', word: t('lostTwoFactor.replacedMark') }}
        />
      }
    >
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('lostTwoFactor.replacedNote')}
      </Text>
      <PrimaryButton
        label={t('lostTwoFactor.startAgain')}
        onPress={onStartAgain}
        testID="lostTwoFactor.startAgain"
      />
      <BackToSignIn />
    </AuthFrame>
  );
}

function BackToSignIn() {
  const { t } = useTranslation();

  return (
    <QuietButton
      label={t('lostTwoFactor.back')}
      onPress={() => router.replace('/sign-in')}
      testID="lostTwoFactor.back"
    />
  );
}

function Start({
  opening,
  limitedUntil,
  sending,
  onSend,
}: {
  opening: RecoveryOpening;
  limitedUntil: string | null;
  sending: boolean;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const steps = [
    opening.phone == null
      ? t('lostTwoFactor.step1EmailOnly', { email: opening.email })
      : t('lostTwoFactor.step1', { email: opening.email, phone: formatPhone(opening.phone) }),
    t('lostTwoFactor.step2'),
    t('lostTwoFactor.step3', {
      organisations: listed(opening.organisations, 'disjunction'),
    }),
  ];

  return (
    <AuthFrame
      saying={
        <Saying title={t('lostTwoFactor.startTitle')} intro={t('lostTwoFactor.startIntro')} />
      }
    >
      {limitedUntil != null && (
        <Notice
          tone="attention"
          mark="!"
          title={t('lostTwoFactor.limitedTitle')}
          body={
            limitedUntil === ''
              ? t('lostTwoFactor.limitedBodyLater')
              : t('lostTwoFactor.limitedBody', { when: limitedUntil })
          }
        />
      )}
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepMark}>
              <Text size={tokens.typePill.size} weight="bold" style={styles.secondary}>
                {String(index + 1)}
              </Text>
            </View>
            <Text size={tokens.typeBodyPhone.size} style={styles.grow}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('lostTwoFactor.startNote')}
      </Text>
      <PrimaryButton
        label={sending ? t('lostTwoFactor.sending') : t('lostTwoFactor.send')}
        onPress={onSend}
        busy={sending}
        off={limitedUntil != null}
        testID="lostTwoFactor.send"
      />
      <BackToSignIn />
    </AuthFrame>
  );
}

function Nobody({ supportAddress }: { supportAddress: string }) {
  const { t } = useTranslation();

  return (
    <AuthFrame
      saying={
        <Saying title={t('lostTwoFactor.nobodyTitle')} intro={t('lostTwoFactor.nobodyIntro')} />
      }
    >
      <PrimaryButton
        label={t('lostTwoFactor.emailSupport', { address: supportAddress })}
        onPress={() => void Linking.openURL(`mailto:${supportAddress}`)}
        testID="lostTwoFactor.support"
      />
      <BackToSignIn />
    </AuthFrame>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <AuthFrame>
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        title={t('lostTwoFactor.failedTitle')}
        body={t('lostTwoFactor.failedBody')}
      />
      <SecondaryButton
        label={t('lostTwoFactor.retry')}
        onPress={onRetry}
        testID="lostTwoFactor.retry"
      />
      <BackToSignIn />
    </AuthFrame>
  );
}

function Request({
  recovery,
  state,
  onState,
  onNobody,
  onAskAgain,
  onReplaced,
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onAskAgain: () => void;
  onReplaced: () => void;
}) {
  const supportAddress = state.supportAddress;
  const { t } = useTranslation();
  const waiting = state.status === 'waiting';
  const organisations = listed(state.organisations, 'conjunction');
  const anyOf = listed(state.organisations, 'disjunction');

  // Waiting, the answer arrives on its own; the screen follows it within half a minute.
  useEffect(() => {
    if (!waiting) return;

    const watching = setInterval(() => {
      api
        .recoveryState(recovery)
        .then(onState)
        .catch((refusal: unknown) => {
          if (replacedElsewhere(refusal)) onReplaced();
        });
    }, 20_000);

    return () => clearInterval(watching);
  }, [waiting, recovery, onState, onReplaced]);

  if (state.status === 'proving')
    return (
      <Codes
        recovery={recovery}
        state={state}
        onState={onState}
        onNobody={onNobody}
        onReplaced={onReplaced}
      />
    );

  if (waiting) {
    return (
      <AuthFrame
        saying={
          <Saying
            title={t('lostTwoFactor.waitingTitle')}
            intro={t('lostTwoFactor.waitingIntro', { organisations })}
            mark={{ tone: 'progress', word: t('lostTwoFactor.waitingMark') }}
          />
        }
      >
        <Notice
          tone="quiet"
          mark="…"
          body={`${t('lostTwoFactor.asked', { when: state.asked })} ${t('lostTwoFactor.endsBy', { when: state.expires })}`}
        />
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('lostTwoFactor.stayOut', { email: state.email })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {t('lostTwoFactor.notYou')}
        </Text>
        <SecondaryButton
          label={t('lostTwoFactor.cancel')}
          onPress={() => {
            api
              .cancelRecovery(recovery)
              .then(onState)
              .catch((refusal: unknown) => {
                if (replacedElsewhere(refusal)) onReplaced();
              });
          }}
          testID="lostTwoFactor.cancel"
        />
        <BackToSignIn />
      </AuthFrame>
    );
  }

  if (state.status === 'approved') {
    return (
      <AuthFrame
        saying={
          <Saying
            title={t('lostTwoFactor.approvedTitle')}
            intro={t('lostTwoFactor.approvedIntro', { organisations: anyOf })}
            mark={{ tone: 'done', word: t('lostTwoFactor.approvedMark') }}
          />
        }
      >
        <PrimaryButton
          label={t('lostTwoFactor.signIn')}
          onPress={() => {
            void dropRecovery().then(() => router.replace('/sign-in'));
          }}
          testID="lostTwoFactor.signIn"
        />
      </AuthFrame>
    );
  }

  if (state.status === 'turned_down') {
    return (
      <AuthFrame
        saying={
          <Saying
            title={t('lostTwoFactor.turnedDownTitle')}
            intro={t('lostTwoFactor.turnedDownIntro', { organisations: anyOf })}
            mark={{ tone: 'broken', word: t('lostTwoFactor.turnedDownMark') }}
          />
        }
      >
        {supportAddress !== '' && (
          <SecondaryButton
            label={t('lostTwoFactor.emailSupport', { address: supportAddress })}
            onPress={() => void Linking.openURL(`mailto:${supportAddress}`)}
            testID="lostTwoFactor.support"
          />
        )}
        <BackToSignIn />
      </AuthFrame>
    );
  }

  if (state.status === 'expired') {
    return (
      <AuthFrame
        saying={
          <Saying
            title={t('lostTwoFactor.endedTitle')}
            intro={t('lostTwoFactor.endedIntro')}
            mark={{ tone: 'skipped', word: t('lostTwoFactor.endedMark') }}
          />
        }
      >
        <PrimaryButton
          label={t('lostTwoFactor.askAgain')}
          onPress={onAskAgain}
          testID="lostTwoFactor.askAgain"
        />
        <BackToSignIn />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      saying={
        <Saying
          title={t('lostTwoFactor.cancelledTitle')}
          intro={t('lostTwoFactor.cancelledIntro')}
          mark={{ tone: 'skipped', word: t('lostTwoFactor.cancelledMark') }}
        />
      }
    >
      <BackToSignIn />
    </AuthFrame>
  );
}

function Codes({
  recovery,
  state,
  onState,
  onNobody,
  onReplaced,
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onReplaced: () => void;
}) {
  const { t } = useTranslation();
  const codes = state.codes;
  const wording = codeWording(codes?.route ?? null);
  const hasPhone = state.phone != null;
  const number = state.phone == null ? '' : formatPhone(state.phone);
  const fields: RecoveryField[] = hasPhone ? ['emailCode', 'phoneCode'] : ['emailCode'];
  const typed = useRef<Record<RecoveryField, string>>({ emailCode: '', phoneCode: '' });
  const inputs = { emailCode: useRef<TextInput>(null), phoneCode: useRef<TextInput>(null) };
  const [errors, setErrors] = useState<Partial<Record<RecoveryField, string>>>({});
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [textingFailed, setTextingFailed] = useState(false);
  const [cooldown, setCooldown] = useState(codes?.cooldownSeconds ?? 0);
  const lastRoute = useRef(codes?.route ?? null);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  useEffect(() => {
    if (!wording.watch) return;

    const watching = setInterval(() => {
      api
        .recoveryState(recovery)
        .then(onState)
        .catch((refusal: unknown) => {
          if (replacedElsewhere(refusal)) onReplaced();
        });
    }, 5000);

    return () => clearInterval(watching);
  }, [wording.watch, recovery, onState, onReplaced]);

  const sent = {
    whatsapp: t('lostTwoFactor.sentWhatsApp', { number }),
    fallback: t('lostTwoFactor.sentFallback', { number }),
    chosen: t('lostTwoFactor.sentChosen', { number }),
    texted: t('lostTwoFactor.sentText', { number }),
  }[wording.line];

  // iOS has no live regions, so a fallback is announced by hand, as Android's live region does.
  useEffect(() => {
    if (lastRoute.current === 'whatsapp' && codes?.route === 'sms_fallback') {
      AccessibilityInfo.announceForAccessibility(sent);
    }

    lastRoute.current = codes?.route ?? null;
  }, [codes?.route, sent]);

  const wrong: Record<RecoveryField, string> = {
    emailCode: t('lostTwoFactor.emailWrong'),
    phoneCode: wording.fromWhatsApp
      ? t('lostTwoFactor.phoneWrongWhatsApp')
      : t('lostTwoFactor.phoneWrong'),
  };

  async function submit(): Promise<void> {
    if (asking) return;

    const found = recoveryCodeProblems(fields, typed.current, wording.fromWhatsApp);
    setErrors(Object.fromEntries(Object.entries(found).map(([field, key]) => [field, t(key)])));
    const first = fields.find((field) => found[field] != null);

    if (first != null) {
      inputs[first].current?.focus();
      return;
    }

    setAsking(true);
    setFailed(false);

    try {
      onState(
        await api.proveRecovery(
          recovery,
          cleanCode(typed.current.emailCode),
          hasPhone ? cleanCode(typed.current.phoneCode) : null,
        ),
      );
    } catch (refusal) {
      setAsking(false);

      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      // The last approver left while the codes were out: the request is cancelled, nobody is told.
      if (startRefusal(refusal) === 'nobody') {
        onNobody();
        return;
      }

      const marked = wrongRecoveryCodes(refusal, fields);

      if (marked != null) {
        setErrors(Object.fromEntries(marked.map((field) => [field, wrong[field]])));
        if (marked[0] != null) inputs[marked[0]].current?.focus();
        return;
      }

      if (
        refusal instanceof ApiError &&
        (refusal.is('verification_code_expired') ||
          refusal.is('verification_code_exhausted') ||
          refusal.is('recovery_request_proved'))
      ) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      setFailed(true);
    }
  }

  async function resend(): Promise<void> {
    try {
      const next = await api.resendRecoveryCodes(recovery);
      typed.current = { emailCode: '', phoneCode: '' };
      inputs.emailCode.current?.clear();
      inputs.phoneCode.current?.clear();
      setErrors({});
      setCooldown(next.codes?.cooldownSeconds ?? 0);
      onState(next);
    } catch (refusal) {
      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      // Proved from another device meanwhile: the request is waiting, so its screen opens.
      if (refusal instanceof ApiError && refusal.is('recovery_request_proved')) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      const seconds = retryAfter(refusal);

      if (seconds != null) setCooldown(seconds);
      else setFailed(true);
    }
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      onState(await api.textRecoveryCodeInstead(recovery));
    } catch (refusal) {
      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      if (refusal instanceof ApiError && refusal.is('recovery_request_proved')) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      setTextingFailed(true);
    }
  }

  const spent = codes?.state === 'expired' || codes?.state === 'exhausted';

  return (
    <AuthFrame
      saying={
        <Saying
          title={hasPhone ? t('lostTwoFactor.codesTitle') : t('lostTwoFactor.codesTitleEmailOnly')}
          intro={
            hasPhone
              ? t('lostTwoFactor.codesIntro', { email: state.email, phone: number })
              : t('lostTwoFactor.codesIntroEmailOnly', { email: state.email })
          }
        />
      }
    >
      {spent && (
        <Notice
          tone="attention"
          mark="!"
          title={
            codes?.state === 'expired'
              ? t('lostTwoFactor.expiredTitle')
              : t('lostTwoFactor.exhaustedTitle')
          }
          body={
            codes?.state === 'exhausted'
              ? t('lostTwoFactor.exhaustedBody')
              : hasPhone
                ? t('lostTwoFactor.expiredBody', {
                    message: wording.fromWhatsApp
                      ? t('lostTwoFactor.lastWhatsApp')
                      : t('lostTwoFactor.lastText'),
                  })
                : t('lostTwoFactor.expiredBodyEmailOnly')
          }
        />
      )}
      {failed && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('lostTwoFactor.failedTitle')}
          body={t('lostTwoFactor.failedBody')}
        />
      )}

      {spent ? (
        <PrimaryButton
          label={t('lostTwoFactor.resend')}
          onPress={() => void resend()}
          testID="lostTwoFactor.resend"
        />
      ) : (
        <>
          {fields.map((field, index) => (
            <Field
              key={field}
              label={
                field === 'emailCode'
                  ? t('lostTwoFactor.emailLabel')
                  : wording.fromWhatsApp
                    ? t('lostTwoFactor.phoneLabelWhatsApp')
                    : t('lostTwoFactor.phoneLabel')
              }
              help={
                field === 'emailCode' ? t('lostTwoFactor.sentTo', { email: state.email }) : sent
              }
              error={errors[field] ?? null}
            >
              <CodeField
                ref={inputs[field]}
                wrong={errors[field] != null}
                editable={!asking}
                onChangeText={(text) => {
                  typed.current = { ...typed.current, [field]: text };
                  setErrors((now) => ({ ...now, [field]: undefined }));
                }}
                returnKeyType={index === fields.length - 1 ? 'go' : 'next'}
                onSubmitEditing={() =>
                  index === fields.length - 1 ? void submit() : inputs.phoneCode.current?.focus()
                }
                accessibilityLabel={
                  field === 'emailCode'
                    ? t('lostTwoFactor.emailLabel')
                    : t('lostTwoFactor.phoneLabel')
                }
                testID={`lostTwoFactor.${field}`}
              />
            </Field>
          ))}
          <PrimaryButton
            label={asking ? t('lostTwoFactor.asking') : t('lostTwoFactor.ask')}
            onPress={() => void submit()}
            busy={asking}
            testID="lostTwoFactor.ask"
          />
          <SecondaryButton
            label={
              cooldown > 0
                ? t('lostTwoFactor.resendIn', { time: formatCountdown(cooldown) })
                : t('lostTwoFactor.resend')
            }
            onPress={() => void resend()}
            off={cooldown > 0}
            testID="lostTwoFactor.resend"
          />
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {t('lostTwoFactor.resendNote')}
          </Text>
          {hasPhone && wording.offerText && (
            <SecondaryButton
              label={t('lostTwoFactor.textInstead')}
              onPress={() => void textInstead()}
              testID="lostTwoFactor.textInstead"
            />
          )}
          {textingFailed && <FieldError message={t('lostTwoFactor.textInsteadFailed')} />}
        </>
      )}
      <BackToSignIn />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  saying: { gap: tokens.spaceSm },
  steps: { gap: tokens.spaceMd },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  stepMark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  secondary: { color: tokens.colorInkSecondary },
});

function listed(names: string[], type: 'conjunction' | 'disjunction'): string {
  return new Intl.ListFormat(currentLocale(), { type }).format(names);
}
