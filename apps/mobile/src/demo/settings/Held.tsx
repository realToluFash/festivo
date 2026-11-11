import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { YOU } from './sample.ts';

/** What stands in place of Settings while the organisation holds the account: paused access (sc-564) or two-factor overdue (sc-609). */
export type Held = 'paused' | 'overdue';

export function heldOf(value: string | undefined): Held | null {
  return value === 'paused' || value === 'overdue' ? value : null;
}

const PAUSED: PausedOrganisation = {
  id: 'org-ire-events',
  name: YOU.organisation,
  countryCode: 'NG',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  suspension: {
    reason: 'domain_closed',
    domain: 'ire.events',
    since: { at: '2026-11-02T09:00:00Z', written: 'Monday, Nov 2 at 10:00 WAT' },
    removesAt: { at: '2026-12-02T09:00:00Z', written: 'Wednesday, Dec 2 at 10:00 WAT' },
    onlyOwner: false,
  },
  ownerClaim: null,
};

// AccessPaused reads only how many others there are, to choose between switching and the switcher.
const OTHERS = [
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos' },
  { id: 'org-harbourlight', name: 'Harbour Light Weddings' },
] as unknown as Membership[];

/** The product's paused screen on sample data; Switch organisation opens the demo's switcher. */
function Paused() {
  const opener = useRef<ViewInstance>(null);
  const org = useOrgOpener(opener, false);

  return (
    <AccessPaused
      paused={PAUSED}
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
