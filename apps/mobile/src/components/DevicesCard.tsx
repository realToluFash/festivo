import {
  ApiError,
  type DeviceSession,
  type LinkedProvider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { formatDay, formatTimeOfDay, othersOf, thisDeviceFirst } from '@soirely/domain';
import { type Ref, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type EverywhereRefusal,
  deviceMoment,
  deviceName,
  everywhereButton,
  everywhereRefusal,
  liftsIn,
} from '../kit/devices.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { currentSessionId } from '../tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field, focusChecked, keysStayDown } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { PasswordField } from './PasswordField.tsx';
import { ProviderButton } from './ProviderSignIn.tsx';
import { type StepClosed, stepClosed, useAboveKeyboard, useFocusBackToOpener } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';

type Devices =
  | { kind: 'loading' }
  | { kind: 'failed'; tapped: boolean }
  | { kind: 'ready'; sessions: DeviceSession[] };

type Said =
  | { kind: 'ended'; name: string }
  | { kind: 'endFailed' }
  | { kind: 'everywhere'; signedOut: number };

type Stage =
  | { kind: 'list'; said: Said | null; closed?: StepClosed }
  | { kind: 'checking'; device: DeviceSession }
  | { kind: 'everywhere' };

/** Settings > Security, the "Signed in on" card in the app (sc-55, sc-115): this device is the session the keystore holds. */
export function DevicesCard({
  hasPassword,
  providers,
  kind,
  reload,
  onSignOutHere,
  onEndedHere,
  onCodeSpent,
}: {
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  kind: LayoutKind;
  /** Changes when something else on the screen ended sessions, so the list is asked for again. */
  reload: number;
  onSignOutHere: () => void;
  /** This device's session has already ended on the server, so only the tokens are left to clear. */
  onEndedHere: () => void;
  /** A two-factor or recovery code was accepted, so the two-factor card's count may be stale. */
  onCodeSpent: () => void;
}) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Devices>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>({ kind: 'list', said: null });
  const [listedFor, setListedFor] = useState(reload);
  const [retried, setRetried] = useState<object | null>(null);
  const tappedRetry = useRef(false);
  const title = useRef<TextHandle>(null);
  const opener = useFocusBackToOpener(stage.kind === 'list' ? stage.closed : undefined, title);
  const frame = cardFrame(kind);
  const here = currentSessionId();

  if (listedFor !== reload) {
    setListedFor(reload);
    setDevices({ kind: 'loading' });
    setStage({ kind: 'list', said: null });
    setRetried(null);
  }

  useEffect(() => {
    tappedRetry.current = false;
  }, [reload]);

  useEffect(() => {
    let live = true;

    api
      .sessions()
      .then((sessions) => {
        if (live) setDevices({ kind: 'ready', sessions });
      })
      .catch(() => {
        if (live) setDevices({ kind: 'failed', tapped: tappedRetry.current });
      });

    return () => {
      live = false;
    };
  }, [attempt, reload]);

  function retry(): void {
    tappedRetry.current = true;
    setRetried({});
    setDevices({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  function show(next: Stage): void {
    tappedRetry.current = false;
    setRetried(null);
    setStage(next);
  }

  async function end(device: DeviceSession): Promise<void> {
    try {
      await api.endSession(device.id);
    } catch {
      show({ kind: 'list', said: { kind: 'endFailed' } });

      return;
    }

    show({ kind: 'list', said: { kind: 'ended', name: deviceName(device, t) } });
    setDevices((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', sessions: current.sessions.filter((s) => s.id !== device.id) }
        : current,
    );
  }

  function endedElsewhere(result: { signedOut: number; thisDevice: boolean }): void {
    if (result.thisDevice) {
      onEndedHere();

      return;
    }

    show({ kind: 'list', said: { kind: 'everywhere', signedOut: result.signedOut } });
    setDevices((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', sessions: current.sessions.filter((s) => s.id === currentSessionId()) }
        : current,
    );
  }

  if (stage.kind === 'checking') {
    return (
      <View style={frame}>
        <Check
          device={stage.device}
          onEnd={() => void end(stage.device)}
          onKeep={() =>
            show({ kind: 'list', said: null, closed: stepClosed(`signOut.${stage.device.id}`) })
          }
        />
      </View>
    );
  }

  if (stage.kind === 'everywhere' && devices.kind === 'ready') {
    return (
      <View style={frame}>
        <EverywhereElse
          {...othersOf(devices.sessions, here)}
          hasPassword={hasPassword}
          providers={providers}
          onDone={endedElsewhere}
          onKeep={() => show({ kind: 'list', said: null, closed: stepClosed('everywhere') })}
          onCodeSpent={onCodeSpent}
        />
      </View>
    );
  }

  const said = stage.kind === 'list' ? stage.said : null;

  return (
    <View style={frame}>
      <View style={styles.heading}>
        <AnswerHeading
          ref={title}
          size={tokens.typeTitleSection.size}
          weight="bold"
          answer={devices.kind === 'ready' ? (retried ?? undefined) : undefined}
        >
          {t('devices.title')}
        </AnswerHeading>
        {devices.kind === 'ready' && (
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {t('devices.count', { count: devices.sessions.length })}
          </Text>
        )}
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('devices.intro')}
      </Text>

      {said?.kind === 'ended' && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={t('devices.ended', { name: said.name })}
          answer={said}
          takesFocus
        />
      )}
      {said?.kind === 'everywhere' && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={
            said.signedOut === 0
              ? t('devices.everywhereNone')
              : t('devices.everywhereDone', { count: said.signedOut })
          }
          answer={said}
          takesFocus
        />
      )}
      {said?.kind === 'endFailed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('devices.endFailedTitle')}
          body={t('devices.endFailedBody')}
          answer={said}
          takesFocus
        />
      )}

      {devices.kind === 'loading' && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('devices.loading')}
        </Text>
      )}

      {devices.kind === 'failed' && (
        <>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('devices.failedTitle')}
            body={t('devices.failedBody')}
            answer={devices}
            takesFocus={devices.tapped}
          />
          <SecondaryButton label={t('devices.retry')} onPress={retry} testID="devices.retry" />
        </>
      )}

      {devices.kind === 'ready' && (
        <View>
          {thisDeviceFirst(devices.sessions, here).map((device) => (
            <Row
              key={device.id}
              device={device}
              here={device.id === here}
              onEndHere={() => onSignOutHere()}
              opener={opener(`signOut.${device.id}`)}
              onCheck={() => show({ kind: 'checking', device })}
            />
          ))}
        </View>
      )}

      {devices.kind === 'ready' && othersOf(devices.sessions, here).count > 0 && (
        <View style={styles.footer}>
          <SecondaryButton
            label={t('devices.everywhere')}
            ref={opener('everywhere')}
            onPress={() => show({ kind: 'everywhere' })}
            testID="devices.everywhere"
          />
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {t('devices.everywhereHint')}
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({
  device,
  here,
  opener,
  onCheck,
  onEndHere,
}: {
  device: DeviceSession;
  here: boolean;
  opener: Ref<ViewInstance>;
  onCheck: () => void;
  onEndHere: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <View style={styles.row} testID={here ? 'devices.here' : `devices.row.${device.id}`}>
      <View style={styles.detail}>
        <View style={styles.name}>
          <Text size={tokens.typeRowTitle.size} weight="semibold">
            {deviceName(device, t)}
          </Text>
          {/* A dot and the words, never the dot alone. */}
          {here && (
            <View style={styles.pill}>
              <View style={styles.dot} />
              <Text size={tokens.typePill.size} weight="semibold" style={styles.accent}>
                {t('devices.here')}
              </Text>
            </View>
          )}
        </View>
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('devices.signedInFrom', {
            started: deviceMoment(device.startedAt, locale, t),
            ip: device.ipAddress ?? t('devices.unknownAddress'),
          })}
        </Text>
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('devices.expiry', {
            usage: here
              ? t('devices.inUseNow')
              : t('devices.lastUsed', { used: deviceMoment(device.renewedAt, locale, t) }),
            expires: formatDay(device.expiresAt, locale),
          })}
        </Text>
      </View>

      {/* Your own signs out at once; another device opens a check first, since it may be mid-event. */}
      <SecondaryButton
        ref={here ? undefined : opener}
        label={t('devices.signOut')}
        onPress={here ? onEndHere : onCheck}
        testID={here ? 'devices.here.signOut' : `devices.row.${device.id}.signOut`}
      />
    </View>
  );
}

