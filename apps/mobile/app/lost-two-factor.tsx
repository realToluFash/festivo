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
import { Linking, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { heldChallenge } from '../src/challenge.ts';
import { timedOutSignIn } from '../src/kit/signInRules.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { keysStayDown } from '../src/components/Field.tsx';
import { LifecycleSheet } from '../src/components/LifecycleSheet.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { Pending } from '../src/components/Pending.tsx';
import { readOut } from '../src/components/ReadOut.tsx';
import { useFocusOnAnswer } from '../src/components/Screen.tsx';
import { type MarkTone } from '../src/components/StatusMark.tsx';
import { Text, type TextHandle } from '../src/components/Text.tsx';
import { dropRecovery, heldRecovery, holdRecovery } from '../src/heldRecovery.ts';
import { currentLocale } from '../src/i18n/index.ts';
import { retryAfter } from '../src/kit/code.ts';
import {
  type RecoveryField,
  cancelRecovery,
  loadRecovery,
  type RecoveryShown,
  recoveryCodeLabel,
  recoveryCodeProblems,
  replacedElsewhere,
  startRefusal,
  wrongRecoveryCodes,
} from '../src/kit/recovery.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { CodeBoxes, type CodeBoxesHandle, CodeLabel } from '../src/steps/CodeBoxes.tsx';
import { Heading, Plain, Says, Steps } from '../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

type Shown = RecoveryShown;

/** The tap the step showing answers, for its heading to take screen reader focus (sc-11032). */
const Tapped = createContext<object | undefined>(undefined);

/** Lost both the authenticator and the recovery codes (sc-509): three steps, then an ending; nothing here signs anybody in. */
export default function LostTwoFactor() {
  const held = heldChallenge();
  const challenge = held?.challenge ?? null;
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
      setView(startRefusal(refusal) === 'timedOut' ? { kind: 'timedOut' } : { kind: 'failed' });
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
        setView(why === 'timedOut' ? { kind: 'timedOut' } : { kind: 'failed' });
      }
    }
  }

  return <Tapped.Provider value={tapped}>{shown()}</Tapped.Provider>;

  function shown(): ReactNode {
    if (view.kind === 'signIn') return <Redirect href="/sign-in" />;
    if (view.kind === 'timedOut') return <Redirect href={timedOutSignIn(held?.email ?? '')} />;
    if (view.kind === 'loading')
      return (
        <StepScreen nav={<BackToCode />}>
          <Pending />
        </StepScreen>
      );
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

/** Opened from Enter your code, so Back and the system's back return to it as it was left (sc-23279); opened cold, there is nothing to go back to, and Close leaves for sign-in. */
function BackToCode({ step }: { step?: readonly [number, number] }) {
  const canGoBack = router.canGoBack();

  return (
    <NavBar
      left={canGoBack ? 'back' : 'close'}
      onLeft={() => (canGoBack ? router.back() : toSignIn())}
      {...(step != null && { step })}
      testID="lostTwoFactor"
    />
  );
}

function toSignIn(email?: string): void {
  router.replace(email == null ? '/sign-in' : { pathname: '/sign-in', params: { email } });
}

function emailSupport(address: string): void {
  void Linking.openURL(`mailto:${address}`);
}

/** Waiting and every ending: Close leaves for sign-in, the request carrying on without the screen. */
function CloseBar({ step }: { step?: readonly [number, number] }) {
  return (
    <NavBar
      left="close"
      onLeft={() => toSignIn()}
      {...(step != null && { step })}
      testID="lostTwoFactor"
    />
  );
}

/** An ending: the mark, a title, one line and one button. */
function Ending({
  mark,
  title,
  intro,
  note,
  button,
}: {
  mark?: [MarkTone, string];
  title: string;
  intro: string;
  note?: string;
  button: { label: string; onPress: () => void; testID: string };
}) {
  const tapped = useContext(Tapped);

  return (
    <StepScreen nav={<CloseBar />} foot={<PrimaryButton {...button} />}>
      <Heading {...(mark != null && { mark })} title={title} intro={intro} answer={tapped} />
      {note != null && <Plain top={tokens.spaceXl}>{note}</Plain>}
    </StepScreen>
  );
}

/** A newer request was started on another device (pm #1267): its codes went there, so this one starts again. */
function Replaced({ onStartAgain }: { onStartAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <Ending
      mark={['skipped', t('lostTwoFactor.replacedMark')]}
      title={t('lostTwoFactor.replacedTitle')}
      intro={t('lostTwoFactor.replacedIntro')}
      note={t('lostTwoFactor.replacedNote')}
      button={{
        label: t('lostTwoFactor.startAgain'),
        onPress: onStartAgain,
        testID: 'lostTwoFactor.startAgain',
      }}
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
  const tapped = useContext(Tapped);
  const emailOnly = opening.phone == null;
  const steps = [
    opening.phone == null
      ? t('lostTwoFactor.step1EmailOnly', { email: opening.email })
      : t('lostTwoFactor.step1', { email: opening.email, phone: formatPhone(opening.phone) }),
    emailOnly ? t('lostTwoFactor.step2EmailOnly') : t('lostTwoFactor.step2'),
    t('lostTwoFactor.step3', {
      organisations: listed(opening.organisations, 'disjunction'),
    }),
  ];

  return (
    <StepScreen
      nav={<BackToCode step={[1, 3]} />}
      foot={
        <PrimaryButton
          label={
            emailOnly
              ? t(sending ? 'lostTwoFactor.sendingEmailOnly' : 'lostTwoFactor.sendEmailOnly')
              : t(sending ? 'lostTwoFactor.sending' : 'lostTwoFactor.send')
          }
          onPress={onSend}
          busy={sending}
          off={limitedUntil != null}
          testID="lostTwoFactor.send"
        />
      }
    >
      <Heading
        title={t('lostTwoFactor.startTitle')}
        intro={t('lostTwoFactor.startIntro')}
        answer={tapped}
      />
      {limitedUntil != null && (
        <View style={styles.notice}>
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
        </View>
      )}
      <Steps items={steps} />
      <Plain top={tokens.space3xl}>{t('lostTwoFactor.startNote')}</Plain>
    </StepScreen>
  );
}

function Nobody({ supportAddress }: { supportAddress: string }) {
  const { t } = useTranslation();

  return (
    <Ending
      title={t('lostTwoFactor.nobodyTitle')}
      intro={t('lostTwoFactor.nobodyIntro')}
      button={{
        label: t('lostTwoFactor.emailSoirely'),
        onPress: () => emailSupport(supportAddress),
        testID: 'lostTwoFactor.support',
      }}
    />
  );
}

function Failed({ failure, onRetry }: { failure: Shown; onRetry: () => void }) {
  const { t } = useTranslation();
  const tapped = useContext(Tapped);

  return (
    <StepScreen nav={<BackToCode />}>
      <View style={styles.notice}>
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('lostTwoFactor.failedTitle')}
          body={t('lostTwoFactor.failedBody')}
          answer={tapped ?? failure}
          takesFocus={tapped != null}
        />
      </View>
      <View style={styles.ways}>
        <SecondaryButton
          label={t('lostTwoFactor.retry')}
          onPress={onRetry}
          testID="lostTwoFactor.retry"
        />
      </View>
    </StepScreen>
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
  const tapped = useContext(Tapped);
  const waiting = state.status === 'waiting';
  const organisations = listed(state.organisations, 'conjunction');
  const anyOf = listed(state.organisations, 'disjunction');
  const support =
    supportAddress === ''
      ? null
      : {
          label: t('lostTwoFactor.emailSoirely'),
          onPress: () => emailSupport(supportAddress),
          testID: 'lostTwoFactor.support',
        };
  const backToSignIn = {
    label: t('lostTwoFactor.back'),
    onPress: () => toSignIn(),
    testID: 'lostTwoFactor.back',
  };

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
      <StepScreen
        nav={<CloseBar step={[3, 3]} />}
        foot={
          <CancelRequest
            recovery={recovery}
            onTap={onTap}
            onState={onState}
            onReplaced={onReplaced}
          />
        }
      >
        <Heading
          mark={['progress', t('lostTwoFactor.waitingMark')]}
          title={t('lostTwoFactor.waitingFor', { organisations })}
          intro={t(recoveryIntroKey('waiting', state.nobody), { organisations })}
          answer={tapped}
        />
        <Plain top={tokens.spaceXxl} ink>
          {`${t('lostTwoFactor.asked', { when: state.asked })} ${t('lostTwoFactor.endsBy', { when: state.expires })}`}
        </Plain>
        <Plain top={tokens.spaceLg}>{t('lostTwoFactor.stayOut', { email: state.email })}</Plain>
        {state.nobody && support != null && (
          <View style={styles.ways}>
            <SecondaryButton {...support} />
          </View>
        )}
      </StepScreen>
    );
  }

  if (state.status === 'approved') {
    return (
      <Ending
        mark={['done', t('lostTwoFactor.approvedMark')]}
        title={t('lostTwoFactor.approvedTitle')}
        intro={t(recoveryIntroKey('approved', state.nobody), { organisations: anyOf })}
        button={{
          label: t('lostTwoFactor.signIn'),
          // The email comes along, so only the password is typed.
          onPress: () => void dropRecovery().then(() => toSignIn(state.email)),
          testID: 'lostTwoFactor.signIn',
        }}
      />
    );
  }

  if (state.status === 'turned_down') {
    return (
      <Ending
        mark={['broken', t('lostTwoFactor.turnedDownMark')]}
        title={t('lostTwoFactor.turnedDownTitle')}
        intro={t(recoveryIntroKey('turned_down', state.nobody), { organisations: anyOf })}
        button={support ?? backToSignIn}
      />
    );
  }

  if (state.status === 'expired') {
    return (
      <Ending
        mark={['skipped', t('lostTwoFactor.endedMark')]}
        title={t('lostTwoFactor.endedTitle')}
        intro={t(recoveryIntroKey('expired', state.nobody))}
        button={
          state.nobody
            ? (support ?? backToSignIn)
            : {
                label: t('lostTwoFactor.askAgain'),
                onPress: onAskAgain,
                testID: 'lostTwoFactor.askAgain',
              }
        }
      />
    );
  }

  return (
    <Ending
      mark={['skipped', t('lostTwoFactor.cancelledMark')]}
      title={t('lostTwoFactor.cancelledTitle')}
      intro={t('lostTwoFactor.cancelledIntro')}
      button={backToSignIn}
    />
  );
}

