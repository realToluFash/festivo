import {
  ApiError,
  MESSAGE_CHANNELS,
  type MessageChannel,
  type YourMessages as Standing,
  type YourMessagesKey,
} from '@soirely/api-client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useOutletContext } from 'react-router';

import { api } from '../../api.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { Filled, Notice, TextAction } from './GuestParts.tsx';
import { GuestShell } from './GuestLayout.tsx';
import { BadLink } from './InvalidInvitation.tsx';
import './yourMessages.css';

/** What a press sends: the lead button's Email off, Undo's Email on, or one switch. */
type Press = 'stop' | 'undo' | MessageChannel;
type Lead = 'button' | 'stopped' | 'undone' | null;
type From = 'email' | 'page';

interface Change {
  press: Press;
  channel: MessageChannel;
  on: boolean;
}

/** /your-messages#token (sc-3969): the page an email's link opens, signed out. Opening it changes nothing; the token leaves the page only in a request's body. */
export function YourMessagesFromEmail() {
  const { hash } = useLocation();
  const token = hash.replace(/^#/, '');

  return (
    <GuestShell token={null}>
      <YourMessagesPage key={token} entry={{ token }} from="email" />
    </GuestShell>
  );
}

/** /i/:token/messages: the same page from the guest's page, its switches alone, Back to the page as it was. */
export function YourMessagesFromPage() {
  const guestToken = useOutletContext<string>();

  return <YourMessagesPage key={guestToken} entry={{ guestToken }} from="page" />;
}

function hasToken(entry: YourMessagesKey): boolean {
  return 'token' in entry ? entry.token !== '' : entry.guestToken !== '';
}

function YourMessagesPage({ entry, from }: { entry: YourMessagesKey; from: From }) {
  const { t } = useTranslation();
  const [standing, setStanding] = useState<Standing | 'broken' | null>(
    hasToken(entry) ? null : 'broken',
  );
  const [lead, setLead] = useState<Lead>(null);
  const [busy, setBusy] = useState<Change | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState<Change | null>(null);
  const [saved, setSaved] = useState<MessageChannel | null>(null);
  const [focusOn, setFocusOn] = useState<{ on: string } | null>(null);
  const entered = useRef(entry);

  useEffect(() => {
    if (!hasToken(entered.current)) return;
    let current = true;

    api.yourMessages(entered.current).then(
      (answer) => {
        if (!current) return;
        setStanding(answer);
        const email = answer.channels.email;
        setLead(from === 'email' && email.onRecord && email.on ? 'button' : null);
      },
      (error: unknown) => {
        if (current && error instanceof ApiError && error.status === 404) setStanding('broken');
      },
    );

    return () => {
      current = false;
    };
  }, [from]);

  useLayoutEffect(() => {
    if (focusOn == null) return;
    document.querySelector<HTMLElement>(`.gp-yours [data-focus="${focusOn.on}"]`)?.focus();
  }, [focusOn]);

  if (standing === 'broken')
    return <BadLink title={t('yourMessages.brokenTitle')} body={t('yourMessages.brokenBody')} />;

  const organisation = standing?.organisation ?? '';
  const words = { organisation };

  function send(change: Change, again: boolean): void {
    if (busy != null) return;

    setBusy(change);
    setRetrying(again);
    if (failed?.press !== change.press) setFailed(null);
    api.setYourMessages(entered.current, change.channel, change.on).then(
      (answer) => {
        setStanding(answer);
        setBusy(null);
        setRetrying(false);
        setFailed(null);

        if (change.press === 'stop' || change.press === 'undo') {
          setSaved(null);
          setLead(change.press === 'stop' ? 'stopped' : 'undone');
          setFocusOn({ on: 'yoursLead' });
        } else {
          setSaved(change.channel);
          if (change.channel === 'email') setLead(null);
        }
      },
      () => {
        setBusy(null);
        setRetrying(false);
        setFailed(change);
      },
    );
  }

  function press(pressed: Press): void {
    if (standing == null || standing === 'broken') return;
    if (pressed === 'stop' || pressed === 'undo') {
      send({ press: pressed, channel: 'email', on: pressed === 'undo' }, false);

      return;
    }

    const row = standing.channels[pressed];
    if (!row.onRecord) return;
    send({ press: pressed, channel: pressed, on: !row.on }, false);
  }

  function retry(): void {
    if (failed != null) send(failed, true);
  }

  const leadBusy = busy != null && !retrying && (busy.press === 'stop' || busy.press === 'undo');
  const savedOn = saved != null && standing != null ? standing.channels[saved].on : false;
  const said =
    standing == null
      ? t('yourMessages.loading')
      : leadBusy
        ? t('yourMessages.saving')
        : saved == null
          ? ''
          : t(`yourMessages.${saved}${savedOn ? 'On' : 'Off'}`, words);

  return (
    <div className="gp-alone-wrap gp-yours-wrap">
      <section className="gp-yours" aria-labelledby="gp-yours-h">
        {from === 'page' && (
          <Link className="gp-text is-ink" to="..">
            <Glyph name="back" size={18} weight={2.2} />
            <span>{t('yourMessages.back')}</span>
          </Link>
        )}
        <h1 id="gp-yours-h" className="gp-yours-title" tabIndex={-1}>
          {t('yourMessages.title')}
        </h1>
        {standing == null ? (
          <Shapes />
        ) : (
          <>
            <p className="gp-sub">{t('yourMessages.intro', words)}</p>
            {lead != null && (
              <div className="gp-yours-lead">
                {lead === 'button' ? (
                  <Filled
                    wraps
                    busy={leadBusy && busy.press === 'stop'}
                    focus="stop"
                    onClick={() => press('stop')}
                  >
                    {t('yourMessages.stopEmails', words)}
                  </Filled>
                ) : (
                  <div className="gp-yours-done">
                    <span className="gp-mark is-coming" aria-hidden="true">
                      <Glyph name="tick" size={17} weight={3} />
                    </span>
                    <div className="gp-yours-done-words">
                      <p tabIndex={-1} data-focus="yoursLead">
                        {lead === 'stopped'
                          ? t('yourMessages.stopped', words)
                          : t('yourMessages.emailOn', words)}
                      </p>
                      {lead === 'stopped' && (
                        <TextAction
                          busy={leadBusy && busy.press === 'undo'}
                          focus="undo"
                          onClick={() => press('undo')}
                        >
                          {t('yourMessages.undo')}
                        </TextAction>
                      )}
                    </div>
                  </div>
                )}
                {(failed?.press === 'stop' || failed?.press === 'undo') && (
                  <Notice
                    kind="broken"
                    className="gp-yours-alert"
                    action={
                      <TextAction busy={retrying} focus="yoursRetry" onClick={retry}>
                        {t('yourMessages.tryAgain')}
                      </TextAction>
                    }
                  >
                    {t('yourMessages.failed')}
                  </Notice>
                )}
              </div>
            )}
            <div className="gp-yours-rows" role="group" aria-labelledby="gp-yours-h">
              {MESSAGE_CHANNELS.map((channel) => (
                <Row
                  key={channel}
                  channel={channel}
                  organisation={organisation}
                  onRecord={standing.channels[channel].onRecord}
                  on={standing.channels[channel].on}
                  saving={busy?.press === channel}
                  saved={saved === channel}
                  failed={failed?.press === channel}
                  retrying={retrying && busy?.press === channel}
                  onSwitch={() => press(channel)}
                  onRetry={retry}
                />
              ))}
            </div>
            <p className="gp-small">{t('yourMessages.foot', words)}</p>
          </>
        )}
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {said}
        </p>
      </section>
    </div>
  );
}

function Row({
  channel,
  organisation,
  onRecord,
  on,
  saving,
  saved,
  failed,
  retrying,
  onSwitch,
  onRetry,
}: {
  channel: MessageChannel;
  organisation: string;
  onRecord: boolean;
  on: boolean;
  saving: boolean;
  saved: boolean;
  failed: boolean;
  retrying: boolean;
  onSwitch: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const id = (part: string) => `gp-${channel}-${part}`;
  const describedBy = [saved && id('saved'), failed && id('failed')].filter(Boolean).join(' ');
  const shown = saving ? !on : on;
  const word = saving ? 'saving' : shown ? 'on' : 'off';

  return (
    <div className="gp-yours-row">
      <div className="gp-yours-words">
        <p id={id('name')} className="gp-yours-name">
          {t(`yourMessages.${channel}`)}
        </p>
        {!onRecord && (
          <p className="gp-yours-line">
            <span className="gp-yours-none" aria-hidden="true" />
            <span>
              {channel === 'email'
                ? t('yourMessages.noEmail', { organisation })
                : t('yourMessages.noPhone', { organisation })}
            </span>
          </p>
        )}
        {saved && (
          <p id={id('saved')} className="gp-yours-line is-saved">
            <Glyph name="tick" size={15} weight={3} />
            <span>{t(`yourMessages.${channel}${on ? 'On' : 'Off'}`, { organisation })}</span>
          </p>
        )}
        {failed && (
          <>
            <p id={id('failed')} className="gp-yours-line is-failed" role="alert">
              <RingCross />
              <span>{t('yourMessages.failed')}</span>
            </p>
            <TextAction busy={retrying} focus={`retry-${channel}`} onClick={onRetry}>
              {t('yourMessages.tryAgain')}
            </TextAction>
          </>
        )}
      </div>
      {onRecord && (
        <label className="gp-switch">
          <span className="gp-switch-word" aria-hidden="true">
            {(['on', 'off', 'saving'] as const).map((one) => (
              <span key={one} className={one === word ? 'gp-switch-say is-shown' : 'gp-switch-say'}>
                {t(`yourMessages.${one}`)}
              </span>
            ))}
          </span>
          <span className="gp-switch-track">
            <input
              type="checkbox"
              role="switch"
              className="gp-switch-input"
              checked={shown}
              data-focus={`switch-${channel}`}
              aria-labelledby={id('name')}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              aria-busy={saving || undefined}
              onChange={onSwitch}
            />
            <span
              className={saving ? 'gp-switch-knob is-saving' : 'gp-switch-knob'}
              aria-hidden="true"
            >
              {saving && <span className="gp-spinner" />}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

/** Loading: the title at once; the rest waits, since the intro and the footnote name the organisation the page has not read yet. */
function Shapes() {
  return (
    <>
      <span className="gp-skel gp-yours-skel is-intro" />
      <span className="gp-skel gp-yours-skel is-intro-end" />
      <div className="gp-yours-rows" role="group" aria-labelledby="gp-yours-h" aria-busy="true">
        {MESSAGE_CHANNELS.map((channel) => (
          <div key={channel} className="gp-yours-row is-waiting">
            <span className="gp-skel gp-yours-skel is-name" />
            <span className="gp-skel gp-yours-skel is-switch" />
          </div>
        ))}
      </div>
      <span className="gp-skel gp-yours-skel is-foot" />
      <span className="gp-skel gp-yours-skel is-foot-end" />
    </>
  );
}

function RingCross() {
  return (
    <svg
      className="gp-line"
      strokeWidth={2.2}
      width={15}
      height={15}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={12} cy={12} r={9.5} />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}