function Check({
  device,
  onEnd,
  onKeep,
}: {
  device: DeviceSession;
  onEnd: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const name = deviceName(device, t);

  return (
    <>
      <AnswerHeading size={tokens.typeTitleSection.size} weight="bold" answer={device}>
        {t('devices.checkTitle', { name })}
      </AnswerHeading>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('devices.checkBody', {
          started: deviceMoment(device.startedAt, locale, t),
          ip: device.ipAddress ?? t('devices.unknownAddress'),
          used: deviceMoment(device.renewedAt, locale, t),
        })}
      </Text>
      <Notice
        tone="attention"
        mark="!"
        title={t('devices.checkWarning')}
        body={`${t('devices.signInAgain')} ${t('devices.passwordAdvice')}`}
      />
      <PrimaryButton label={t('devices.end')} onPress={onEnd} testID="devices.end" />
      <SecondaryButton label={t('devices.keep')} onPress={onKeep} testID="devices.keep" />
    </>
  );
}

/** Prove it is you, then every other session ends; with Google or Apple, the code is asked when it returns. */
function EverywhereElse({
  count,
  sessionId,
  hasPassword,
  providers,
  onDone,
  onKeep,
  onCodeSpent,
}: {
  count: number;
  sessionId: string | null;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  onDone: (result: { signedOut: number; thisDevice: boolean }) => void;
  onKeep: () => void;
  onCodeSpent: () => void;
}) {
  const { t } = useTranslation();
  const provider = hasPassword ? null : (providers[0]?.provider ?? null);
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const returned = useRef<ProviderSignInAttempt | null>(null);
  const [codeAsked, setCodeAsked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<EverywhereRefusal | null>(null);
  const aboveKeyboard = useAboveKeyboard();
  const keepsThisDevice = sessionId != null;
  const checks = useFormChecks(
    (provider == null ? ['password', 'code'] : ['code']) as readonly ('password' | 'code')[],
    (field, value) =>
      field === 'password'
        ? value === ''
          ? t('devices.everywherePasswordBlank')
          : null
        : codeAsked && value.trim() === ''
          ? t('devices.everywhereCodeBlank')
          : null,
    (field) => focusChecked(field === 'password' ? passwordInput : codeInput),
  );

  useEffect(() => {
    let live = true;

    // Beside a password the code is asked at once; with a provider, only when it returns.
    if (provider == null)
      void api
        .twoFactorStatus()
        .then((status) => {
          if (live) setCodeAsked(status.on);
        })
        .catch(() => {});

    return () => {
      live = false;
    };
  }, [provider]);

  useEffect(() => {
    const delay = liftsIn(refusal, Date.now());
    if (delay == null) return;

    const lift = setTimeout(() => setRefusal(null), delay);

    return () => clearTimeout(lift);
  }, [refusal]);

  async function submit(): Promise<void> {
    if (working || refusal?.kind === 'limited') return;
    if (!checks.passes({ password: password.current, code: code.current })) return;

    keysStayDown();
    setWorking(true);
    setRefusal(null);

    if (provider != null && returned.current == null) {
      try {
        returned.current = await confirmWithProvider(provider, true);
        setConfirmed(true);
      } catch (error) {
        setWorking(false);
        if (!(error instanceof ProviderCancelled))
          setRefusal({
            kind: 'failed',
            message: t('devices.everywhereProviderFailed', { provider: PROVIDER_NAMES[provider] }),
          });

        return;
      }
    }

    try {
      const first =
        provider == null || returned.current == null
          ? { password: password.current }
          : { provider, signIn: returned.current };
      const { proof } = await api.prove(first, codeAsked ? code.current.trim() : undefined);
      if (codeAsked) onCodeSpent();
      onDone(await api.signOutEverywhereElse(proof, sessionId));
    } catch (error) {
      setWorking(false);

      if (error instanceof ApiError && error.is('two_factor_required')) {
        setCodeAsked(true);

        return;
      }

      const refused = everywhereRefusal(error, provider != null, t);

      // A refused trip, or one limited before the code step, is made again; after a wrong code the kept sign-in is sent again.
      if (
        provider != null &&
        ((error instanceof ApiError && error.is('invalid_credentials')) ||
          (refused.kind === 'limited' && !codeAsked))
      ) {
        returned.current = null;
        setConfirmed(false);
      }
      setRefusal(refused);
    }
  }

  const until =
    refusal?.kind === 'limited' && refusal.until != null
      ? formatTimeOfDay(refusal.until, dateLocale())
      : null;
  const passwordError =
    checks.errors.password ??
    (refusal?.kind === 'field' && refusal.field === 'password' ? refusal.message : null);
  const codeError =
    checks.errors.code ??
    (refusal?.kind === 'field' && refusal.field === 'code' ? refusal.message : null);
  const viaName = provider != null && !confirmed ? PROVIDER_NAMES[provider] : null;
  const confirmedLine =
    provider != null && confirmed && codeAsked
      ? t('devices.everywhereProviderConfirmed', { provider: PROVIDER_NAMES[provider] })
      : null;
  useReadOut(confirmedLine);
  const button = everywhereButton(
    {
      providerName: provider == null ? null : PROVIDER_NAMES[provider],
      confirmed,
      codeAsked,
      working,
      refusal,
      until,
      keepsThisDevice,
      count,
    },
    t,
  );

  return (
    <>
      <AnswerHeading size={tokens.typeTitleSection.size} weight="bold" answer="everywhere">
        {t('devices.everywhereTitle')}
      </AnswerHeading>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {keepsThisDevice
          ? t('devices.everywhereBody', { count })
          : t('devices.everywhereSelf', { count })}
      </Text>

      {refusal?.kind === 'limited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('devices.everywhereLimitedTitle')}
          body={
            until == null
              ? t('devices.everywhereLimitedSoon')
              : t('devices.everywhereLimitedBody', { time: until })
          }
          answer={refusal}
        />
      )}
      {refusal?.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('devices.everywhereFailedTitle')}
          body={refusal.message}
          answer={refusal}
        />
      )}

      {confirmedLine != null && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {confirmedLine}
        </Text>
      )}

      {provider == null && (
        <Field
          label={t('devices.everywherePassword')}
          error={passwordError}
          help={t('devices.everywhereWhy')}
        >
          <PasswordField
            ref={passwordInput}
            wrong={passwordError != null}
            submitting={working}
            autoComplete="current-password"
            textContentType="password"
            onChangeText={(text) => {
              password.current = text;
              if (refusal?.kind === 'field' && refusal.field === 'password') setRefusal(null);
              checks.edited('password', text);
            }}
            onBlur={() => checks.left('password', password.current)}
            returnKeyType={codeAsked ? 'next' : 'done'}
            onSubmitEditing={() => (codeAsked ? codeInput.current?.focus() : void submit())}
            submitBehavior="submit"
            accessibilityLabel={t('devices.everywherePassword')}
            testID="devices.everywhere.password"
          />
        </Field>
      )}

      {viaName != null && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('devices.everywhereProvider', { provider: viaName })}
        </Text>
      )}

      <View {...aboveKeyboard} style={styles.group}>
        {codeAsked && (
          <Field
            label={t('devices.everywhereCode')}
            error={codeError}
            help={t('devices.everywhereCodeHelp')}
          >
            <CodeField
              ref={codeInput}
              takesRecoveryCode
              wrong={codeError != null}
              submitting={working}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onChangeText={(text) => {
                code.current = text;
                if (refusal?.kind === 'field' && refusal.field === 'code') setRefusal(null);
                checks.edited('code', text);
              }}
              onBlur={() => checks.left('code', code.current)}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              submitBehavior="submit"
              accessibilityLabel={t('devices.everywhereCode')}
              testID="devices.everywhere.code"
            />
          </Field>
        )}

        <Notice
          tone="attention"
          mark="!"
          title={t('devices.everywhereWarning', { count })}
          body={t('devices.everywhereWarningBody', { count })}
        />

        {provider != null && button.kind === 'provider' ? (
          <ProviderButton
            provider={provider}
            label={button.label}
            onPress={() => void submit()}
            busy={working}
            off={button.off}
            testID="devices.everywhere.confirm"
          />
        ) : (
          <PrimaryButton
            label={button.label}
            onPress={() => void submit()}
            busy={working}
            off={button.off}
            testID="devices.everywhere.confirm"
          />
        )}
      </View>
      <SecondaryButton
        label={t('devices.everywhereKeep', { count })}
        onPress={onKeep}
        off={working}
        testID="devices.everywhere.keep"
      />
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  group: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  detail: { flex: 1, minWidth: 200, gap: tokens.spaceXxs },
  name: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceHair,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccentTint,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colorAccent,
  },
  footer: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
});
