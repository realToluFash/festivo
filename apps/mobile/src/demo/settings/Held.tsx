import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useShownLanguage } from '../../i18n/index.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { type Held, aloneOf, othersOf } from './HeldModel.ts';
import { pausedIn } from './PausedSample.ts';
import { YOU } from './sample.ts';

/** The product's paused screen on sample data; Switch organisation opens the demo's switcher. */
function Paused({ alone }: { alone: boolean }) {
  const opener = useRef<ViewInstance>(null);
  const org = useOrgOpener(opener, false);
  const language = useShownLanguage();

  return (
    <AccessPaused
      paused={pausedIn(language)}
      others={othersOf(alone)}
      onSwitch={() => org.onPress()}
      onChoose={() => org.onPress()}
    />
  );
}

/** The product's overdue screen on sample data; Turn on opens Security's setup, Sign out lands on Welcome. */
function Overdue({ alone, onSignOut }: { alone: boolean; onSignOut: () => void }) {
  const shell = useShell();

  return (
    <TwoFactorOverdue
      organisation={YOU.organisation}
      othersListed={!alone}
      answer={null}
      onTurnOn={() => shell.openSection('security', 'setup')}
      onSignOut={onSignOut}
    />
  );
}

export function HeldStandIn({ held, onSignOut }: { held: Held; onSignOut: () => void }) {
  const alone = aloneOf(useLocalSearchParams<{ switcher?: string }>().switcher);
  return held === 'paused' ? (
    <Paused alone={alone} />
  ) : (
    <Overdue alone={alone} onSignOut={onSignOut} />
  );
}
