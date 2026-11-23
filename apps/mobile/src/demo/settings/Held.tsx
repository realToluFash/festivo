import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useShownLanguage } from '../../i18n/index.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { type Held, aloneNoteOf, aloneOf, othersOf } from './HeldModel.ts';
import { pausedIn } from './PausedSample.ts';
import { YOU } from './sample.ts';

/** The demo's box under the card, carrying sc-85006's sentence until the product says it. */
function AloneSays({ note }: { note: string }) {
  return <DemoOnly title={note}>{null}</DemoOnly>;
}

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
function Overdue({ onSignOut }: { onSignOut: () => void }) {
  const shell = useShell();

  return (
    <TwoFactorOverdue
      organisation={YOU.organisation}
      answer={null}
      onTurnOn={() => shell.openSection('security', 'setup')}
      onSignOut={onSignOut}
    />
  );
}

export function HeldStandIn({ held, onSignOut }: { held: Held; onSignOut: () => void }) {
  const alone = aloneOf(useLocalSearchParams<{ switcher?: string }>().switcher);
  const card = held === 'paused' ? <Paused alone={alone} /> : <Overdue onSignOut={onSignOut} />;
  const note = aloneNoteOf(held, alone);

  return note == null ? (
    card
  ) : (
    <>
      {card}
      <AloneSays note={note} />
    </>
  );
}
