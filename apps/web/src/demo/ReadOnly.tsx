import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  Chevron,
  Dialog,
  RowWords,
  Tag,
  type Tell,
  TitleRow,
} from '../components/SettingsParts.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import {
  type Email,
  ORGANISATION,
  type Page,
  type Refused,
  REFUSALS,
  REFUSED,
  RW,
  type Role,
  type Status,
  bannerOf,
  mailOf,
  owes,
  pageOf,
  type ReadOnlyStateName,
  readOnlyState,
  readOnlyStateOf,
  refuses,
  runsNormally,
  wayPastOf,
} from './readOnly.ts';
import { SIDEBAR_EVENTS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './limitReached.css';
import './usageWarning.css';
import './readOnly.css';

const HOSTED =
  'The provider’s hosted page opens, as the Payment method card’s Update does (sc-3933).';
const LEAVES_MS = 200;

const isRefused = (page: Page): page is Refused => (REFUSED as readonly string[]).includes(page);

/** sc-3937: the past-due and read-only banners in the shell, Running normally beside each live event, and the refusal of new work. */
export function ReadOnly() {
  const [params] = useSearchParams();
  const name = readOnlyStateOf(params.get('state'));
  const state = readOnlyState(name);
  const page = pageOf(params.get('page')) ?? state.page;

  if (state.email != null)
    return (
      <BillingEmail key={name} email={state.email} role={state.role} phone={params.has('phone')} />
    );

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings inert={covered} />
      )}
    >
      {(tell) => (
        <ReadOnlyPage
          key={name}
          name={name}
          start={state.status}
          role={state.role}
          page={page}
          offline={params.has('offline')}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

function ReadOnlyPage({
  name,
  start,
  role,
  page,
  offline: startOffline,
  tell,
}: {
  name: ReadOnlyStateName;
  start: Status;
  role: Role;
  page: Page;
  offline: boolean;
  tell: Tell;
}) {
  const [status, setStatus] = useState(start);
  const [leaving, setLeaving] = useState(false);
  const [offline, setOffline] = useState(startOffline);
  const [open, setOpen] = useState<Page | null>(isRefused(page) && refuses(start) ? page : null);
  const timer = useRef<number | undefined>(undefined);
  const banner = bannerOf(status, role);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pay = () => {
    setOpen(null);
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setLeaving(false);
      setStatus('paid');
      tell(`${RW.paid} ${ORGANISATION} is active again.`);
    }, LEAVES_MS);
  };

  const work = (refused: Refused) => {
    if (refuses(status)) setOpen(refused);
    else tell(`${REFUSALS[refused].verb}: done, as today. Only read-only refuses new work.`);
  };

  return (
    <div className="desk-page">
      <div className="ev-column ro-page">
        {offline && <OfflineBox onRetry={() => setOffline(false)} />}
        {banner != null && (
          <BillingBanner
            words={banner.words}
            update={banner.update}
            leaving={leaving}
            onUpdate={() => tell(HOSTED)}
          />
        )}
        <PageBody
          name={name}
          page={page}
          status={status}
          leaving={leaving}
          tell={tell}
          onWork={work}
        />
        <div className="lr-demo-only">
          <p>
            In the demo only. Status: <strong>{status}</strong>. Role:{' '}
            <strong>
              {role === 'manage'
                ? 'billing.read and billing.manage'
                : role === 'read'
                  ? 'billing.read only'
                  : 'no billing permission'}
            </strong>
            . The provider and the server are stood in for.{' '}
            <Link to="/demo#demo-page-37">All the states</Link>
          </p>
          {owes(status) && (
            <button type="button" className="desk-text" onClick={pay}>
              The payment is made
            </button>
          )}
        </div>
      </div>
      {open === page && isRefused(page) && (
        <ReadOnlyRefusal
          refused={page}
          role={role}
          onUpdate={() => tell(HOSTED)}
          onBack={() => {
            setOpen(null);
            tell(`${REFUSALS[page].back}: the work is as it was.`);
          }}
        />
      )}
    </div>
  );
}

/** The shell's banner above the page's title: the sign-in rules' attention box, the AC's sentence, and the white step for billing.manage. */
function BillingBanner({
  words,
  update,
  leaving,
  onUpdate,
}: {
  words: string;
  update: boolean;
  leaving: boolean;
  onUpdate: () => void;
}) {
  return (
    <div
      className={
        leaving ? 'rn-box is-attention ro-banner is-leaving' : 'rn-box is-attention ro-banner'
      }
      role="status"
    >
      <span className="rn-mark" aria-hidden="true" />
      <div className="rn-main ro-banner-main">
        <p className="ro-banner-words">{words}</p>
        {update && (
          <button type="button" className="desk-step" onClick={onUpdate}>
            {RW.update}
          </button>
        )}
      </div>
    </div>
  );
}

function Running({ leaving }: { leaving: boolean }) {
  return (
    <span className={leaving ? 'desk-tag ro-running is-leaving' : 'desk-tag ro-running'}>
      <Glyph name="shield" size={13} weight={2.4} />
      {RW.running}
    </span>
  );
}

const ROWS = [
  {
    name: 'Ama & Kofi’s wedding',
    line: 'Saturday, Dec 12 · Eko Hotel, Lagos',
    phase: 'live',
    kind: 'yes',
    word: 'Live',
    opens: 'eventView',
  },
  {
    name: 'Adébáyọ̀’s 60th birthday',
    line: 'Today · 18:00 to 23:00 · Ikoyi Club, Lagos',
    phase: 'happeningNow',
    kind: 'now',
    word: 'Happening now',
    opens: 'eventView',
  },
  {
    name: 'Q4 partner summit',
    line: 'Friday, Dec 4 · Lagos',
    phase: 'draft',
    kind: 'waiting',
    word: 'Draft',
    opens: 'makeLive',
  },
] as const;

