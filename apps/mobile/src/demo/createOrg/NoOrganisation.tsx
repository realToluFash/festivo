import { type Href, router } from 'expo-router';
import { useRef } from 'react';
import type { ViewInstance } from 'react-native';

import {
  NoOrgPage,
  NoOrgWayOn,
  SignedInWays,
  StartYourOwn,
} from '../../components/NoOrganisationParts.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { wayOnShows } from '../../kit/noOrgInvitations.ts';
import { ManagedBanner } from '../Managed.tsx';
import { useNoOrgInvitations, useStartWalk } from '../OrgSwitcher.tsx';
import { NoOrgInvitations } from './NoOrgInvitations.tsx';
import { type NoOrgBoard, noOrgSettings } from '../settings/fromNone.ts';
import { VIEWER } from '../OrgSwitcherModel.ts';

/** Main's NoOrganisation, its words and order, in B's parts: no tab bar and no switcher, as nothing here belongs to an organisation. A managed account reads sc-563's banner where Start your own was; invitations waiting are listed in place of the way on. Your account opens Settings' own list, with Back to here in place of the tab bar (sc-75471). */
export function NoOrganisation({ tell, board }: { tell: Tell; board: NoOrgBoard | null }) {
  const managed = board === 'managed';
  const start = useRef<ViewInstance>(null);
  const startWalk = useStartWalk(start);
  const email = VIEWER.email;
  const wayOn = wayOnShows(useNoOrgInvitations().invitations);

  return (
    <NoOrgPage>
      {wayOn ? <NoOrgWayOn email={email} /> : <NoOrgInvitations />}
      {managed ? (
        <ManagedBanner testID="noOrganisation.managed" />
      ) : (
        <StartYourOwn startRef={start} onStart={startWalk} />
      )}
      <SignedInWays
        email={email}
        onAccount={() => router.push(noOrgSettings(board) as Href)}
        onSignOut={() => tell('Sign out has its own design.')}
      />
    </NoOrgPage>
  );
}
