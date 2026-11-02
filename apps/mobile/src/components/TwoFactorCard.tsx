import { ApiError, type TwoFactorEnrolment, type TwoFactorStatus } from '@soirely/api-client';
import { cleanCode, formatTimeOfDay, keyInGroups, lockLiftsAt } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type TFunction } from 'i18next';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { typedCodeProblem } from '../kit/twoFactor.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field, focusChecked, keysStayDown, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { type StepClosed, stepClosed, useAboveKeyboard, useFocusBackToOpener } from './Screen.tsx';
import { Sheet, SheetActions } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { useMarkSide } from './markSide.ts';
import { Arrived, Skeleton } from './Skeleton.tsx';

/** Said once, as the tap it answers lands; `AtRest` mounts again after every reload. */
interface Refusal {
  organisation: string;
  said: boolean;
  /** It answers Turn it off, whose step has closed, so it takes focus in place of being read out (sc-11173). */
  takesFocus: boolean;
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'failed'; tapped: boolean }
  | { kind: 'atRest'; status: TwoFactorStatus }
  | { kind: 'settingUp'; enrolment: TwoFactorEnrolment }
  | { kind: 'savingCodes'; codes: string[]; renewed: boolean }
  | { kind: 'turningOff' }
  | { kind: 'newCodes' };

const QR_SIZE = 168;

/** `reload` moves focus once the card is back, so the codes sheet hands none back itself. */
const noOpener: RefObject<null> = { current: null };

