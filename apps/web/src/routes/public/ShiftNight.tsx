import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { api } from '../../api.ts';
import { restoreSession, useSessionState } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';
import { LinkGone, NotSignedIn } from './DoorCheckIn.tsx';
import { MyNightPage } from './MyNight.tsx';

/** /night/:eventId (sc-28230): the shift page check-in's Your shift leads back to, read by the event rather than the link, so a reload or an address typed again lands there too. */
export function ShiftNightPage() {
  const { eventId = '' } = useParams();

  return <ShiftNight key={eventId} eventId={eventId} />;
}

function ShiftNight({ eventId }: { eventId: string }) {
  const session = useSessionState();
  const [lost, setLost] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const { signOut, unreached } = useSignOut(() => setSignedOut(true));

  useEffect(() => {
    void restoreSession();
  }, []);

  if (session.status === 'signedOut') return <NotSignedIn signedOut={signedOut} />;
  if (session.status !== 'signedIn') return null;
  if (lost) return <LinkGone />;

  return (
    <MyNightPage
      source={eventId}
      read={() => api.myNight(eventId)}
      name={session.session.name}
      onSignOut={() => void signOut()}
      stillSignedIn={unreached}
      onLost={() => setLost(true)}
    />
  );
}
