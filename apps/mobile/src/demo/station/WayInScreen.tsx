import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { dateLocale } from '../../i18n/index.ts';
import { goBack } from '../DemoScreen.tsx';
import { InsideEvent } from '../doorCode/Inside.tsx';
import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { floorOverviewOf, floorWayInStateOf } from '../floor/floorWayInBoards.ts';
import { nightOf, rowLineOf } from '../myNight/myNightModel.ts';
import { EVENT } from './stationModel.ts';
import { overviewOf, wayInStateOf } from './wayInBoards.ts';
import { ORGANISER_EVENT, type ServiceLink, type WayInOverview } from './wayInShown.ts';

/** /demo/kitchen-way-in: the event's Overview with Kitchen station under Your night, or in its place (sc-95382). */
export function WayInRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();

  return <WayIn key={state} shown={overviewOf(wayInStateOf(state))} />;
}

/** /demo/floor-way-in: the same Overview, its states drawn for Floor (sc-98893). */
export function FloorWayInRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();

  return <WayIn key={state} shown={floorOverviewOf(floorWayInStateOf(state))} />;
}

function WayIn({ shown }: { shown: WayInOverview }) {
  return shown.page === 'organiser' ? (
    <OrganiserOverview shown={shown} />
  ) : (
    <RowListOverview shown={shown} />
  );
}

/** No row until the read answers; then the line, the next one when a move or a read lands, and none once a read is refused. */
function useLine(link: ServiceLink | null): string | null {
  const waits = link?.answersIn;
  const moves = link?.moves;
  const goes = link?.goesIn;
  const [answered, setAnswered] = useState(waits == null);
  const [gone, setGone] = useState(false);
  const [line, setLine] = useState(link?.line ?? null);

  useEffect(() => {
    if (waits == null) return;
    const timer = setTimeout(() => setAnswered(true), waits);

    return () => clearTimeout(timer);
  }, [waits]);

  useEffect(() => {
    if (moves == null) return;
    const timer = setTimeout(() => setLine(moves.line), moves.in);

    return () => clearTimeout(timer);
  }, [moves]);

  useEffect(() => {
    if (goes == null) return;
    const timer = setTimeout(() => setGone(true), goes);

    return () => clearTimeout(timer);
  }, [goes]);

  return answered && !gone ? line : null;
}

function row(link: ServiceLink | null, line: string | null) {
  return link == null || line == null
    ? undefined
    : {
        line,
        onOpen: () => router.push(link.href as Href),
        fades: link.answersIn != null,
      };
}

function useRows(shown: WayInOverview) {
  const night = nightOf(shown.night);
  const stationLine = useLine(shown.station);
  const floorLine = useLine(shown.floor);
  const station = row(shown.station, stationLine);
  const floor = row(shown.floor, floorLine);

  return {
    ...(shown.rostered && {
      night: {
        line: rowLineOf(night),
        onOpen: () => router.push(`/demo/my-night?state=${shown.night}` as Href),
      },
    }),
    ...(station != null && { station }),
    ...(floor != null && { floor }),
  };
}

function OrganiserOverview({ shown }: { shown: Extract<WayInOverview, { page: 'organiser' }> }) {
  const rows = useRows(shown);

  return (
    <EventsShell>
      <EventScreen id={ORGANISER_EVENT} state={null} area={null} clock={shown.now} {...rows} />
    </EventsShell>
  );
}

function RowListOverview({ shown }: { shown: Extract<WayInOverview, { page: 'rows' }> }) {
  const [at, setAt] = useState<'overview' | 'people'>('overview');
  const night = nightOf(shown.night);
  const rows = useRows(shown);

  return (
    <InsideEvent
      at={at}
      role={shown.role}
      who={shown.who}
      locale={dateLocale()}
      shown={{
        id: 'evt-adaeze-tunde',
        name: EVENT,
        day: '2026-11-28',
        starts: '17:00',
        ends: { date: '2026-11-29', time: '01:00' },
        venue: 'Eko Hotel, Victoria Island',
        job: shown.rostered ? night.job : null,
      }}
      {...rows}
      onAt={setAt}
      onSignOut={goBack}
      onAccount={() => router.push('/demo/settings/account?as=noOrg')}
    />
  );
}
