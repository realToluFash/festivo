import { ApiError, type TwoFactorEnrolment, type TwoFactorStatus } from '@soirely/api-client';
import { cleanCode, formatTimeOfDay, keyInGroups, lockLiftsAt } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, type TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { typedCodeProblem } from '../kit/twoFactor.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useAboveKeyboard, useScrolledToTop } from './Screen.tsx';
import { Text } from './Text.tsx';

type Stage =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'atRest'; status: TwoFactorStatus }
  | { kind: 'settingUp'; enrolment: TwoFactorEnrolment }
  | { kind: 'savingCodes'; codes: string[] }
  | { kind: 'turningOff' }
  | { kind: 'newCodes' };

const QR_SIZE = 168;

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
  const [refusedBy, setRefusedBy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setStage({ kind: 'atRest', status });
      })
      .catch(() => {
        if (live) setStage({ kind: 'failed' });
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

  function reload(): void {
    setStage({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  async function turnOn(): Promise<void> {
    try {
      setStage({ kind: 'settingUp', enrolment: await api.enrolTwoFactor() });
    } catch {
      setStage({ kind: 'failed' });
    }
  }

  return (
    <View style={cardFrame(kind)}>
      {stage.kind === 'loading' && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('twoFactorCard.title')}
        </Text>
      )}

      {stage.kind === 'failed' && (
        <>
          <Title text={t('twoFactorCard.title')} />
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('twoFactorCard.failedTitle')}
            body={t('twoFactorCard.failedBody')}
          />
          <SecondaryButton label={t('error.retry')} onPress={reload} testID="twoFactor.retry" />
        </>
      )}

      {stage.kind === 'atRest' && (
        <AtRest
          status={stage.status}
          onTurnOn={() => void turnOn()}
          refusedBy={refusedBy}
          onTurnOff={() =>
            keptBy == null ? setStage({ kind: 'turningOff' }) : setRefusedBy(keptBy)
          }
          onNewCodes={() => setStage({ kind: 'newCodes' })}
        />
      )}

      {stage.kind === 'settingUp' && (
        <SettingUp
          enrolment={stage.enrolment}
          phone={phone}
          onActivated={(codes) => {
            setStage({ kind: 'savingCodes', codes });
            onTurnedOn?.();
          }}
          onCancel={reload}
        />
      )}

      {stage.kind === 'savingCodes' && (
        <SavingCodes codes={stage.codes} phone={phone} onFinish={reload} />
      )}

      {stage.kind === 'turningOff' && (
        <TurningOff
          email={email}
          onDone={reload}
          onKept={(organisation) => {
            setRefusedBy(organisation);
            reload();
          }}
        />
      )}

      {stage.kind === 'newCodes' && (
        <NewCodes onMade={(codes) => setStage({ kind: 'savingCodes', codes })} onKeep={reload} />
      )}
    </View>
  );
}

function Title({ text }: { text: string }) {
  return (
    <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
      {text}
    </Text>
  );
}

function AtRest({
  status,
  refusedBy,
  onTurnOn,
  onTurnOff,
  onNewCodes,
}: {
  status: TwoFactorStatus;
  refusedBy: string | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.heading}>
        <View style={styles.grow}>
          <Title text={t('twoFactorCard.title')} />
        </View>
        {/* A mark and the word, never the colour alone. */}
        <View style={styles.state}>
          <View
            style={[styles.mark, status.on ? styles.markOn : styles.markOff]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {status.on && (
              <Text size={tokens.typePill.size} weight="bold" style={styles.markOnInk}>
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
        </View>
      </View>

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
              label={t('twoFactorCard.makeNewCodes')}
              onPress={onNewCodes}
              testID="twoFactor.newCodes"
            />
          </View>
          <SecondaryButton
            label={t('twoFactorCard.turnOff')}
            onPress={onTurnOff}
            testID="twoFactor.turnOff"
          />
          {refusedBy != null && (
            <Notice
              tone="attention"
              mark="!"
              body={t('twoFactorCard.keptByRule', { organisation: refusedBy })}
            />
          )}
        </>
      ) : (
        <>
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('twoFactorCard.offIntro')}
          </Text>
          <PrimaryButton
            label={t('twoFactorCard.turnOn')}
            onPress={onTurnOn}
            testID="twoFactor.turnOn"
          />
        </>
      )}
    </>
  );
}

