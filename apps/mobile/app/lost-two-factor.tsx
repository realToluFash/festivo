import { ApiError, type RecoveryOpening, type RecoveryState } from '@soirely/api-client';
import {
  cleanCode,
  codeWording,
  formatCountdown,
  formatPhone,
  recoveryIntroKey,
} from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Linking, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { heldChallenge } from '../src/challenge.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from '../src/components/Buttons.tsx';
import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
} from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { useFocusOnAnswer } from '../src/components/Screen.tsx';
import { readOut } from '../src/components/ReadOut.tsx';
import { StatusMark, type StatusTone } from '../src/components/StatusMark.tsx';
import { Text } from '../src/components/Text.tsx';
import { dropRecovery, heldRecovery, holdRecovery } from '../src/heldRecovery.ts';
import { currentLocale } from '../src/i18n/index.ts';
import { retryAfter } from '../src/kit/code.ts';
import {
  type RecoveryField,
  loadRecovery,
  type RecoveryShown,
  recoveryCodeLabel,
  recoveryCodeProblems,
  replacedElsewhere,
  startRefusal,
  wrongRecoveryCodes,
} from '../src/kit/recovery.ts';
import { tokens } from '../src/theme/tokens.ts';
import { useMarkSide } from '../src/components/markSide.ts';

type Shown = RecoveryShown;

/** The tap the step showing answers, for its heading to take screen reader focus (sc-11032). */
const Tapped = createContext<object | undefined>(undefined);