/** One quiet button at the foot; an answer arriving while the sheet asks replaces the waiting step, sheet and all (sc-29961). */
function CancelRequest({
  recovery,
  onTap,
  onState,
  onReplaced,
}: {
  recovery: string;
  onTap: () => void;
  onState: (state: RecoveryState) => void;
  onReplaced: () => void;
}) {
  const { t } = useTranslation();
  const phone = useLayout().kind === 'phone';
  const opener = useRef<ViewInstance>(null);
  // New with each opening, so the sheet's title takes screen reader focus as it opens.
  const [asked, setAsked] = useState<object | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notCancelled, setNotCancelled] = useState(false);
  const keep = () => {
    if (cancelling) return;
    setAsked(null);
    setNotCancelled(false);
  };

  const cancel = async (): Promise<void> => {
    setNotCancelled(false);
    setCancelling(true);

    const outcome = await cancelRecovery({
      cancel: () => api.cancelRecovery(recovery),
      state: () => api.recoveryState(recovery),
    });

    if (outcome.kind === 'notCancelled') {
      setCancelling(false);
      setNotCancelled(true);
      return;
    }

    onTap();
    if (outcome.kind === 'replaced') onReplaced();
    else onState(outcome.state);
  };

  return (
    <>
      <View style={styles.foot}>
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {t('lostTwoFactor.notYou')}
        </Text>
        <QuietButton
          ref={opener}
          label={t('lostTwoFactor.cancel')}
          onPress={() => setAsked({})}
          testID="lostTwoFactor.cancel"
        />
      </View>
      <LifecycleSheet
        phone={phone}
        open={asked != null}
        opener={opener}
        testID="lostTwoFactor.cancel"
        title={t('lostTwoFactor.cancelTitle')}
        lines={[t('lostTwoFactor.cancelBody')]}
        confirm={{
          label: t('lostTwoFactor.cancel'),
          keep: t('lostTwoFactor.keepWaiting'),
          pending: cancelling,
          ends: true,
          onGo: () => void cancel(),
        }}
        retold={asked ?? undefined}
        scrimLabel={t('lostTwoFactor.keepWaiting')}
        onClose={keep}
      >
        {notCancelled && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('lostTwoFactor.notCancelled')}
            announce
          />
        )}
      </LifecycleSheet>
    </>
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
  const tapped = useContext(Tapped);
  const codes = state.codes;
  const wording = codeWording(codes?.route ?? null);
  const hasPhone = state.phone != null;
  const number = state.phone == null ? '' : formatPhone(state.phone);
  const fields: RecoveryField[] = hasPhone ? ['emailCode', 'phoneCode'] : ['emailCode'];
  const [typed, setTyped] = useState<Record<RecoveryField, string>>({
    emailCode: '',
    phoneCode: '',
  });
  const boxes = {
    emailCode: useRef<CodeBoxesHandle>(null),
    phoneCode: useRef<CodeBoxesHandle>(null),
  };
  const [errors, setErrors] = useState<Partial<Record<RecoveryField, string>>>({});
  const [asking, setAsking] = useState(false);
  // New with each tap that fails, or that finds the codes spent, so the same words are read out again.
  const [failed, setFailed] = useState<object | null>(null);
  const [foundSpent, setFoundSpent] = useState<object | null>(null);
  const [textingFailed, setTextingFailed] = useState(false);
  const [texted, setTexted] = useState<object | undefined>(undefined);
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

  // Email only, one code goes out, so the resend says one in Verify your email's words (sc-29961).
  const resendWords = hasPhone
    ? {
        resend: t('lostTwoFactor.resend'),
        resendIn: (time: string) => t('lostTwoFactor.resendIn', { time }),
        note: t('lostTwoFactor.resendNote'),
      }
    : {
        resend: t('verifyEmail.resend'),
        resendIn: (time: string) => t('verifyEmail.resendIn', { time }),
        note: t('verifyEmail.resendNote'),
      };

  // The line is help under the boxes, not a live region, so the fallback is read out by hand.
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

    const found = recoveryCodeProblems(fields, typed, wording.fromWhatsApp);
    setErrors(Object.fromEntries(Object.entries(found).map(([field, key]) => [field, t(key)])));
    const first = fields.find((field) => found[field] != null);

    if (first != null) {
      boxes[first].current?.focusChecked();
      return;
    }

    keysStayDown();
    setAsking(true);
    setFailed(null);

    try {
      const proved = await api.proveRecovery(
        recovery,
        cleanCode(typed.emailCode),
        hasPhone ? cleanCode(typed.phoneCode) : null,
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
        for (const field of marked) boxes[field].current?.refuse();
        if (marked[0] != null) boxes[marked[0]].current?.focusRefused();
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
      setTyped({ emailCode: '', phoneCode: '' });
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
      setTexted({});
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
    <StepScreen
      nav={<BackToCode step={[2, 3]} />}
      foot={
        spent ? (
          <PrimaryButton
            label={resendWords.resend}
            onPress={() => void resend()}
            testID="lostTwoFactor.resend"
          />
        ) : (
          <PrimaryButton
            label={asking ? t('lostTwoFactor.asking') : t('lostTwoFactor.ask')}
            onPress={() => void submit()}
            busy={asking}
            testID="lostTwoFactor.ask"
          />
        )
      }
    >
      <Heading
        title={hasPhone ? t('lostTwoFactor.codesTitle') : t('lostTwoFactor.codesTitleEmailOnly')}
        intro={
          hasPhone
            ? t('lostTwoFactor.codesIntro', { email: state.email, phone: number })
            : t('lostTwoFactor.codesIntroEmailOnly', { email: state.email })
        }
        answer={tapped}
      />
      {failed != null && (
        <View style={styles.notice}>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('lostTwoFactor.failedTitle')}
            body={t('lostTwoFactor.failedBody')}
            answer={failed}
          />
        </View>
      )}

      {spent ? (
        <View style={styles.notice}>
          <Notice
            tone="attention"
            mark="!"
            title={
              codes?.state === 'exhausted'
                ? t('lostTwoFactor.exhaustedTitle')
                : hasPhone
                  ? t('lostTwoFactor.expiredTitle')
                  : t('verifyEmail.expiredTitle')
            }
            body={
              codes?.state === 'exhausted'
                ? hasPhone
                  ? t('lostTwoFactor.exhaustedBody')
                  : t('verifyEmail.exhaustedBody')
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
        </View>
      ) : (
        <>
          <View style={styles.codes}>
            {fields.map((field, index) => {
              const label = t(recoveryCodeLabel(field, wording.fromWhatsApp));

              return (
                <View key={field}>
                  {hasPhone && <CodeLabel words={label} />}
                  <CodeBoxes
                    ref={boxes[field]}
                    label={label}
                    value={typed[field]}
                    onChange={(next) => {
                      setTyped((now) => ({ ...now, [field]: next }));
                      if (next !== '') setErrors((now) => ({ ...now, [field]: undefined }));
                    }}
                    onFull={() => {
                      if (field === 'emailCode' && hasPhone)
                        boxes.phoneCode.current?.focusChecked();
                    }}
                    line={errors[field] ?? null}
                    autoFocus={index === 0}
                    testID={`lostTwoFactor.${field}`}
                  />
                  {errors[field] != null && <Says words={errors[field]} />}
                  <SentLine
                    words={
                      field === 'emailCode'
                        ? t('lostTwoFactor.sentTo', { email: state.email })
                        : sent
                    }
                    answer={field === 'phoneCode' ? texted : undefined}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.ways}>
            <QuietButton
              label={
                cooldown > 0 ? resendWords.resendIn(formatCountdown(cooldown)) : resendWords.resend
              }
              onPress={() => void resend()}
              off={cooldown > 0}
              testID="lostTwoFactor.resend"
            />
          </View>
          <Text size={tokens.typeSmall.size} style={styles.small}>
            {resendWords.note}
          </Text>
          {hasPhone && wording.offerText && (
            <View style={styles.ways}>
              <QuietButton
                label={t('lostTwoFactor.textInstead')}
                onPress={() => void textInstead()}
                testID="lostTwoFactor.textInstead"
              />
            </View>
          )}
          {textingFailed && <Says words={t('lostTwoFactor.textInsteadFailed')} />}
        </>
      )}
    </StepScreen>
  );
}

/** Where a code went, under its boxes; with each new `answer`, a screen reader's focus moves onto it. */
function SentLine({ words, answer }: { words: string; answer: unknown }) {
  const { read } = useFocusOnAnswer<TextHandle>(answer);

  return (
    <Text ref={read} size={tokens.typeSmall.size} style={styles.small}>
      {words}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: tokens.spaceXl },
  codes: { marginTop: tokens.spaceXl, gap: tokens.spaceXl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
  small: { marginTop: tokens.spaceSm, color: tokens.colorInkSecondary },
  foot: { alignItems: 'center', gap: tokens.spaceXs },
});

function listed(names: string[], type: 'conjunction' | 'disjunction'): string {
  return new Intl.ListFormat(currentLocale(), { type }).format(names);
}