function SettingUp({
  enrolment,
  phone,
  onActivated,
  onCancel,
}: {
  enrolment: TwoFactorEnrolment;
  phone: boolean;
  onActivated: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const aboveKeyboard = useAboveKeyboard();

  async function submit(): Promise<void> {
    if (checking) return;

    const problem = typedCodeProblem('app', typed.current);
    if (problem != null) {
      setError(t(problem));
      input.current?.focus();
      return;
    }

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
      <Title text={phone ? t('twoFactorCard.phoneSetupTitle') : t('twoFactorCard.setupTitle')} />

      <Text size={tokens.typeBodyPhone.size} weight="semibold">
        {t('twoFactorCard.scan')}
      </Text>
      <View style={styles.qr} accessible accessibilityLabel={t('twoFactorCard.qrAlt')}>
        <SvgXml xml={enrolment.qrSvg} width={QR_SIZE} height={QR_SIZE} />
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {phone ? t('twoFactorCard.phoneCantScan') : t('twoFactorCard.cantScan')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} weight="semibold" selectable style={styles.key}>
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
            editable={!checking}
            onChangeText={(text) => {
              typed.current = text;
              setError(null);
            }}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
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
      <QuietButton label={t('twoFactorCard.cancel')} onPress={onCancel} testID="twoFactor.cancel" />
    </>
  );
}

function SavingCodes({
  codes,
  phone,
  onFinish,
}: {
  codes: string[];
  phone: boolean;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const top = useScrolledToTop();

  useEffect(() => Keyboard.dismiss(), []);

  return (
    <>
      <View ref={top} collapsable={false}>
        <Title text={t('twoFactorCard.saveTitle')} />
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {phone
          ? `${t('twoFactorCard.saveIntro')} ${t('twoFactorCard.phoneKeepElsewhere')}`
          : t('twoFactorCard.saveIntro')}
      </Text>

      <View style={styles.codes} accessibilityLabel={t('twoFactorCard.recoveryCodes')}>
        {codes.map((code) => (
          <Text key={code} size={tokens.typeBodyPhone.size} selectable style={styles.code}>
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
        <Text
          size={tokens.typeSmall.size}
          weight="semibold"
          style={styles.on}
          accessibilityLiveRegion="polite"
        >
          {t('twoFactorCard.copiedAll', { count: codes.length })}
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
          style={[styles.box, saved && styles.boxOn]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {saved && (
            <Text size={tokens.typePill.size} weight="bold" style={styles.markOnInk}>
              ✓
            </Text>
          )}
        </View>
        <Text size={tokens.typeBodyPhone.size}>{t('twoFactorCard.savedThem')}</Text>
      </Pressable>

      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {saved ? t('twoFactorCard.finishReady') : t('twoFactorCard.finishLocked')}
      </Text>
      <PrimaryButton
        label={t('twoFactorCard.finish')}
        onPress={onFinish}
        off={!saved}
        testID="twoFactor.finish"
      />
    </>
  );
}

function TurningOff({
  email,
  onDone,
  onKept,
}: {
  email: string;
  onDone: () => void;
  onKept: (organisation: string) => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(): Promise<void> {
    if (checking) return;

    if (typed.current.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      input.current?.focus();
      return;
    }

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
      <Title text={t('twoFactorCard.offTitle')} />
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
          editable={!checking}
          autoCapitalize="none"
          autoComplete="one-time-code"
          onChangeText={(text) => {
            typed.current = text;
            setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          accessibilityLabel={t('twoFactor.code')}
          testID="twoFactor.offCode"
        />
      </Field>

      <PrimaryButton
        label={t('twoFactorCard.turnItOff')}
        onPress={() => void submit()}
        busy={checking}
        testID="twoFactor.turnItOff"
      />
      <QuietButton
        label={t('twoFactorCard.keepItOn')}
        onPress={onDone}
        testID="twoFactor.keepItOn"
      />
    </>
  );
}

/** Changing a factor takes the current one, or a stolen session could mint codes past it. */
function NewCodes({ onMade, onKeep }: { onMade: (codes: string[]) => void; onKeep: () => void }) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(): Promise<void> {
    if (checking) return;

    if (typed.current.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      input.current?.focus();
      return;
    }

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
      <Title text={t('twoFactorCard.newTitle')} />
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
          editable={!checking}
          autoCapitalize="none"
          autoComplete="one-time-code"
          onChangeText={(text) => {
            typed.current = text;
            setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
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
  codeAndCheck: { gap: tokens.spaceLg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  grow: { flex: 1 },
  state: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  mark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
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
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusField,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
});
