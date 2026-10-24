import {
  ApiError,
  type DeviceSession,
  type LinkedProvider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { formatDay, formatTimeOfDay, othersOf, thisDeviceFirst } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type EverywhereRefusal,
  deviceMoment,
  deviceName,
  everywhereRefusal,
} from '../kit/devices.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { currentSessionId } from '../tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

type Devices =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; sessions: DeviceSession[] };

type Said =
  | { kind: 'ended'; name: string }
  | { kind: 'endFailed' }
  | { kind: 'everywhere'; signedOut: number };

type Stage =
  | { kind: 'list'; said: Said | null }
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
  const frame = cardFrame(kind);
  const here = currentSessionId();

  if (listedFor !== reload) {
    setListedFor(reload);
    setDevices({ kind: 'loading' });
    setStage({ kind: 'list', said: null });
  }

  useEffect(() => {
    let live = true;

    api
      .sessions()
      .then((sessions) => {
        if (live) setDevices({ kind: 'ready', sessions });
      })
      .catch(() => {
        if (live) setDevices({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt, reload]);

  function retry(): void {
    setDevices({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  async function end(device: DeviceSession): Promise<void> {
    try {
      await api.endSession(device.id);
    } catch {
      setStage({ kind: 'list', said: { kind: 'endFailed' } });

      return;
    }

    setStage({ kind: 'list', said: { kind: 'ended', name: deviceName(device, t) } });
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

    setStage({ kind: 'list', said: { kind: 'everywhere', signedOut: result.signedOut } });
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
          onKeep={() => setStage({ kind: 'list', said: null })}
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
          onKeep={() => setStage({ kind: 'list', said: null })}
          onCodeSpent={onCodeSpent}
        />
      </View>
    );
  }

  const said = stage.kind === 'list' ? stage.said : null;

  return (
    <View style={frame}>
      <View style={styles.heading}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('devices.title')}
        </Text>
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
        />
      )}
      {said?.kind === 'endFailed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('devices.endFailedTitle')}
          body={t('devices.endFailedBody')}
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
          />
          <SecondaryButton label={t('devices.retry')} onPress={retry} testID="devices.retry" />
        </>
      )}

      {devices.kind === 'ready' && (
        <View accessibilityLabel={t('devices.listLabel')}>
          {thisDeviceFirst(devices.sessions, here).map((device) => (
            <Row
              key={device.id}
              device={device}
              here={device.id === here}
              onEndHere={() => onSignOutHere()}
              onCheck={() => setStage({ kind: 'checking', device })}
            />
          ))}
        </View>
      )}

      {devices.kind === 'ready' && othersOf(devices.sessions, here).count > 0 && (
        <View style={styles.footer}>
          <SecondaryButton
            label={t('devices.everywhere')}
            onPress={() => setStage({ kind: 'everywhere' })}
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
  onCheck,
  onEndHere,
}: {
  device: DeviceSession;
  here: boolean;
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
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('devices.checkTitle', { name })}
      </Text>
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
  const passwordInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
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
    (field) => (field === 'password' ? passwordInput : codeInput).current?.focus(),
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

  async function submit(): Promise<void> {
    if (working || refusal?.kind === 'limited') return;
    if (!checks.passes({ password: password.current, code: code.current })) return;

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

      // A refused trip is made again; after a wrong code the kept sign-in is sent again.
      if (provider != null && error instanceof ApiError && error.is('invalid_credentials')) {
        returned.current = null;
        setConfirmed(false);
      }
      setRefusal(everywhereRefusal(error, provider != null, t));
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

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('devices.everywhereTitle')}
      </Text>
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
        />
      )}
      {refusal?.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('devices.everywhereFailedTitle')}
          body={refusal.message}
        />
      )}

      {provider != null && confirmed && codeAsked && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('devices.everywhereProviderConfirmed', { provider: PROVIDER_NAMES[provider] })}
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
            editable={!working}
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
              editable={!working}
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

        <PrimaryButton
          label={
            refusal?.kind === 'limited'
              ? until == null
                ? t('devices.everywhereRetrySoon')
                : t('devices.everywhereRetryAt', { time: until })
              : working
                ? t('devices.everywhereWorking')
                : viaName != null
                  ? t('devices.everywhereContinueWith', { provider: viaName })
                  : keepsThisDevice
                    ? t('devices.everywhereConfirm', { count })
                    : t('devices.everywhereConfirmAll', { count })
          }
          onPress={() => void submit()}
          busy={working}
          off={refusal?.kind === 'limited'}
          testID="devices.everywhere.confirm"
        />
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
