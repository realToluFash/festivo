import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Toast } from '../components/Toast.tsx';
import {
  type Lead,
  type Moment,
  type Night,
  type Table,
  MN,
  fresh,
  guestCount,
  headingOf,
  moved,
  myNightStateOf,
  nightOf,
  signedOutAt,
} from './myNight.ts';
import './doorCheckIn.css';
import './myNight.css';

/** A staff member's whole night on one page (sc-3915): 390 first, two columns from 800, at /demo/my-night?state=… */
export function MyNight() {
  const [params] = useSearchParams();
  const state = myNightStateOf(params.get('state'));

  return <MyNightAt key={state} first={nightOf(state)} />;
}

function MyNightAt({ first }: { first: Night }) {
  const [night, setNight] = useState(first);
  const [told, setTold] = useState<string | null>(null);
  const signOut = () => setTold(MN.signOutLater);

  return (
    <main id="content" className="myn">
      <header className="myn-bar">
        {night.inApp && (
          <Link className="myn-back" to="/demo">
            <Glyph name="back" size={20} weight={2.4} />
            <span>{MN.events}</span>
          </Link>
        )}
        <span className="myn-brand">
          <Brand />
        </span>
        <You night={night} place="bar" onSignOut={signOut} />
      </header>
      <div className="myn-live" role="status" aria-live="polite">
        {night.updated != null && (
          <p className="myn-updated">
            <span className="myn-ring" aria-hidden="true">
              <Glyph name="tick" size={14} weight={3} />
            </span>
            <span>{MN.updated(night.updated)}</span>
          </p>
        )}
      </div>
      {night.staleAt != null && (
        <div className="myn-stale" role="status">
          <span className="myn-ring myn-ring-amber" aria-hidden="true">
            !
          </span>
          <div className="myn-stale-words">
            <p className="myn-strong">{MN.staleTitle}</p>
            <p>{MN.staleBody(night.staleAt)}</p>
          </div>
          <button type="button" className="ci-secondary" onClick={() => setNight(fresh(night))}>
            {MN.tryAgain}
          </button>
        </div>
      )}
      <div className="myn-page">
        {night.loading ? (
          <Loading />
        ) : (
          <>
            <div className="myn-head">
              <p className="myn-only">{MN.only(night.linkEnds)}</p>
              <p className="myn-event">{night.event}</p>
            </div>
            <div className="myn-columns">
              <div className="myn-column">
                <div className="myn-on">
                  <h1>
                    <span className="myn-on-label">{MN.onTonight}</span>{' '}
                    <span className="myn-on-station">{headingOf(night)}</span>
                  </h1>
                </div>
                {night.clock === 'open' && <ClockFrame shows={night.clockShows} />}
                <Shift night={night} />
                <YourLead lead={night.lead} />
                {night.rules != null && (
                  <section className="myn-card" aria-labelledby="myn-rules">
                    <h2 id="myn-rules">{MN.beforeYouStart}</h2>
                    <p className="myn-rules">{night.rules}</p>
                  </section>
                )}
              </div>
              <div className="myn-column">
                {night.timing != null && <Timing moments={night.timing} />}
                {night.tables != null && <Tables night={night} tables={night.tables} />}
                {night.state === 'night' && night.updated == null && (
                  <div className="myn-demo">
                    <p className="myn-strong">{MN.demoMove}</p>
                    <p>{MN.demoMoveBody}</p>
                    <button
                      type="button"
                      className="ci-secondary"
                      onClick={() => setNight(moved(night))}
                    >
                      {MN.demoMoveButton}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <You night={night} place="foot" onSignOut={signOut} />
      </div>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </main>
  );
}

function Loading() {
  return (
    <div className="myn-card myn-loading" role="status">
      <p>{MN.loading}</p>
      <span className="myn-bone" aria-hidden="true" />
      <span className="myn-bone myn-bone-short" aria-hidden="true" />
    </div>
  );
}

function ClockFrame({ shows }: { shows: string }) {
  return (
    <section className="myn-clock" aria-labelledby="myn-clock">
      <h2 id="myn-clock">{MN.clockFrame}</h2>
      <p>{MN.clockFrameBody(shows)}</p>
    </section>
  );
}

function Shift({ night }: { night: Night }) {
  return (
    <section className="myn-card" aria-labelledby="myn-shift">
      <h2 id="myn-shift">{MN.yourShift}</h2>
      <p className="myn-big">{night.job}</p>
      <p className="myn-time">{MN.times(night.starts, night.ends)}</p>
      {night.endsOn != null && (
        <p className="myn-time myn-quiet">{MN.endsOn(night.endsOn, night.ends)}</p>
      )}
      {night.later != null && (
        <p className="myn-inset myn-time">{MN.later(night.later.job, night.later.from)}</p>
      )}
    </section>
  );
}

function YourLead({ lead }: { lead: Lead | null }) {
  return (
    <section className="myn-card" aria-labelledby="myn-lead">
      <h2 id="myn-lead">{MN.yourLead}</h2>
      {lead == null ? (
        <p className="myn-quiet">{MN.noLead}</p>
      ) : (
        <div className="myn-lead">
          <div className="myn-lead-who">
            <p className="myn-big">{lead.name}</p>
            {lead.floor && (
              <p className="myn-flag">
                <Flag />
                {MN.floorLead}
              </p>
            )}
          </div>
          {lead.phone != null && (
            <a
              className="button button-primary myn-call"
              href={`tel:${lead.phone}`}
              aria-label={MN.callLabel(lead)}
            >
              <Glyph name="phone" size={18} />
              <span>{MN.call}</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function Flag() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 22V3" />
      <path d="M5 4h13l-3 4.5L18 13H5" />
    </svg>
  );
}

function Timing({ moments }: { moments: readonly Moment[] }) {
  return (
    <section className="myn-card" aria-labelledby="myn-timing">
      <h2 id="myn-timing">{MN.timing}</h2>
      <ol className="myn-moments">
        {moments.map((moment) => (
          <li key={`${moment.at}${moment.what}`}>
            <span className="myn-time myn-at">{moment.at}</span>
            <span className="myn-what">
              <span>{moment.what}</span>
              <span className="myn-for">
                <span
                  className={moment.for === 'staff' ? 'myn-square' : 'myn-circle'}
                  aria-hidden="true"
                />
                {moment.for === 'staff' ? MN.staff : MN.guests}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tables({ night, tables }: { night: Night; tables: readonly Table[] }) {
  return (
    <section className="myn-card" aria-labelledby="myn-tables">
      <h2 id="myn-tables">{MN.yourTables}</h2>
      {night.doorsOpen ? (
        tables.map((table) => (
          <div key={table.name} className="myn-table">
            <h3>
              <span>{table.name}</span>
              <span className="myn-count">{guestCount(table)}</span>
            </h3>
            <ul>
              {table.guests.map((guest) => (
                <li key={guest.name}>
                  <span>{guest.name}</span>
                  {guest.diet != null && (
                    <span className="myn-diet">
                      <span className="myn-diamond" aria-hidden="true" />
                      {guest.diet}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="myn-inset myn-opens">
          <Glyph name="clock" size={18} />
          <span>{MN.opensAt(night.doorsAt)}</span>
        </p>
      )}
    </section>
  );
}

/** Signed in as, the browser's line and Sign out: under the page on a phone, in the bar from 800; the app keeps only Sign out. */
function You({
  night,
  place,
  onSignOut,
}: {
  night: Night;
  place: 'bar' | 'foot';
  onSignOut: () => void;
}) {
  return (
    <div className={place === 'bar' ? 'myn-you myn-you-bar' : 'myn-you myn-you-foot'}>
      <p className="myn-strong">{MN.signedInAs(night.name)}</p>
      {!night.inApp && <p className="myn-alone">{MN.yoursAlone(signedOutAt(night))}</p>}
      <button type="button" className="ci-secondary" onClick={onSignOut}>
        {MN.signOut}
      </button>
    </div>
  );
}
