import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CodeField, Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { CODE_FIGURES, Note, RowPill, StepPill, WhiteRows } from './AccountParts.tsx';
import { passwordProblem, plural, secondFactorProblem } from './AccountSample.ts';
import { Card, CardHead, Chip, Pair, Pill, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';
import { dayAtTime, dayOf, type Device } from './SecuritySample.ts';

export type DevicesStage =
  { kind: 'rest' } | { kind: 'checking'; id: string } | { kind: 'everywhere' };

const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

export function DevicesCard({
  layout,
  devices,
  onDevices,
  twoFactorOn,
  startStage,
}: {
  layout: SettingsLayout;
  devices: readonly Device[];
  onDevices: (devices: Device[]) => void;
  twoFactorOn: boolean;
  startStage: DevicesStage;
}) {
  const locale = useMemo(() => formattingLocale('en', getLocales()[0]?.languageTag), []);
  const [stage, setStage] = useState<DevicesStage>(startStage);
  const [said, setSaid] = useState<string | null>(null);
  const others = devices.filter((device) => !device.here);
  const checking = stage.kind === 'checking' ? devices.find((d) => d.id === stage.id) : null;
  const usage = (device: Device): string =>
    device.lastUsed == null ? 'In use now' : `Last used ${dayAtTime(device.lastUsed, locale)}`;

  if (checking != null)
    return (
      <Card>
        <CardHead
          title={`Sign out ${checking.name}?`}
          line={`It signed in on ${dayAtTime(checking.signedIn, locale)} from ${checking.ip} and was last used ${checking.lastUsed == null ? 'now' : dayAtTime(checking.lastUsed, locale)}. Soirely cannot check that it is the device you have in mind. You stay signed in here.`}
        />
        <Notice
          tone="attention"
          mark="!"
          title="Whoever has it is signed out"
          body="It has to sign in again before it can carry on, so first check that nobody is using it at an event. If somebody else may have it, change your password as well; that signs out every other device."
        />
        <Pair
          layout={layout}
          dismiss={
            <StepPill
              layout={layout}
              label="Keep it signed in"
              kind="quiet"
              onPress={() => setStage({ kind: 'rest' })}
            />
          }
          confirm={
            <StepPill
              layout={layout}
              label="Sign it out"
              kind="danger"
              onPress={() => {
                onDevices(devices.filter((device) => device.id !== checking.id));
                setSaid(`${checking.name} is signed out.`);
                setStage({ kind: 'rest' });
              }}
            />
          }
        />
      </Card>
    );

  if (stage.kind === 'everywhere')
    return (
      <Everywhere
        layout={layout}
        count={others.length}
        twoFactorOn={twoFactorOn}
        onKeep={() => setStage({ kind: 'rest' })}
        onSignedOut={() => {
          onDevices(devices.filter((device) => device.here));
          setSaid(
            plural(
              others.length,
              'Your other device is signed out.',
              `Your ${others.length} other devices are signed out.`,
            ),
          );
          setStage({ kind: 'rest' });
        }}
      />
    );

  return (
    <Card>
      <CardHead
        title="Signed in on"
        line="Each device is listed as it described itself when it signed in, with the network address it used. Soirely cannot check either, or tell where a device is. Sign out any you do not recognise."
        right={
          <Chip
            word={plural(devices.length, '1 device', `${devices.length} devices`)}
            kind="built"
          />
        }
      />
      {said != null && <Notice tone="done" mark={tokens.marks.done.glyph} body={said} announce />}
      <WhiteRows>
        {devices.map((device) => (
          <DeviceRow
            key={device.id}
            device={device}
            wide={layout === 'portrait'}
            started={dayAtTime(device.signedIn, locale)}
            usage={`${usage(device)} · expires ${dayOf(device.expires, locale)} if not used again`}
            onSignOut={() => {
              setSaid(null);
              if (device.here) router.replace('/demo/welcome?notice=signedOut');
              else setStage({ kind: 'checking', id: device.id });
            }}
          />
        ))}
      </WhiteRows>
      {others.length > 0 && (
        <View style={styles.foot}>
          <Pill
            label="Sign out everywhere else…"
            kind="dangerQuiet"
            full={layout === 'phone'}
            height={tokens.sizeHitPhonePrimary}
            onPress={() => {
              setSaid(null);
              setStage({ kind: 'everywhere' });
            }}
          />
          <Note text="Every device except this one. Asks you to confirm it is you first." />
        </View>
      )}
    </Card>
  );
}

function DeviceRow({
  device,
  wide,
  started,
  usage,
  onSignOut,
}: {
  device: Device;
  wide: boolean;
  started: string;
  usage: string;
  onSignOut: () => void;
}) {
  const action = device.here ? (
    <RowPill label="Sign out" glyph="signOut" onPress={onSignOut} />
  ) : (
    <RowPill
      label="Sign out…"
      kind="dangerQuiet"
      onPress={onSignOut}
      accessibilityLabel={`Sign out ${device.name}`}
    />
  );
  const words = (
    <View style={styles.words}>
      <View style={styles.name}>
        <Text size={15.5} weight="semibold">
          {device.name}
        </Text>
        {device.here && <Chip word="This device" kind="active" />}
      </View>
      <Text size={TYPE.small} weight="medium" style={styles.meta}>
        {`Signed in ${started} · from ${device.ip}`}
      </Text>
      <Text size={TYPE.small} weight="medium" style={styles.meta}>
        {usage}
      </Text>
    </View>
  );
  const tile = (
    <View
      style={styles.tile}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph name={device.kind} size={20} ink={tokens.colorInk} weight={2} />
    </View>
  );

  if (wide)
    return (
      <View style={[styles.row, styles.line]}>
        {tile}
        {words}
        {action}
      </View>
    );

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        {tile}
        {words}
      </View>
      <View style={styles.under}>{action}</View>
    </View>
  );
}

