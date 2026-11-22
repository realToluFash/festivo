import type { Membership } from '@soirely/api-client';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useShownLanguage } from '../../i18n/index.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { pausedIn } from './PausedSample.ts';
import { YOU } from './sample.ts';

/** What stands in place of Settings while the organisation holds the account: paused access (sc-564) or two-factor overdue (sc-609). */
export type Held = 'paused' | 'overdue';

export function heldOf(value: string | undefined): Held | null {
  return value === 'paused' || value === 'overdue' ? value : null;
}

// AccessPaused reads only how many others there are, to choose between switching and the switcher.
const OTHERS = [
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos' },
  { id: 'org-harbourlight', name: 'Harbour Light Weddings' },
] as unknown as Membership[];

/** The product's paused screen on sample data; Switch organisation opens the demo's switcher. */
function Paused() {
  const opener = useRef<ViewInstance>(null);
  const org = useOrgOpener(opener, false);
  const language = useShownLanguage();

  return (
    <AccessPaused
      paused={pausedIn(language)}
      others={OTHERS}
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
  return held === 'paused' ? <Paused /> : <Overdue onSignOut={onSignOut} />;
}
