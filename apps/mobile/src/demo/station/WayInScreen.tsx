import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '../DemoScreen.tsx';
import { InsideEvent } from '../doorCode/Inside.tsx';
import { nightOf, rowLineOf } from '../myNight/myNightModel.ts';
import { EVENT } from './stationModel.ts';
import { overviewOf, wayInStateOf } from './wayInBoards.ts';

/** /demo/kitchen-way-in: the event's Overview with Kitchen station under Your night, or first (sc-95382). */
export function WayInRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = overviewOf(wayInStateOf(state));
  const [at, setAt] = useState<'overview' | 'people'>('overview');
  const night = nightOf('kitchen');

  return (
    <InsideEvent
      key={state}
      at={at}
      role={shown.role}
      who={shown.who}
      locale="en"
      shown={{
        id: 'evt-adaeze-tunde',
        name: EVENT,
        day: '2026-11-28',
        starts: '17:00',
        ends: { date: '2026-11-29', time: '01:00' },
        venue: 'Eko Hotel, Victoria Island',
        job: shown.rostered ? night.job : null,
      }}
      {...(shown.rostered && {
        night: {
          line: rowLineOf(night),
          onOpen: () => router.push('/demo/my-night?state=kitchen'),
        },
      })}
      {...(shown.station != null && {
        station: {
          line: shown.station.line,
          onOpen: () => router.push(shown.station?.href as Href),
        },
      })}
      onAt={setAt}
      onSignOut={goBack}
      onAccount={() => router.push('/demo/settings/account?as=noOrg')}
    />
  );
}