function PageBody({
  name,
  page,
  status,
  leaving,
  tell,
  onWork,
}: {
  name: ReadOnlyStateName;
  page: Page;
  status: Status;
  leaving: boolean;
  tell: Tell;
  onWork: (refused: Refused) => void;
}) {
  const running = runsNormally(status, 'live');

  if (page === 'events')
    return (
      <div>
        <TitleRow title="Events" />
        <ul className="desk-rows ro-rows">
          {ROWS.map((row) => (
            <li key={row.name}>
              <Link
                className="desk-row ev-row"
                to={`/demo/read-only?state=${name}&page=${row.opens}`}
              >
                <span className="ro-thumb" aria-hidden="true" />
                <RowWords
                  title={row.name}
                  tag={
                    <>
                      <Tag kind={row.kind} word={row.word} />
                      {runsNormally(status, row.phase) && <Running leaving={leaving} />}
                    </>
                  }
                  lines={[row.line]}
                />
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );

  if (page === 'eventView' || page === 'guests')
    return (
      <div className="ro-body">
        <TitleRow title={page === 'guests' ? 'Guests' : 'Ama & Kofi’s wedding'} />
        <p className="ro-tags">
          <Tag kind="yes" word="Live" />
          {running && <Running leaving={leaving} />}
        </p>
        <p className="desk-line">
          {page === 'guests'
            ? 'Ama & Kofi’s wedding · Saturday, Dec 12'
            : 'Saturday, Dec 12 · Eko Hotel, Lagos'}
        </p>
        <div className="ro-actions">
          {(page === 'guests' ? ['Add guest', 'Import'] : ['Send a message']).map((verb) => (
            <button
              key={verb}
              type="button"
              className="button"
              onClick={() => tell(`${verb}: works as before. A live event is never refused.`)}
            >
              <span className="button-label">{verb}</span>
            </button>
          ))}
        </div>
      </div>
    );

  const refusal = REFUSALS[page];

  return (
    <div className="ro-body">
      <TitleRow title={refusal.on} />
      <p className="desk-line">
        {page === 'invite'
          ? `Settings · Members · ${ORGANISATION}`
          : page === 'createEvent'
            ? 'The New event form, filled in'
            : 'Q4 partner summit · Friday, Dec 4 · Draft'}
      </p>
      <p className="desk-line">The page the work is made on, as a shell.</p>
      <div className="ro-actions">
        <button type="button" className="button button-primary" onClick={() => onWork(page)}>
          <span className="button-label">{refusal.verb}</span>
        </button>
      </div>
    </div>
  );
}

/** sc-3930's parts in its order: what happened, what is safe, the way past, and the one way back. */
export function ReadOnlyRefusal({
  refused,
  role,
  onUpdate,
  onBack,
}: {
  refused: Refused;
  role: Role;
  onUpdate: () => void;
  onBack: () => void;
}) {
  const refusal = REFUSALS[refused];

  return (
    <Dialog
      title={RW.title(ORGANISATION)}
      verb={null}
      cancel={false}
      onDismiss={onBack}
      onConfirm={onBack}
    >
      <div className="lr lr-hard-limit">
        <p className="lr-safe">
          <Glyph name="shield" size={16} weight={2.2} />
          {refusal.safe}
        </p>
        {wayPastOf(role, 'web') === 'pay' ? (
          <div className="lr-plan">
            <button type="button" className="button button-primary" onClick={onUpdate}>
              <span className="button-label">{RW.update}</span>
            </button>
          </div>
        ) : (
          <p className="desk-line is-ink">{RW.ask}</p>
        )}
        <div className="lr-back">
          <button type="button" className="button" onClick={onBack}>
            <span className="button-label">{refusal.back}</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function BillingEmail({ email, role, phone }: { email: Email; role: Role; phone: boolean }) {
  const mail = mailOf(email, role);
  const [told, setTold] = useState(false);

  return (
    <div className="uw-mail-page">
      {mail != null && (
        <div className={phone ? 'uw-mail uw-mail-phone' : 'uw-mail'}>
          <div className="uw-mail-top">
            <p className="uw-mail-subject">{mail.subject}</p>
            <p className="demo-muted">
              From [Soirely] · To {role === 'read' ? 'Tunde Bello' : 'Folake Adeyemi'}
            </p>
          </div>
          <article className="uw-mail-body" aria-label={mail.subject}>
            <h1>{ORGANISATION}</h1>
            {mail.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {mail.update && (
              <a
                className="uw-mail-button"
                href="/demo/read-only"
                onClick={(click) => {
                  click.preventDefault();
                  setTold(true);
                }}
              >
                {RW.update}
              </a>
            )}
            <p className="demo-muted">[Footer, as on sc-5937’s email]</p>
          </article>
        </div>
      )}
      <div className="uw-demo-only">
        <p>
          The demo only. Each email goes once, to people with billing.read: past due, read-only and
          paid. Its body is its banner’s words.
        </p>
        <p role="status">{told ? HOSTED : ''}</p>
        <Link className="desk-text" to="/demo#demo-page-37">
          All the states
        </Link>
      </div>
    </div>
  );
}
