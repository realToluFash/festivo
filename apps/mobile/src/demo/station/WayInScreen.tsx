import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { goBack } from '../DemoScreen.tsx';
import { InsideEvent } from '../doorCode/Inside.tsx';
import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { nightOf, rowLineOf } from '../myNight/myNightModel.ts';
import { EVENT } from './stationModel.ts';
import { ORGANISER_EVENT, type WayInOverview, overviewOf, wayInStateOf } from './wayInBoards.ts';

/** /demo/kitchen-way-in: the event's Overview with Kitchen station under Your night, or in its place (sc-95382). */
export function WayInRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = overviewOf(wayInStateOf(state));

  return shown.page === 'organiser' ? (
    <OrganiserOverview key={state} shown={shown} />
  ) : (
    <RowListOverview key={state} shown={shown} />
  );
}

/** Until the stations read answers there is no row; then it fades in (sc-95382, `answering`). */
function useAnswered(station: WayInOverview['station']): boolean {
  const waits = station?.answersIn;
  const [answered, setAnswered] = useState(waits == null);

  useEffect(() => {
    if (waits == null) return;
    const timer = setTimeout(() => setAnswered(true), waits);

    return () => clearTimeout(timer);
  }, [waits]);

  return answered;
}

function stationRow(station: WayInOverview['station'], answered: boolean) {
  return station == null || !answered
    ? {}
    : {
        station: {
          line: station.line,
          onOpen: () => router.push(station.href as Href),
          fades: station.answersIn != null,
        },
      };
}

function OrganiserOverview({ shown }: { shown: Extract<WayInOverview, { page: 'organiser' }> }) {
  const night = nightOf(shown.night);
  const answered = useAnswered(shown.station);

  return (
    <EventsShell>
      <EventScreen
        id={ORGANISER_EVENT}
        state={null}
        area={null}
        clock={shown.now}
        {...(shown.rostered && {
          night: {
            line: rowLineOf(night),
            onOpen: () => router.push(`/demo/my-night?state=${shown.night}` as Href),
          },
        })}
        {...stationRow(shown.station, answered)}
      />
    </EventsShell>
  );
}

function RowListOverview({ shown }: { shown: Extract<WayInOverview, { page: 'rows' }> }) {
  const [at, setAt] = useState<'overview' | 'people'>('overview');
  const night = nightOf('kitchen');
  const answered = useAnswered(shown.station);

  return (
    <InsideEvent
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
      {...stationRow(shown.station, answered)}
      onAt={setAt}
      onSignOut={goBack}
      onAccount={() => router.push('/demo/settings/account?as=noOrg')}
    />
  );
}
