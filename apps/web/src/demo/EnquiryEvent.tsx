import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';

import { Broken, Quiet } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Mark, type Tell } from '../components/SettingsParts.tsx';
import { usePhoneWidth } from '../phoneWidth.ts';
import { ENQUIRY_WORDS } from './enquiries.ts';
import {
  ENQUIRY_EVENT_WORDS as W,
  type EnquiryEventState,
  MADE_FROM,
  filledFrom,
  filledStateFor,
  sourceOf,
} from './enquiryToEvent.ts';
import { CURRENCY_CHOICES } from './events.ts';
import { ORG_DEFAULTS } from './newEvent.ts';
import './enquiryEvent.css';

type Status = 'open' | 'won' | 'lost';

function StatusLine({ status }: { status: Status }) {
  return (
    <p className="enq-status">
      {status === 'open' ? (
        <span className="desk-mark enq-mark-open" aria-hidden="true" />
      ) : (
        <Mark kind={status === 'won' ? 'yes' : 'ended'} />
      )}
      {W[status]}
    </p>
  );
}

/** What the page shows: a stale page shows the enquiry as it was when the tab opened. */
function statusOf(state: EnquiryEventState, stale: boolean): Status {
  if (state === 'won') return 'won';
  if (state === 'won-has-event') return stale ? 'lost' : 'won';
  if (state === 'lost-has-event') return stale ? 'open' : 'won';
  if (state === 'not-open') return 'lost';

  return 'open';
}

/** An enquiry's page with sc-31232's parts: Create event in the head, or what it became once Won. The rest is sc-31226's. */
export function EnquiryEvent({ state }: { state: EnquiryEventState }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tell } = useOutletContext<{ tell: Tell }>();
  const phone = usePhoneWidth();
  const source = sourceOf(id);
  const [stale, setStale] = useState(false);
  const [moved, setMoved] = useState<'stale' | 'title' | null>(
    state === 'not-open' ? 'title' : null,
  );
  const title = useRef<HTMLHeadingElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const status = statusOf(state, stale);
  const refused = stale
    ? null
    : state === 'won-has-event'
      ? W.notReopened
      : state === 'lost-has-event'
        ? W.notClosed
        : state === 'not-open'
          ? W.notOpen
          : null;
  const made = filledFrom(
    source,
    CURRENCY_CHOICES.map(([code]) => code),
    ORG_DEFAULTS,
  ).name;

  useEffect(() => {
    if (moved === 'stale') (reopen.current ?? closer.current)?.focus();
    if (moved === 'title') title.current?.focus();
  }, [moved]);

  const create =
    status !== 'open' ? null : state === 'open-member' ? (
      <p className="desk-note enq-member-line">
        <Glyph name="info" size={17} weight={2.2} />
        {W.memberLine}
      </p>
    ) : (
      <Link
        className="button button-primary enq-create"
        to={`/demo/events/new?from=enquiry&state=${filledStateFor(source)}`}
      >
        {W.createEvent}
      </Link>
    );
  const close =
    status !== 'open' ? null : (
      <button
        ref={closer}
        type="button"
        className="button enq-close"
        onClick={() => {
          if (state !== 'lost-has-event') return tell(ENQUIRY_WORDS.ownDesign(W.closeAsLost));
          setStale(false);
          setMoved('title');
        }}
      >
        {W.closeAsLost}
      </button>
    );

  return (
    <div className="desk-page">
      <div className={phone ? 'ev-column enq-made is-phone' : 'ev-column enq-made'}>
        <div className="desk-top">
          <button
            type="button"
            className="desk-back"
            onClick={() =>
              location.key === 'default' ? void navigate('/demo/enquiries') : void navigate(-1)
            }
          >
            <Glyph name="back" size={17} weight={2.4} />
            {ENQUIRY_WORDS.enquiries}
          </button>
        </div>
        <div className="enq-made-head">
          <div className="enq-made-words">
            <h1 ref={title} className="desk-title enq-made-title" tabIndex={-1}>
              {source.client}
            </h1>
            <StatusLine status={status} />
          </div>
          {!phone && status === 'open' && (
            <div className="enq-made-actions">
              {close}
              {create}
            </div>
          )}
        </div>
        {phone && create}
        {refused != null && <Broken>{refused}</Broken>}
        {state === 'event-deleted' && <Quiet>{W.eventDeleted}</Quiet>}
        {status === 'won' && (
          <section className="enq-made-card" aria-labelledby="enq-made-won">
            <h2 id="enq-made-won">{W.won}</h2>
            <Link
              className="desk-text enq-became"
              to={`/demo/events/${MADE_FROM}?state=from-enquiry`}
            >
              {W.became(made)}
              <Glyph name="chevron" size={16} weight={2.4} />
            </Link>
          </section>
        )}
        {status === 'lost' && (
          <section className="enq-made-card" aria-labelledby="enq-made-lost">
            <h2 id="enq-made-lost">{W.lostBudget}</h2>
            <button
              ref={reopen}
              type="button"
              className="button enq-made-reopen"
              onClick={() => {
                if (state !== 'won-has-event') return tell(ENQUIRY_WORDS.ownDesign(W.reopen));
                setStale(false);
                setMoved('title');
              }}
            >
              {W.reopen}
            </button>
          </section>
        )}
        <p className="enq-made-demo">{W.restElsewhere}</p>
        {(state === 'won-has-event' || state === 'lost-has-event') && !stale && (
          <div className="enq-made-demo">
            <button
              type="button"
              className="button"
              onClick={() => {
                setStale(true);
                setMoved('stale');
              }}
            >
              {state === 'won-has-event' ? W.pressReopen : W.pressClose}
            </button>
          </div>
        )}
        {phone && close}
      </div>
    </div>
  );
}
