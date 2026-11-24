import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type BellRow, BellMute, BellPanel } from '../components/BellPanel.tsx';
import { Bell, type Tell, TitleRow } from '../components/SettingsParts.tsx';
import { EventsShell } from './EventParts.tsx';
import { SIDEBAR_EVENTS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import {
  ARRIVAL,
  EVENT_SAMPLE,
  type FeedItem,
  type Lang,
  NAMED,
  OTHER,
  USAGE_PLACE,
  type UsageState,
  WARNINGS,
  WARNING_KEYS,
  type WarningKey,
  arrivedSaid,
  feedOf,
  langOf,
  said,
  usageStateOf,
  warningKeyOf,
} from './usageWarning.ts';
import './usageWarning.css';

/** sc-3931: the 80% and 100% usage warning as a bell item in the B frame's popover (sc-83081), and as its email. */
export function UsageWarning() {
  const [params] = useSearchParams();
  const state = usageStateOf(params.get('state'));
  const lang = langOf(state, params.get('lang'));

  if (state === 'email' || state === 'emailPhone')
    return (
      <UsageEmail
        phone={state === 'emailPhone'}
        lang={lang}
        shown={warningKeyOf(params.get('warning'))}
      />
    );

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings inert={covered} />
      )}
    >
      {(tell) => <UsagePage key={`${state}:${lang}`} state={state} lang={lang} tell={tell} />}
    </EventsShell>
  );
}

