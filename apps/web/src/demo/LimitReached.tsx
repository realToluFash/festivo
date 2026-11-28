import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, type Tell, TitleRow } from '../components/SettingsParts.tsx';
import { EventsShell } from './EventParts.tsx';
import {
  type Ask,
  type Limit,
  LW,
  type Owners,
  type Refusal,
  type Role,
  SAMPLE,
  type Way,
  endOf,
  limitState,
  limitStateOf,
  planWayOf,
  refusalOf,
  refusedOn,
} from './limitReached.ts';
import { SIDEBAR_EVENTS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import { AskOwner, AskSwitches } from './LimitAsk.tsx';
import './limitReached.css';

const GUESTS_AT = '/demo/guests';
const MEMBERS_AT = '/demo/settings/members';

/** sc-3930: the refusal, a dialog over the page it was met on at 1280, the web's sheet once reflowed under 40rem. */
export function LimitReached() {
  const [params] = useSearchParams();
  const name = limitStateOf(params.get('state'));

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings inert={covered} />
      )}
    >
      {(tell) => <LimitPage key={name} {...limitState(name)} tell={tell} />}
    </EventsShell>
  );
}

function LimitPage({ limit, role, ask, tell }: { limit: Limit; role: Role; ask: Ask; tell: Tell }) {
  const [open, setOpen] = useState(true);
  const refusal = refusalOf(limit);

  return (
    <div className="desk-page">
      <div className="desk-column lr-page">
        <TitleRow title={refusedOn(limit)} />
        <p className="desk-line">
          The page the refusal was met on, as a shell. Nothing on it changed: the work is where it
          was.
        </p>
        <div className="lr-demo-only">
          <p>
            In the demo only. Role:{' '}
            <strong>{role === 'manage' ? 'billing.manage' : 'anyone else'}</strong>.{' '}
            <Link to="/demo#demo-page-37">All the refusal’s states</Link>
          </p>
          {!open && (
            <button type="button" className="desk-text" onClick={() => setOpen(true)}>
              Show the refusal again
            </button>
          )}
        </div>
      </div>
      {open && (
        <LimitRefusal
          refusal={refusal}
          role={role}
          start={ask}
          tell={tell}
          onBack={() => {
            setOpen(false);
            tell(`${refusal.back}: the work is as it was.`);
          }}
        />
      )}
    </div>
  );
}

/** The four parts in the AC's order: what happened, what is safe, the ways past (free first, the plan's last), and the one way back. */
export function LimitRefusal({
  refusal,
  role,
  start,
  tell,
  onBack,
}: {
  refusal: Refusal;
  role: Role;
  start: Ask;
  tell: Tell;
  onBack: () => void;
}) {
  const planWay = planWayOf(refusal, role);
  const [offline, setOffline] = useState(false);
  const [owners, setOwners] = useState<Owners>(start.now === 'sent' ? start.owners : 'several');

  return (
    <Dialog title={refusal.title} verb={null} cancel={false} onDismiss={onBack} onConfirm={onBack}>
      <div className="lr lr-hard-limit">
        {refusal.line != null && <p className="desk-line is-ink">{refusal.line}</p>}
        {refusal.figure != null && <p className="lr-figure">{refusal.figure}</p>}
        <p className="lr-safe">
          <Glyph name="shield" size={16} weight={2.2} />
          {refusal.safe}
        </p>
        {refusal.ways.length > 0 && (
          <ul className="lr-ways">
            {refusal.ways.map((way) => (
              <li key={way}>
                <WayPast way={way} tell={tell} />
              </li>
            ))}
          </ul>
        )}
        {planWay === 'change' && (
          <div className="lr-plan">
            {refusal.plan?.enterprise != null && (
              <p className="desk-line is-ink">{refusal.plan.enterprise}</p>
            )}
            <button
              type="button"
              className="button button-primary"
              onClick={() => tell('Compare plans opens, as sc-3935 draws it.')}
            >
              <span className="button-label">{LW.changePlan}</span>
            </button>
          </div>
        )}
        {planWay === 'ask' && <AskOwner start={start} offline={offline} owners={owners} />}
        <div className="lr-back">
          <button type="button" className="button" onClick={onBack}>
            <span className="button-label">{refusal.back}</span>
          </button>
        </div>
        {planWay === 'ask' && (
          <AskSwitches
            offline={offline}
            owners={owners}
            onOffline={setOffline}
            onOwners={setOwners}
          />
        )}
      </div>
    </Dialog>
  );
}

function WayPast({ way, tell }: { way: Way; tell: Tell }) {
  switch (way) {
    case 'goLive': {
      const { date, time } = endOf(SAMPLE.firstToEnd.endsAt, SAMPLE.firstToEnd.timeZone);
      return (
        <p className="lr-inset">
          <Glyph name="clock" size={16} weight={2.2} />
          {LW.goLive(SAMPLE.firstToEnd.name, date, time)}
        </p>
      );
    }
    case 'removeGuest':
      return (
        <div className="lr-row">
          <div className="lr-row-words">
            <p className="lr-row-title">{LW.removeGuest}</p>
            <p className="desk-line is-small">{LW.removeGuestLine}</p>
          </div>
          <a
            href={GUESTS_AT}
            className="desk-text"
            onClick={(click) => {
              click.preventDefault();
              tell('The guest list opens, with the form kept.');
            }}
          >
            {LW.toGuestList}
          </a>
        </div>
      );
    case 'withdraw':
    case 'removeMember':
      return (
        <a
          href={MEMBERS_AT}
          className="lr-row lr-row-link"
          onClick={(click) => {
            click.preventDefault();
            tell('Members opens, with the invitation kept.');
          }}
        >
          <span className="lr-row-words">
            <span className="lr-row-title">
              {way === 'withdraw' ? LW.withdraw : LW.removeMember}
            </span>
            <span className="desk-line is-small">
              {way === 'withdraw' ? LW.withdrawLine : LW.removeMemberLine}
            </span>
          </span>
          <Glyph name="chevron" size={16} weight={2.2} />
        </a>
      );
  }
}
