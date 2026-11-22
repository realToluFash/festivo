import type { Membership } from '@soirely/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useShownLanguage } from '../../i18n/index.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { switcherStateOf } from '../OrgSwitcherModel.ts';
import { pausedIn } from './PausedSample.ts';
import { YOU } from './sample.ts';

/** What stands in place of Settings while the organisation holds the account: paused access (sc-564) or two-factor overdue (sc-609). */
export type Held = 'paused' | 'overdue';

/** `?switcher=one`: the switcher lists no organisation besides this one, as for a member of it alone or whose others are paused too (sc-85006). */
export function aloneOf(switcher: string | undefined): boolean {
  return switcherStateOf(switcher) === 'one';
}

const ALONE_SAYS = {
  paused: 'Your access to single events is not affected.',
  overdue: 'Your single-event access is not affected.',
} as const;

export function heldOf(value: string | undefined): Held | null {
  return value === 'paused' || value === 'overdue' ? value : null;
}

// AccessPaused reads only how many others there are, to choose between switching and the switcher.
const OTHERS = [
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos' },
  { id: 'org-harbourlight', name: 'Harbour Light Weddings' },
] as unknown as Membership[];

/** Until sc-85006 is built, the product's card still names other organisations; this says what it reads instead. */
function AloneSays({ held }: { held: Held }) {
  return (
    <DemoOnly
      title={`sc-85006: with no other organisation in the switcher, the card says “${ALONE_SAYS[held]}” in place of the sentence naming other organisations.`}
    >
      {null}
    </DemoOnly>
  );
}

/** The product's paused screen on sample data; Switch organisation opens the demo's switcher. */
function Paused({ alone }: { alone: boolean }) {
  const opener = useRef<ViewInstance>(null);
  const org = useOrgOpener(opener, false);
  const language = useShownLanguage();

  return (
    <AccessPaused
      paused={pausedIn(language)}
      others={alone ? [] : OTHERS}
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

  return alone ? (
    <>
      {card}
      <AloneSays held={held} />
    </>
  ) : (
    card
  );
}