/** Lost both the authenticator and the recovery codes (sc-509): nothing on this screen signs anybody in. */
export default function LostTwoFactor() {
  const challenge = heldChallenge()?.challenge ?? null;
  const [view, setShown] = useState<Shown>({ kind: 'loading' });
  const [tapped, setTapped] = useState<object | undefined>(undefined);
  const tapping = useRef(false);
  const markTap = useCallback(() => {
    tapping.current = true;
  }, []);
  const setView = useCallback((next: Shown) => {
    setTapped(tapping.current ? {} : undefined);
    tapping.current = false;
    setShown(next);
  }, []);

  const load = useCallback(
    async (): Promise<Shown> =>
      loadRecovery({
        challenge,
        held: heldRecovery,
        hold: holdRecovery,
        drop: dropRecovery,
        state: (recovery) => api.recoveryState(recovery),
        opening: (asked) => api.recoveryOpening(asked),
      }),
    [challenge],
  );

  useEffect(() => {
    let live = true;

    void load().then((next) => {
      if (live) setView(next);
    });

    return () => {
      live = false;
    };
  }, [load, setView]);

  const reload = (): void => {
    void load().then((next) => {
      markTap();
      setView(next);
    });
  };

  /** "Start again" from a replaced request: the start screen, never the newer request another device holds. */
  async function startAgain(): Promise<void> {
    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    try {
      const opening = await api.recoveryOpening(challenge);
      markTap();
      setView({ kind: 'start', opening, limitedUntil: null, sending: false });
    } catch (refusal) {
      markTap();
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
      markTap();
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
        markTap();
        setView({ kind: 'nobody', supportAddress: opening.supportAddress });
      } else {
        markTap();
        setView(why === 'signIn' ? { kind: 'signIn' } : { kind: 'failed' });
      }
    }
  }

  return <Tapped.Provider value={tapped}>{shown()}</Tapped.Provider>;

  function shown(): ReactNode {
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
    if (view.kind === 'failed') return <Failed failure={view} onRetry={reload} />;

    return (
      <Request
        recovery={view.recovery}
        state={view.state}
        onTap={markTap}
        onState={(state) => {
          // A step that changes on its own brings a new heading, which takes focus as after a tap (sc-11173).
          if (state.status !== view.state.status) markTap();
          setView({ ...view, state });
        }}
        onNobody={() => {
          void dropRecovery();
          setView({ kind: 'nobody', supportAddress: view.state.supportAddress });
        }}
        onAskAgain={() => {
          void dropRecovery().then(reload);
        }}
        onReplaced={() => {
          void dropRecovery();
          markTap();
          setView({ kind: 'replaced' });
        }}
      />
    );
  }
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
  const tapped = useContext(Tapped);

  return (
    <View style={styles.saying}>
      {mark != null && <StatusMark tone={mark.tone} word={mark.word} />}
      <AuthHeading title={title} intro={intro} answer={tapped} />
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
  const markSide = useMarkSide(tokens.sizeMark);
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
          answer={limitedUntil}
        />
      )}
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View
              style={[styles.stepMark, markSide]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text
                size={tokens.typePill.size}
                weight="bold"
                style={styles.secondary}
                accessible={false}
              >
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

function Failed({ failure, onRetry }: { failure: Shown; onRetry: () => void }) {
  const { t } = useTranslation();
  const tapped = useContext(Tapped);

  return (
    <AuthFrame>
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        title={t('lostTwoFactor.failedTitle')}
        body={t('lostTwoFactor.failedBody')}
        answer={tapped ?? failure}
        takesFocus={tapped != null}
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
  onTap,
  onState,
  onNobody,
  onAskAgain,
  onReplaced,
}: {
  recovery: string;
  state: RecoveryState;
  /** The next change of step answers a tap. */
  onTap: () => void;
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
        onTap={onTap}
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
            intro={t(recoveryIntroKey('waiting', state.nobody), { organisations })}
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
        {state.nobody && supportAddress !== '' && (
          <SecondaryButton
            label={t('lostTwoFactor.emailSupport', { address: supportAddress })}
            onPress={() => void Linking.openURL(`mailto:${supportAddress}`)}
            testID="lostTwoFactor.support"
          />
        )}
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {t('lostTwoFactor.notYou')}
        </Text>
        <SecondaryButton
          label={t('lostTwoFactor.cancel')}
          onPress={() => {
            api
              .cancelRecovery(recovery)
              .then((cancelled) => {
                onTap();
                onState(cancelled);
              })
              .catch((refusal: unknown) => {
                if (!replacedElsewhere(refusal)) return;
                onTap();
                onReplaced();
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
            intro={t(recoveryIntroKey('approved', state.nobody), { organisations: anyOf })}
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
            intro={t(recoveryIntroKey('turned_down', state.nobody), { organisations: anyOf })}
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
            intro={t(recoveryIntroKey('expired', state.nobody))}
            mark={{ tone: 'skipped', word: t('lostTwoFactor.endedMark') }}
          />
        }
      >
        {state.nobody && supportAddress !== '' && (
          <SecondaryButton
            label={t('lostTwoFactor.emailSupport', { address: supportAddress })}
            onPress={() => void Linking.openURL(`mailto:${supportAddress}`)}
            testID="lostTwoFactor.support"
          />
        )}
        {!state.nobody && (
          <PrimaryButton
            label={t('lostTwoFactor.askAgain')}
            onPress={onAskAgain}
            testID="lostTwoFactor.askAgain"
          />
        )}
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
  onTap,
  onState,
  onNobody,
  onReplaced,
}: {
  recovery: string;
  state: RecoveryState;
  onTap: () => void;
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
  const emailInput = useRef<TextInputInstance>(null);
  const inputs = { emailCode: emailInput, phoneCode: useRef<TextInputInstance>(null) };
  const [errors, setErrors] = useState<Partial<Record<RecoveryField, string>>>({});
  const [asking, setAsking] = useState(false);
  // New with each tap that fails, or that finds the codes spent, so the same words are read out again.
  const [failed, setFailed] = useState<object | null>(null);
  const [foundSpent, setFoundSpent] = useState<object | null>(null);
  const [textingFailed, setTextingFailed] = useState(false);
  // Send new codes in the codes' place brings the fields back, so focus goes to the first (sc-11173).
  const [resentInPlace, setResentInPlace] = useState<object | undefined>(undefined);
  const [textedInPlace, setTextedInPlace] = useState<object | undefined>(undefined);
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

  // The line is help under the field, not a live region, so the fallback is read out by hand.
  useEffect(() => {
    if (lastRoute.current === 'whatsapp' && codes?.route === 'sms_fallback') {
      readOut(sent);
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
      focusChecked(inputs[first]);
      return;
    }

    keysStayDown();
    setAsking(true);
    setFailed(null);
    setResentInPlace(undefined);

    try {
      const proved = await api.proveRecovery(
        recovery,
        cleanCode(typed.current.emailCode),
        hasPhone ? cleanCode(typed.current.phoneCode) : null,
      );
      onTap();
      onState(proved);
    } catch (refusal) {
      setAsking(false);

      if (replacedElsewhere(refusal)) {
        onTap();
        onReplaced();
        return;
      }

      // The last approver left while the codes were out: the request is cancelled, nobody is told.
      if (startRefusal(refusal) === 'nobody') {
        onTap();
        onNobody();
        return;
      }

      const marked = wrongRecoveryCodes(refusal, fields);

      if (marked != null) {
        setErrors(Object.fromEntries(marked.map((field) => [field, wrong[field]])));
        if (marked[0] != null) focusRefused(inputs[marked[0]]);
        return;
      }

      if (
        refusal instanceof ApiError &&
        (refusal.is('verification_code_expired') ||
          refusal.is('verification_code_exhausted') ||
          refusal.is('recovery_request_proved'))
      ) {
        onState(await api.recoveryState(recovery).catch(() => state));
        setFoundSpent({});
        return;
      }

      setFailed({});
    }
  }

  async function resend(): Promise<void> {
    try {
      const next = await api.resendRecoveryCodes(recovery);
      setFoundSpent(null);
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
      else setFailed({});
    }
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      onState(await api.textRecoveryCodeInstead(recovery));
      setTextedInPlace({});
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
  useFocusOnAnswer<TextInputInstance>(spent ? undefined : resentInPlace, emailInput);

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
          answer={foundSpent ?? undefined}
          takesFocus={foundSpent != null}
        />
      )}
      {failed != null && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('lostTwoFactor.failedTitle')}
          body={t('lostTwoFactor.failedBody')}
          answer={failed}
        />
      )}

      {spent ? (
        <PrimaryButton
          label={t('lostTwoFactor.resend')}
          onPress={() => {
            setResentInPlace({});
            void resend();
          }}
          testID="lostTwoFactor.resend"
        />
      ) : (
        <>
          {fields.map((field, index) => (
            <Field
              key={field}
              label={t(recoveryCodeLabel(field, wording.fromWhatsApp))}
              help={
                field === 'emailCode' ? t('lostTwoFactor.sentTo', { email: state.email }) : sent
              }
              helpAnswer={field === 'phoneCode' ? textedInPlace : undefined}
              error={errors[field] ?? null}
            >
              <CodeField
                ref={inputs[field]}
                wrong={errors[field] != null}
                submitting={asking}
                onChangeText={(text) => {
                  typed.current = { ...typed.current, [field]: text };
                  setErrors((now) => ({ ...now, [field]: undefined }));
                }}
                returnKeyType={index === fields.length - 1 ? 'go' : 'next'}
                submitBehavior="submit"
                onSubmitEditing={() =>
                  index === fields.length - 1 ? void submit() : inputs.phoneCode.current?.focus()
                }
                accessibilityLabel={t(recoveryCodeLabel(field, wording.fromWhatsApp))}
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
    borderRadius: tokens.radiusPill,
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