function UsagePage({ state, lang, tell }: { state: UsageState; lang: Lang; tell: Tell }) {
  const [current, setCurrent] = useState(state === 'other' ? OTHER : NAMED);
  const [switched, setSwitched] = useState('');

  return (
    <div className="desk-page">
      <div className="desk-column uw">
        <TitleRow
          title="Events"
          bell={
            <UsageBell
              state={state}
              lang={lang}
              onUsage={(organisation) => {
                if (organisation !== current) {
                  setCurrent(organisation);
                  setSwitched(`Now working in ${organisation}.`);
                }
                tell(
                  `Plan and billing opens at Usage this period for ${organisation}: ${USAGE_PLACE}`,
                );
              }}
              onEvent={() => tell('The event item opens its event, as on main.')}
            />
          }
        />
        <p className="uw-said" role="status" aria-live="polite">
          {switched}
        </p>
        <div className="uw-demo-only">
          <p>
            Tweak, in the demo only. Current organisation: <strong>{current}</strong>. The warnings
            name {NAMED}; opening one from another organisation switches to {NAMED} first, with
            nothing new drawn for the switch.
          </p>
          {[NAMED, OTHER].map((organisation) => (
            <button
              key={organisation}
              type="button"
              className="desk-text"
              aria-pressed={current === organisation}
              onClick={() => {
                setCurrent(organisation);
                setSwitched('');
              }}
            >
              {organisation}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageBell({
  state,
  lang,
  onUsage,
  onEvent,
}: {
  state: UsageState;
  lang: Lang;
  onUsage: (organisation: string) => void;
  onEvent: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<readonly FeedItem[]>(() => feedOf(state));
  const [arrived, setArrived] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const unread = items.filter((item) => !item.read).length;
  const playedAlready = items.some((item) => item.id === ARRIVAL.id);

  useEffect(() => {
    if (!open) return undefined;
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target) || button.current?.contains(target)) return;
      if ((target as Element).closest?.('.uw-demo-only') != null) return;
      setOpen(false);
    };
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  const rows: BellRow[] = items.map((item) => {
    if (item.warning == null)
      return {
        id: item.id,
        category: item.category,
        title: EVENT_SAMPLE.title,
        lines: EVENT_SAMPLE.lines,
        where: `${EVENT_SAMPLE.event} · ${item.when}`,
        unread: !item.read,
        muted: false,
        more: {
          label: `More for ${EVENT_SAMPLE.title}, ${EVENT_SAMPLE.event}`,
          mute: <BellMute on={muted} onChange={setMuted} />,
        },
        goneShown: false,
      };
    const words = said(item.warning, lang);

    return {
      id: item.id,
      category: item.category,
      title: words.heading,
      lines: words.lines,
      where: item.when,
      unread: !item.read,
      muted: false,
      more: null,
      goneShown: false,
    };
  });

  function play(): void {
    setItems((now) => [ARRIVAL, ...now]);
    setArrived(arrivedSaid(said(ARRIVAL.warning ?? WARNINGS.drafts100, lang).heading));
  }

  return (
    <div className="uw-bell-at">
      <Bell ref={button} unread={unread} expanded={open} onOpen={() => setOpen((now) => !now)} />
      <p className="visually-hidden" role="status" aria-live="polite">
        {arrived}
      </p>
      {open && (
        <div ref={box}>
          <BellPanel
            titleId={titleId}
            heading={heading}
            refreshing={false}
            unread={unread}
            onReadAll={() => setItems((now) => now.map((item) => ({ ...item, read: true })))}
            band={null}
            notice={null}
            ask={null}
            feed="loaded"
            rows={rows}
            onPick={(row) => {
              const item = items.find((one) => one.id === row.id);
              if (item == null) return;
              setItems((now) =>
                now.map((one) => (one.id === item.id ? { ...one, read: true } : one)),
              );
              setOpen(false);
              button.current?.focus();
              if (item.warning == null) onEvent();
              else onUsage(item.warning.organisation);
            }}
            onTryAgain={() => undefined}
            more={null}
            menu={menu}
            onMenu={setMenu}
            settings={
              <Link className="desk-text bell-settings" to="/demo/settings/notifications">
                Notification settings
              </Link>
            }
          />
        </div>
      )}
      {state === 'live' && (
        <div className="uw-demo-only uw-play">
          <p>
            Stand-in for the server, in the demo only. The arrival joins the top, the badge counts
            up and the polite region says it; focus and scroll stay where they are.
          </p>
          <button type="button" className="desk-text" disabled={playedAlready} onClick={play}>
            Play the arrival
          </button>
        </div>
      )}
    </div>
  );
}

/** The warning's email at a mail client's width: the item at mail width, its subject the heading, then one pill to the same place as the web's bell item. */
function UsageEmail({ phone, lang, shown }: { phone: boolean; lang: Lang; shown: WarningKey }) {
  const words = said(WARNINGS[shown], lang);
  const here = (warning: WarningKey) =>
    `/demo/usage-warning?state=${phone ? 'emailPhone' : 'email'}&warning=${warning}${lang === 'en' ? '' : `&lang=${lang}`}`;

  return (
    <div className="uw-mail-page">
      <div className={phone ? 'uw-mail uw-mail-phone' : 'uw-mail'}>
        <div className="uw-mail-top">
          <p className="uw-mail-subject">{words.heading}</p>
          <p className="demo-muted">From [Soirely] · To Folake Adeyemi</p>
        </div>
        <article className="uw-mail-body" aria-label={words.heading}>
          <h1>{words.heading}</h1>
          {words.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Link className="uw-mail-button" to={`/demo${USAGE_PLACE}`}>
            {words.link}
          </Link>
          <p className="demo-muted">[Footer, as on sc-5937’s email]</p>
        </article>
      </div>
      <div className="uw-demo-only">
        <p>
          The demo only. {phone ? 'Phone' : 'Desktop'} mail width
          {lang === 'en' ? '' : `, ${lang === 'fr' ? 'French' : 'Portuguese'} stand-in`}. No preview
          text is set: a mail client shows the start of the body.
        </p>
        {WARNING_KEYS.map((warning) => (
          <Link
            key={warning}
            className="desk-text"
            aria-current={warning === shown ? 'page' : undefined}
            to={here(warning)}
          >
            {WARNINGS[warning].kind === 'drafts' ? 'Assistant drafts' : 'Storage'},{' '}
            {WARNINGS[warning].at}%
          </Link>
        ))}
        <Link className="desk-text" to="/demo">
          All states in the demo
        </Link>
      </div>
    </div>
  );
}
