import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SettingsPage, useShell } from './Frame.tsx';
import { type DevicesStage, DevicesCard } from './SecurityDevices.tsx';
import { ForgotTask } from './SecurityForgot.tsx';
import { DEVICES, type Device, type Ways } from './SecuritySample.ts';
import { type TwoFactorStage, TwoFactorCard } from './SecurityTwoFactor.tsx';
import { WaysCard, type WaysStage } from './SecurityWays.tsx';

/** Each starting state a board frame drew, as `/demo/settings/security?state=<name>`. */
export const SECURITY_STATES = [
  'rest',
  'googleOnly',
  'keptByRule',
  'changePassword',
  'setPassword',
  'link',
  'unlink',
  'setup',
  'recovery',
  'newCodes',
  'turnOff',
  'signOutDevice',
  'everywhere',
  'forgot',
  'forgotSent',
] as const;

type Start = (typeof SECURITY_STATES)[number];

export function SecuritySection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const start = SECURITY_STATES.find((name) => name === state) ?? 'rest';

  return <SecurityPage key={start} start={start} />;
}

function startingWays(start: Start): Ways {
  const googleOnly = start === 'googleOnly' || start === 'setPassword';

  return { password: !googleOnly, Google: true, Apple: false };
}

function waysStage(start: Start): WaysStage {
  if (start === 'changePassword') return { kind: 'changing' };
  if (start === 'setPassword') return { kind: 'setting' };
  if (start === 'link') return { kind: 'proving', provider: 'Apple', then: 'link' };
  if (start === 'unlink') return { kind: 'unlinking', provider: 'Google' };

  return { kind: 'rest' };
}

function twoFactorStage(start: Start): TwoFactorStage {
  if (start === 'setup') return 'setup';
  if (start === 'newCodes') return 'newCodes';
  if (start === 'turnOff') return 'turningOff';

  return 'rest';
}

function devicesStage(start: Start): DevicesStage {
  if (start === 'signOutDevice') return { kind: 'checking', id: 'safari' };
  if (start === 'everywhere') return { kind: 'everywhere' };

  return { kind: 'rest' };
}

function SecurityPage({ start }: { start: Start }) {
  const { layout } = useShell();
  const [opening, setOpening] = useState<Start>(start);
  const [ways, setWays] = useState(() => startingWays(start));
  const [twoFactorOn, setTwoFactorOn] = useState(
    !['googleOnly', 'setPassword', 'setup'].includes(start),
  );
  const [devices, setDevices] = useState<readonly Device[]>(DEVICES);
  const [forgot, setForgot] = useState<'form' | 'sent' | null>(
    start === 'forgot' ? 'form' : start === 'forgotSent' ? 'sent' : null,
  );
  const rule = start === 'keptByRule';

  if (forgot != null)
    return (
      <ForgotTask
        sent={forgot === 'sent'}
        onBack={() => {
          setOpening('rest');
          setForgot(null);
        }}
      />
    );

  return (
    <SettingsPage title="Security">
      <WaysCard
        layout={layout}
        ways={ways}
        onWays={setWays}
        rule={rule}
        twoFactorOn={twoFactorOn}
        startStage={waysStage(opening)}
        onForgot={() => setForgot('form')}
        onSignedOutOthers={() => {
          const gone = devices.filter((device) => !device.here).length;
          setDevices(devices.filter((device) => device.here));

          return gone;
        }}
      />
      <TwoFactorCard
        layout={layout}
        on={twoFactorOn}
        onTurned={setTwoFactorOn}
        rule={rule}
        startStage={twoFactorStage(opening)}
        startSaving={opening === 'recovery'}
      />
      <DevicesCard
        layout={layout}
        devices={devices}
        onDevices={setDevices}
        twoFactorOn={twoFactorOn}
        startStage={devicesStage(opening)}
      />
    </SettingsPage>
  );
}