/** Settings > Security, the two-factor card, in the app. */
export function TwoFactorCard({
  email,
  kind,
  recount,
  keptBy = null,
  onTurnedOn,
}: {
  email: string;
  kind: LayoutKind;
  /** Changes when another card spent a code, so the unused count is asked for again. */
  recount: number;
  /** An organisation that requires two-factor of everyone, so it stays on (sc-609). */
  keptBy?: string | null;
  onTurnedOn?: () => void;
}) {
  const phone = kind === 'phone';
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refusedBy, setRefusedBy] = useState<Refusal | null>(null);
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const title = useRef<TextHandle>(null);
  const opener = useFocusBackToOpener(stage.kind === 'atRest' ? closed : undefined, title);

  useEffect(() => {
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setStage({ kind: 'atRest', status });
      })
      .catch(() => {
        // Each load after the first follows a tap: a step closing, or Try again.
        if (live) setStage({ kind: 'failed', tapped: attempt > 0 });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (recount === 0) return;
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setStage((now) => (now.kind === 'atRest' ? { kind: 'atRest', status } : now));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [recount]);

  function leaveAtRest(next?: Stage): void {
    setRefusedBy((now) => now && { ...now, said: true });
    setClosed(undefined);
    if (next != null) setStage(next);
  }

  /** Loads the card again, then focus goes to `to`: an opener, or the title. */
  function reload(to?: string): void {
    setClosed(to == null ? undefined : stepClosed(to));
    setStage({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  function finishCodes(): void {
    reload(stage.kind === 'savingCodes' && stage.renewed ? 'newCodes' : 'title');
  }

  async function turnOn(): Promise<void> {
    try {
      setStage({ kind: 'settingUp', enrolment: await api.enrolTwoFactor() });
    } catch {
      setStage({ kind: 'failed', tapped: true });
    }
  }

  return (
    <View style={cardFrame(kind)}>
      {stage.kind === 'loading' && (
        <>
          <Title text={t('twoFactorCard.title')} />
          <Skeleton
            words={t('pending.loading')}
            shape="cards"
            cards={[{ lines: 2, options: 1 }]}
            inCard
          />
        </>
      )}

      {stage.kind === 'failed' && (
        <>
          <Title text={t('twoFactorCard.title')} />
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('twoFactorCard.failedTitle')}
            body={t('twoFactorCard.failedBody')}
            answer={stage}
            takesFocus={stage.tapped}
          />
          <SecondaryButton
            label={t('twoFactorCard.retry')}
            onPress={() => reload('title')}
            testID="twoFactor.retry"
          />
        </>
      )}

      {stage.kind === 'atRest' && (
        <AtRest
          status={stage.status}
          title={title}
          opener={opener}
          asksFirst={keptBy == null}
          onTurnOn={() => {
            leaveAtRest();
            void turnOn();
          }}
          refusedBy={refusedBy}
          onTurnOff={() =>
            keptBy == null
              ? leaveAtRest({ kind: 'turningOff' })
              : setRefusedBy({ organisation: keptBy, said: false, takesFocus: false })
          }
          onNewCodes={() => leaveAtRest({ kind: 'newCodes' })}
        />
      )}

      {stage.kind === 'settingUp' && (
        <SettingUp
          enrolment={stage.enrolment}
          phone={phone}
          answer={stage}
          onActivated={(codes) => {
            setStage({ kind: 'savingCodes', codes, renewed: false });
            onTurnedOn?.();
          }}
          onCancel={() => reload('turnOn')}
        />
      )}

      {stage.kind === 'savingCodes' && <Title text={t('twoFactorCard.title')} />}
      <Sheet
        open={stage.kind === 'savingCodes'}
        onClose={finishCodes}
        opener={noOpener}
        testID="twoFactor.codesSheet"
      >
        {stage.kind === 'savingCodes' && (
          <SavingCodes codes={stage.codes} phone={phone} answer={stage} onFinish={finishCodes} />
        )}
      </Sheet>

      {stage.kind === 'turningOff' && (
        <TurningOff
          email={email}
          answer={stage}
          onDone={() => reload('title')}
          onKeep={() => reload('turnOff')}
          onKept={(organisation) => {
            setRefusedBy({ organisation, said: false, takesFocus: true });
            reload();
          }}
        />
      )}

      {stage.kind === 'newCodes' && (
        <NewCodes
          answer={stage}
          onMade={(codes) => setStage({ kind: 'savingCodes', codes, renewed: true })}
          onKeep={() => reload('newCodes')}
        />
      )}
    </View>
  );
}

function Title({
  text,
  answer,
  ref,
}: {
  text: string;
  answer?: unknown;
  ref?: RefObject<TextHandle | null>;
}) {
  return (
    <AnswerHeading size={tokens.typeTitleSection.size} weight="bold" answer={answer} ref={ref}>
      {text}
    </AnswerHeading>
  );
}

function AtRest({
  status,
  title,
  opener,
  asksFirst,
  refusedBy,
  onTurnOn,
  onTurnOff,
  onNewCodes,
}: {
  status: TwoFactorStatus;
  title: RefObject<TextHandle | null>;
  opener: (key: string) => Ref<ViewInstance>;
  asksFirst: boolean;
  refusedBy: Refusal | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
}) {
  const markSide = useMarkSide(tokens.sizeMark);
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.heading}>
        <View style={styles.grow}>
          <Title text={t('twoFactorCard.title')} ref={title} />
        </View>
        {/* A mark and the word, never the colour alone. */}
        <Arrived style={styles.state}>
          <View
            style={[styles.mark, markSide, status.on ? styles.markOn : styles.markOff]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {status.on && (
              <Text
                size={tokens.typePill.size}
                weight="bold"
                style={styles.markOnInk}
                accessible={false}
              >
                ✓
              </Text>
            )}
          </View>
          <Text
            size={tokens.typeSmall.size}
            weight="semibold"
            style={status.on ? styles.on : styles.secondary}
          >
            {status.on ? t('twoFactorCard.on') : t('twoFactorCard.off')}
          </Text>
        </Arrived>
      </View>

      <Arrived style={styles.arrived}>
        {status.on ? (
          <>
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {t('twoFactorCard.onIntro')}
            </Text>
            <View style={styles.inset}>
              <Text size={tokens.typeBodyPhone.size} weight="semibold">
                {t('twoFactorCard.recoveryCodes')}
              </Text>
              <Text size={tokens.typeSmall.size} style={styles.secondary}>
                {t('twoFactorCard.unused', { left: status.recoveryCodesLeft, total: 10 })}
              </Text>
              <SecondaryButton
                ref={opener('newCodes')}
                label={t('twoFactorCard.makeNewCodes')}
                onPress={onNewCodes}
                testID="twoFactor.newCodes"
              />
            </View>
            <DestructiveButton
              ref={opener('turnOff')}
              stacked={false}
              label={asksFirst ? t('twoFactorCard.turnOffAsks') : t('twoFactorCard.turnOff')}
              onPress={onTurnOff}
              testID="twoFactor.turnOff"
            />
            {refusedBy != null && (
              <Notice
                tone="attention"
                mark="!"
                body={t('twoFactorCard.keptByRule', { organisation: refusedBy.organisation })}
                answer={refusedBy.said ? undefined : refusedBy}
                takesFocus={refusedBy.takesFocus}
              />
            )}
          </>
        ) : (
          <>
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {t('twoFactorCard.offIntro')}
            </Text>
            <PrimaryButton
              ref={opener('turnOn')}
              label={t('twoFactorCard.turnOn')}
              onPress={onTurnOn}
              testID="twoFactor.turnOn"
            />
          </>
        )}
      </Arrived>
    </>
  );
}

function SettingUp({
  enrolment,
  phone,
  answer,
  onActivated,
  onCancel,
}: {
  enrolment: TwoFactorEnrolment;
  phone: boolean;
  answer: unknown;
  onActivated: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const aboveKeyboard = useAboveKeyboard();

  async function submit(): Promise<void> {
    if (checking) return;

    const problem = typedCodeProblem('app', typed.current);
    if (problem != null) {
      setError(t(problem));
      focusChecked(input);
      return;
    }

    keysStayDown();
    setChecking(true);

    try {
      onActivated(await api.activateTwoFactor(cleanCode(typed.current)));
    } catch (refusal) {
      setChecking(false);
      setError(refusalMessage(refusal, 'twoFactorCard.setupWrong', t));
    }
  }

  return (
    <>
      <Title
        text={phone ? t('twoFactorCard.phoneSetupTitle') : t('twoFactorCard.setupTitle')}
        answer={answer}
      />

      <Text size={tokens.typeBodyPhone.size} weight="semibold">
        {t('twoFactorCard.scan')}
      </Text>
      <View style={styles.qr} accessible accessibilityLabel={t('twoFactorCard.qrAlt')}>
        <SvgXml xml={enrolment.qrSvg} width={QR_SIZE} height={QR_SIZE} />
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {phone ? t('twoFactorCard.phoneCantScan') : t('twoFactorCard.cantScan')}
      </Text>
      <Text
        size={tokens.typeBodyPhone.size}
        weight="semibold"
        family="mono"
        selectable
        style={styles.key}
      >
        {keyInGroups(enrolment.secret)}
      </Text>

      <View {...aboveKeyboard} style={styles.codeAndCheck}>
        <Field
          label={t('twoFactorCard.enterCode')}
          error={error}
          help={t('twoFactorCard.staysOff')}
        >
          <CodeField
            ref={input}
            wrong={error != null}
            submitting={checking}
            onChangeText={(text) => {
              typed.current = text;
              setError(null);
            }}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            submitBehavior="submit"
            accessibilityLabel={t('twoFactorCard.enterCode')}
            testID="twoFactor.setupCode"
          />
        </Field>

        <PrimaryButton
          label={t('twoFactorCard.checkCode')}
          onPress={() => void submit()}
          busy={checking}
          testID="twoFactor.checkCode"
        />
      </View>
      <QuietButton
        label={t('twoFactorCard.cancel')}
        onPress={onCancel}
        off={checking}
        testID="twoFactor.cancel"
      />
    </>
  );
}

function SavingCodes({
  codes,
  phone,
  answer,
  onFinish,
}: {
  codes: string[];
  phone: boolean;
  answer: unknown;
  onFinish: () => void;
}) {
  const markSide = useMarkSide(tokens.sizeMark);
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedAll = t('twoFactorCard.copiedAll', { count: codes.length });
  useReadOut(copied ? copiedAll : null);

  useEffect(() => Keyboard.dismiss(), []);

  return (
    <>
      <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
        <Title text={t('twoFactorCard.saveTitle')} answer={answer} />
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {phone
            ? `${t('twoFactorCard.saveIntro')} ${t('twoFactorCard.phoneKeepElsewhere')}`
            : t('twoFactorCard.saveIntro')}
        </Text>

        <View style={styles.codes}>
          {codes.map((code) => (
            <Text
              key={code}
              size={tokens.typeBodyPhone.size}
              family="mono"
              selectable
              style={styles.code}
            >
              {code}
            </Text>
          ))}
        </View>

        <SecondaryButton
          label={copied ? `✓ ${t('twoFactorCard.copied')}` : t('twoFactorCard.copyAll')}
          onPress={() => {
            void setStringAsync(codes.join('\n')).then(() => setCopied(true));
          }}
          testID="twoFactor.copyAll"
        />
        {copied && (
          <Text size={tokens.typeSmall.size} weight="semibold" style={styles.on}>
            {copiedAll}
          </Text>
        )}

        <Pressable
          style={styles.checkbox}
          onPress={() => setSaved((now) => !now)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved }}
          testID="twoFactor.saved"
        >
          <View
            style={[styles.box, markSide, saved && styles.boxOn]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {saved && (
              <Text
                size={tokens.typePill.size}
                weight="bold"
                style={styles.markOnInk}
                accessible={false}
              >
                ✓
              </Text>
            )}
          </View>
          <Text size={tokens.typeBodyPhone.size}>{t('twoFactorCard.savedThem')}</Text>
        </Pressable>

        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {saved ? t('twoFactorCard.finishReady') : t('twoFactorCard.finishLocked')}
        </Text>
      </ScrollView>
      <View style={styles.sheetFooter}>
        <SheetActions>
          <PrimaryButton
            label={t('twoFactorCard.finish')}
            onPress={onFinish}
            off={!saved}
            testID="twoFactor.finish"
          />
        </SheetActions>
      </View>
    </>
  );
}

function TurningOff({
  email,
  answer,
  onDone,
  onKeep,
  onKept,
}: {
  email: string;
  answer: unknown;
  onDone: () => void;
  onKeep: () => void;
  onKept: (organisation: string) => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(): Promise<void> {
    if (checking) return;

    if (typed.current.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      focusChecked(input);
      return;
    }

    keysStayDown();
    setChecking(true);

    try {
      await api.disableTwoFactor(typed.current.trim());
      onDone();
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('two_factor_kept_by_rule')) {
        onKept(refusal.problem.organisation ?? '');
        return;
      }

      setChecking(false);
      setError(refusalMessage(refusal, 'twoFactorCard.offWrong', t));
    }
  }

  return (
    <>
      <Title text={t('twoFactorCard.offTitle')} answer={answer} />
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('twoFactorCard.offBody')}
      </Text>

      <Field
        label={t('twoFactor.code')}
        error={error}
        help={t('twoFactorCard.offEmail', { email })}
      >
        <TextField
          ref={input}
          wrong={error != null}
          submitting={checking}
          autoCapitalize="none"
          autoComplete="one-time-code"
          onChangeText={(text) => {
            typed.current = text;
            setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          submitBehavior="submit"
          accessibilityLabel={t('twoFactor.code')}
          testID="twoFactor.offCode"
        />
      </Field>

      <DestructiveButton
        label={t('twoFactorCard.turnItOff')}
        onPress={() => void submit()}
        busy={checking}
        testID="twoFactor.turnItOff"
      />
      <QuietButton
        label={t('twoFactorCard.keepItOn')}
        onPress={onKeep}
        off={checking}
        testID="twoFactor.keepItOn"
      />
    </>
  );
}

/** Changing a factor takes the current one, or a stolen session could mint codes past it. */
function NewCodes({
  answer,
  onMade,
  onKeep,
}: {
  answer: unknown;
  onMade: (codes: string[]) => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(): Promise<void> {
    if (checking) return;

    if (typed.current.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      focusChecked(input);
      return;
    }

    keysStayDown();
    setChecking(true);

    try {
      onMade(await api.newRecoveryCodes(typed.current.trim()));
    } catch (refusal) {
      setChecking(false);
      setError(refusalMessage(refusal, 'twoFactorCard.offWrong', t));
    }
  }

  return (
    <>
      <Title text={t('twoFactorCard.newTitle')} answer={answer} />
      <Notice
        tone="attention"
        mark="!"
        title={t('twoFactorCard.newWarningTitle')}
        body={t('twoFactorCard.newWarningBody')}
      />
      <Field label={t('twoFactor.code')} error={error} help={t('twoFactorCard.offBody')}>
        <TextField
          ref={input}
          wrong={error != null}
          submitting={checking}
          autoCapitalize="none"
          autoComplete="one-time-code"
          onChangeText={(text) => {
            typed.current = text;
            setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          submitBehavior="submit"
          accessibilityLabel={t('twoFactor.code')}
          testID="twoFactor.newCodesCode"
        />
      </Field>
      <PrimaryButton
        label={t('twoFactorCard.makeNewCodes')}
        onPress={() => void submit()}
        busy={checking}
        testID="twoFactor.confirmNewCodes"
      />
      <QuietButton
        label={t('twoFactorCard.keepCodes')}
        onPress={onKeep}
        off={checking}
        testID="twoFactor.keepCodes"
      />
    </>
  );
}

/** A refused code in the reader's words; a lockout gives the time it lifts from Retry-After. */
function refusalMessage(refusal: unknown, wrong: string, t: TFunction): string {
  if (!(refusal instanceof ApiError)) return t('twoFactorCard.failedBody');

  if (refusal.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    return liftsAt == null
      ? t('twoFactorCard.failedBody')
      : t('twoFactor.pausedBody', { time: formatTimeOfDay(liftsAt, dateLocale()) });
  }

  if (refusal.is('recovery_code_used')) return t('twoFactor.recoveryUsed');

  return refusal.is('two_factor_code_invalid') ? t(wrong) : t('twoFactorCard.failedBody');
}

const styles = StyleSheet.create({
  arrived: { gap: tokens.spaceLg },
  codeAndCheck: { gap: tokens.spaceLg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  grow: { flex: 1 },
  state: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  markOff: { borderWidth: 1.5, borderColor: tokens.colorInkSecondary },
  markOn: { backgroundColor: tokens.marks.done.fill },
  markOnInk: { color: tokens.marks.done.ink },
  on: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  inset: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  qr: {
    alignSelf: 'flex-start',
    padding: tokens.spaceSm,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  key: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  codes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  code: { width: '50%', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
  },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusField,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  sheetBody: { flexShrink: 1 },
  sheetContent: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  sheetFooter: {
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceSm,
    paddingBottom: tokens.space3xl,
  },
});