function Everywhere({
  layout,
  count,
  twoFactorOn,
  onKeep,
  onSignedOut,
}: {
  layout: SettingsLayout;
  count: number;
  twoFactorOn: boolean;
  onKeep: () => void;
  onSignedOut: () => void;
}) {
  const password = useRef('');
  const code = useRef('');
  const [errors, setErrors] = useState<{ password: string | null; code: string | null }>({
    password: null,
    code: null,
  });

  function signOut(): void {
    const wrongPassword = passwordProblem(password.current);
    const wrongCode = twoFactorOn ? secondFactorProblem(code.current) : null;

    if (wrongPassword == null && wrongCode == null) {
      onSignedOut();
      return;
    }
    setErrors({
      password:
        wrongPassword == null
          ? null
          : wrongPassword === 'blank'
            ? 'Enter your password.'
            : 'That is not your password. Try again, or reset it by email.',
      code:
        wrongCode == null
          ? null
          : wrongCode === 'blank'
            ? 'Enter a code from your app, or a recovery code.'
            : 'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    });
  }

  return (
    <Card>
      <CardHead
        title="Sign out everywhere else?"
        line={plural(
          count,
          'This signs out your other device, whoever has it. This device stays signed in.',
          `This signs out your ${count} other devices, whoever has them. This device stays signed in.`,
        )}
      />
      <Field
        label={PASSWORD_LABEL}
        error={errors.password}
        help="So that nobody who picks up this device can do this without you."
      >
        <PasswordField
          wrong={errors.password != null}
          autoFocus
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            password.current = text;
            if (errors.password != null) setErrors({ ...errors, password: null });
          }}
          returnKeyType={twoFactorOn ? 'next' : 'done'}
          onSubmitEditing={twoFactorOn ? undefined : signOut}
          submitBehavior={twoFactorOn ? 'blurAndSubmit' : 'submit'}
          accessibilityLabel={PASSWORD_LABEL}
          testID="demo.security.everywhere.password"
        />
      </Field>
      {twoFactorOn && (
        <Field
          label={CODE_LABEL}
          error={errors.code}
          help="From your authenticator app, or one of your recovery codes. Two-factor protects this the way it protects signing in."
        >
          <CodeField
            takesRecoveryCode
            wrong={errors.code != null}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onChangeText={(text) => {
              code.current = text;
              if (errors.code != null) setErrors({ ...errors, code: null });
            }}
            onSubmitEditing={signOut}
            submitBehavior="submit"
            accessibilityLabel={CODE_LABEL}
            testID="demo.security.everywhere.secondFactor"
          />
        </Field>
      )}
      <Notice
        tone="attention"
        mark="!"
        title={plural(count, 'Whoever has it is signed out', 'Whoever has them is signed out')}
        body={plural(
          count,
          'It has to sign in again before it can carry on.',
          'They have to sign in again before they can carry on.',
        )}
      />
      <Pair
        layout={layout}
        dismiss={
          <StepPill
            layout={layout}
            label={plural(count, 'Keep it signed in', 'Keep them signed in')}
            kind="quiet"
            onPress={onKeep}
          />
        }
        confirm={
          <StepPill
            layout={layout}
            label={plural(count, 'Sign it out', 'Sign them out')}
            kind="danger"
            onPress={signOut}
          />
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: tokens.spaceXl, paddingVertical: 14, gap: tokens.spaceMd },
  line: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  under: { paddingLeft: 54, flexDirection: 'row' },
  words: { flex: 1, minWidth: 0, gap: 3 },
  name: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  meta: { color: tokens.colorInkSecondary, ...CODE_FIGURES, letterSpacing: 0 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: { gap: tokens.spaceSm },
});
