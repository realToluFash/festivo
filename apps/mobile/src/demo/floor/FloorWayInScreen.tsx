import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { goBack } from '../DemoScreen.tsx';
import { InsideEvent } from '../doorCode/Inside.tsx';
import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { nightOf, rowLineOf } from '../myNight/myNightModel.ts';
import { EVENT } from '../station/stationModel.ts';
import { ORGANISER_EVENT } from '../station/wayInBoards.ts';
import {
  type FloorLink,
  type FloorWayInOverview,
  floorOverviewOf,
  floorWayInStateOf,
} from './floorWayInBoards.ts';

/** /demo/floor-way-in: the event's Overview with Floor under Kitchen station, else Your night, else first (sc-98893). */
export function FloorWayInRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = floorOverviewOf(floorWayInStateOf(state));

  return shown.page === 'organiser' ? (
    <OrganiserOverview key={state} shown={shown} />
  ) : (
    <RowListOverview key={state} shown={shown} />
  );
}

/** The floor lead moves the person while Overview is open: the line follows within 10 seconds. */
function useFloorLine(floor: FloorLink | null): string | null {
  const [line, setLine] = useState(floor?.line ?? null);
  const moves = floor?.moves;

  useEffect(() => {
    if (moves == null) return;
    const timer = setTimeout(() => setLine(moves.line), moves.in);

    return () => clearTimeout(timer);
  }, [moves]);

  return line;
}

/** Until the Floor read answers there is no row; then it fades in (`answering`). */
function useAnswered(floor: FloorLink | null): boolean {
  const waits = floor?.answersIn;
  const [answered, setAnswered] = useState(waits == null);

  useEffect(() => {
    if (waits == null) return;
    const timer = setTimeout(() => setAnswered(true), waits);

    return () => clearTimeout(timer);
  }, [waits]);

  return answered;
}

function rows(shown: FloorWayInOverview, floorLine: string | null) {
  const night = nightOf(shown.night);
  const { station, floor } = shown;

  return {
    ...(shown.rostered && {
      night: {
        line: rowLineOf(night),
        onOpen: () => router.push(`/demo/my-night?state=${shown.night}` as Href),
      },
    }),
    ...(station != null && {
      station: { line: station.line, onOpen: () => router.push(station.href as Href) },
    }),
    ...(floor != null &&
      floorLine != null && {
        floor: {
          line: floorLine,
          onOpen: () => router.push(floor.href as Href),
          fades: floor.answersIn != null,
        },
      }),
  };
}

function OrganiserOverview({
  shown,
}: {
  shown: Extract<FloorWayInOverview, { page: 'organiser' }>;
}) {
  const line = useFloorLine(shown.floor);
  const answered = useAnswered(shown.floor);

  return (
    <EventsShell>
      <EventScreen
        id={ORGANISER_EVENT}
        state={null}
        area={null}
        clock={shown.now}
        {...rows(shown, answered ? line : null)}
      />
    </EventsShell>
  );
}

function RowListOverview({ shown }: { shown: Extract<FloorWayInOverview, { page: 'rows' }> }) {
  const [at, setAt] = useState<'overview' | 'people'>('overview');
  const night = nightOf(shown.night);
  const line = useFloorLine(shown.floor);
  const answered = useAnswered(shown.floor);

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
      {...rows(shown, answered ? line : null)}
      onAt={setAt}
      onSignOut={goBack}
      onAccount={() => router.push('/demo/settings/account?as=noOrg')}
    />
  );
}
