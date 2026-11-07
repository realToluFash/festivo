import { DemoBell } from './DemoBell.tsx';
import { formattingLocale } from '@soirely/domain';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { offButton } from '../offButton.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import {
  ASK_WORDS as A,
  type AskKind,
  CODES_MADE,
  type Device,
  type DialogStart,
  NEW_CODES,
  PROOF_MINUTES,
  PROVIDERS,
  type Provider,
  RECOVERY_CODES,
  RESULT_WORDS as R,
  type Purpose,
  SECURITY_WORDS as W,
  type SecurityPage,
  cardOf,
  dayAtTime,
  dayOf,
  deviceLine,
  devicesOf,
  keptByRule,
  linkedProviders,
  onlyWayIn,
  opening,
  otherProvider,
  othersOf,
  proveAsks,
  securityStart,
  stillLine,
  yourSecurity,
} from './security.ts';
import {
  ChangeDialog,
  ChooseDialog,
  ForgotDialog,
  ProveDialog,
  RecoveryDialog,
  SentDialog,
  SetCodeDialog,
  SetupDialog,
} from './SecurityDialogs.tsx';
import type { Viewer } from './settings.ts';
import {
  Ask,
  Card,
  CardStep,
  Chevron,
  Head,
  OnCard,
  RedAction,
  RowWords,
  Says,
  TitleRow,
} from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { useLater } from '../useLater.ts';
import './account.css';
import './security.css';

/** Security at a desk in B · Summary first (Web-Security-*.dc.html): the app's page, the same for every role. */
export function Security({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const navigate = useNavigate();
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const you = yourSecurity(viewer);
  const [start] = useState(() => securityStart(state, viewer));
  const [page, setPage] = useState(start.page);
  const [said, setSaid] = useState(start.said);
  const [open, setOpen] = useState(start.open);
  const [ask, setAsk] = useState<AskKind | null>(start.ask);
  const [dialog, setDialog] = useState<DialogStart | null>(start.dialog);
  const [proved, setProved] = useState(false);
  const later = useLater();
  const column = useRef<HTMLDivElement>(null);
  const card = cardOf(page, said);
  const devices = devicesOf(page);
  const others = othersOf(page);
  const openProvider = PROVIDERS.find((provider) => provider === open) ?? null;
  const openDevice = devices.find((device) => device.id === open) ?? null;

  function done(words: string, next: Partial<SecurityPage> = {}): void {
    setPage((now) => ({ ...now, ...next }));
    setDialog(null);
    setAsk(null);
    setOpen(null);
    setSaid(words);
  }

  function prove(purpose: Purpose, provider: Provider | null = null): void {
    setAsk(null);
    if (proved && (purpose === 'link' || purpose === 'unlink')) return provedFor(purpose, provider);
    setDialog(opening('prove', { purpose, provider }));
  }

  function provedFor(purpose: Purpose, provider: Provider | null): void {
    if (purpose === 'link' || purpose === 'unlink') {
      setProved(true);
      later(PROOF_MINUTES * 60_000, () => setProved(false));
    }
    if (purpose === 'link' && provider != null)
      done(R.linked(provider), { ways: { ...page.ways, [provider]: true } });
    else if (purpose === 'unlink' && provider != null)
      done(R.unlinked(provider), { ways: { ...page.ways, [provider]: false } });
    else if (purpose === 'everywhere') done(R.everywhere(others), { devices: here(page) });
    else if (purpose === 'turnOff') done(R.off(you.email), { on: false });
    else setDialog(opening('recovery', { purpose: 'newCodes' }));
  }

  function signOut(device: Device): void {
    if (device.here) {
      void navigate('/demo/sign-in');
      return;
    }
    done(R.device(device.name), { devices: page.devices.filter((id) => id !== device.id) });
  }

  useEffect(() => {
    if (start.open == null) return;
    const opened = column.current?.querySelector('.account-open');
    if (opened != null && 'scrollIntoView' in opened) opened.scrollIntoView({ block: 'center' });
  }, [start.open]);

  const toggle = (key: string) => setOpen((now) => (now === key ? null : key));

  return (
    <div className="desk-page">
      <div ref={column} className="desk-column">
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        <Card size="person">
          <div>
            <div className="desk-who">
              <span className="desk-disc security-shield" aria-hidden="true">
                <Glyph name="shield" size={29} weight={2.2} />
              </span>
              <div className="desk-who-words">
                <Says>{card.says}</Says>
                <OnCard>{card.summary}</OnCard>
              </div>
            </div>
            <div aria-live="polite">
              {card.line != null && (
                <p className={card.done ? 'account-said is-done' : 'account-said'}>
                  {card.done && (
                    <span className="desk-mark is-yes account-done" aria-hidden="true">
                      <Glyph name="tick" size={11} weight={3.4} />
                    </span>
                  )}
                  {card.line}
                </p>
              )}
            </div>
          </div>
          {card.step != null && (
            <CardStep label={card.step} onClick={() => setDialog(opening('setup'))} />
          )}
        </Card>
        <section className="desk-block">
          <Head title={W.ways} />
          <ul className="desk-rows account-rows">
            <li>
              <button
                type="button"
                className="desk-row account-row"
                onClick={() => setDialog(opening(page.ways.password ? 'change' : 'setCode'))}
              >
                <Lead name="keyRound" />
                <RowWords
                  title={W.password}
                  lines={[page.ways.password ? W.passwordSet : W.passwordNone]}
                />
                <Chevron />
              </button>
            </li>
            {PROVIDERS.map((provider) => {
              const line = page.ways[provider] ? W.linked(you.address[provider]) : W.notLinked;

              if (onlyWayIn(page.ways, provider))
                return (
                  <li key={provider} className="desk-row">
                    <Lead name="link" />
                    <RowWords title={provider} lines={[line]} />
                  </li>
                );

              return (
                <Openable
                  key={provider}
                  title={provider}
                  line={line}
                  lead="link"
                  on={open === provider}
                  onToggle={() => toggle(provider)}
                >
                  <WayInside
                    page={page}
                    provider={provider}
                    email={you.email}
                    onLink={() => prove('link', provider)}
                    onUnlink={() => setAsk('unlink')}
                  />
                </Openable>
              );
            })}
          </ul>
          {PROVIDERS.filter((provider) => onlyWayIn(page.ways, provider)).map((provider) => (
            <p key={provider} className="desk-foot">
              {W.last(provider)}
            </p>
          ))}
        </section>
        <section className="desk-block">
          <Head title={W.twoFactor} />
          {page.on ? (
            <ul className="desk-rows account-rows">
              <Openable
                title={W.authenticator}
                line={W.onLine}
                lead="shield"
                on={open === 'auth'}
                onToggle={() => toggle('auth')}
              >
                <div className="account-acts">
                  {page.twoFactorRule ? (
                    <Off label={W.turnOffKept} />
                  ) : (
                    <button
                      type="button"
                      className="desk-text is-red"
                      onClick={() => setAsk('turnOff')}
                    >
                      {W.turnOffAsking}
                    </button>
                  )}
                </div>
                <p className="desk-note">
                  {page.twoFactorRule ? W.keptTwoFactor : W.turnOffLine(you.email)}
                </p>
              </Openable>
              <Openable
                title={W.recoveryCodes}
                line={W.codesLine(page.unused)}
                lead="lock"
                on={open === 'codes'}
                onToggle={() => toggle('codes')}
              >
                <div className="account-acts">
                  <button type="button" className="desk-text" onClick={() => setAsk('newCodes')}>
                    {W.newCodes}
                  </button>
                </div>
                <p className="desk-note">{W.newCodesLine}</p>
              </Openable>
            </ul>
          ) : (
            <>
              <ul className="desk-rows account-rows">
                <li>
                  <button
                    type="button"
                    className="desk-row account-row"
                    onClick={() => setDialog(opening('setup'))}
                  >
                    <Lead name="shield" />
                    <RowWords title={W.authenticator} lines={[W.offRow]} />
                    <Chevron />
                  </button>
                </li>
              </ul>
              <p className="desk-foot">{W.offFoot}</p>
            </>
          )}
        </section>
        <section className="desk-block">
          <Head title={W.devices} />
          <ul className="desk-rows account-rows">
            {devices.map((device) => (
              <Openable
                key={device.id}
                title={device.name}
                line={deviceLine(device, locale)}
                lead={device.kind}
                on={open === device.id}
                onToggle={() => toggle(device.id)}
              >
                <p className="security-meta">
                  {W.signedFrom(dayAtTime(device.signedIn, locale), device.ip)}
                </p>
                <p className="security-meta">{W.expires(dayOf(device.expires, locale))}</p>
                <div className="account-acts">
                  {device.here ? (
                    <button type="button" className="desk-text" onClick={() => signOut(device)}>
                      <Glyph name="signOut" size={17} weight={2.3} />
                      {W.signOut}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="desk-text is-red"
                      onClick={() => setAsk('signOut')}
                    >
                      {W.signOutAsking}
                    </button>
                  )}
                </div>
                <p className="desk-note">{device.here ? W.hereOut : W.signInAgain}</p>
              </Openable>
            ))}
          </ul>
          <p className="desk-foot">{W.devicesFoot}</p>
        </section>
        {others > 0 && (
          <RedAction
            label={W.everywhere}
            line={W.everywhereHint}
            onClick={() => setAsk('everywhere')}
          />
        )}
      </div>
      {ask === 'unlink' && openProvider != null && (
        <Ask
          title={A.unlinkTitle(openProvider)}
          line={A.unlinkLine(
            openProvider,
            you.address[openProvider],
            stillLine(page.ways, openProvider),
          )}
          keep={A.keepLinked}
          go={A.unlinkGo(openProvider)}
          onKeep={() => setAsk(null)}
          onGo={() => prove('unlink', openProvider)}
        />
      )}
      {ask === 'turnOff' && (
        <Ask
          title={A.turnOffTitle}
          line={W.turnOffLine(you.email)}
          keep={A.keepOn}
          go={A.turnOffGo}
          onKeep={() => setAsk(null)}
          onGo={() => prove('turnOff')}
        />
      )}
      {ask === 'newCodes' && (
        <Ask
          title={A.newCodesTitle}
          line={W.newCodesLine}
          keep={A.keepCodes}
          go={W.newCodes}
          red={false}
          onKeep={() => setAsk(null)}
          onGo={() => prove('newCodes')}
        />
      )}
      {ask === 'signOut' && openDevice != null && (
        <Ask
          title={A.signOutTitle(openDevice.name)}
          line={A.signOutLine}
          keep={A.keepSignedIn}
          go={A.signOutGo}
          onKeep={() => setAsk(null)}
          onGo={() => signOut(openDevice)}
        />
      )}
      {ask === 'everywhere' && (
        <Ask
          title={A.everywhereTitle}
          line={A.everywhereLine(others)}
          keep={A.keepThem(others)}
          go={A.everywhereGo(others)}
          onKeep={() => setAsk(null)}
          onGo={() => prove('everywhere')}
        />
      )}
      {dialog?.kind === 'change' && (
        <ChangeDialog
          start={dialog}
          email={you.email}
          onClose={() => setDialog(null)}
          onForgot={() => setDialog(opening('forgot', { typed: you.email }))}
          onChanged={() => done(R.changed(others), { devices: here(page) })}
        />
      )}
      {dialog?.kind === 'forgot' && (
        <ForgotDialog
          start={dialog}
          onClose={() => setDialog(null)}
          onSent={() => setDialog(opening('sent'))}
        />
      )}
      {dialog?.kind === 'sent' && (
        <SentDialog
          onDone={() => setDialog(null)}
          onAgain={() => setDialog(opening('forgot', { typed: you.email }))}
        />
      )}
      {dialog?.kind === 'setCode' && (
        <SetCodeDialog
          start={dialog}
          email={you.email}
          onClose={() => setDialog(null)}
          onMatched={() => setDialog(opening('choose'))}
        />
      )}
      {dialog?.kind === 'choose' && (
        <ChooseDialog
          start={dialog}
          email={you.email}
          onClose={() => setDialog(null)}
          onAdded={() =>
            done(R.added(linkedProviders(page.ways)[0] ?? 'Google'), {
              ways: { ...page.ways, password: true },
            })
          }
        />
      )}
      {dialog?.kind === 'prove' && dialog.purpose != null && (
        <ProveDialog
          start={dialog}
          purpose={dialog.purpose}
          asks={proveAsks(dialog.purpose, dialog.provider, page, you.email)}
          onClose={() => setDialog(null)}
          onProved={() => dialog.purpose != null && provedFor(dialog.purpose, dialog.provider)}
        />
      )}
      {dialog?.kind === 'setup' && (
        <SetupDialog
          start={dialog}
          onClose={() => setDialog(null)}
          onOn={() => {
            setPage((now) => ({ ...now, on: true, unused: CODES_MADE }));
            setDialog(opening('recovery'));
          }}
        />
      )}
      {dialog?.kind === 'recovery' && (
        <RecoveryDialog
          start={dialog}
          codes={dialog.purpose === 'newCodes' ? NEW_CODES : RECOVERY_CODES}
          onFinish={() =>
            done(dialog.purpose === 'newCodes' ? R.newCodes : R.on, { unused: CODES_MADE })
          }
        />
      )}
    </div>
  );
}

function here(page: SecurityPage): string[] {
  return devicesOf(page)
    .filter((device) => device.here)
    .map((device) => device.id);
}

function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="account-lead" aria-hidden="true">
      <Glyph name={name} size={22} />
    </span>
  );
}

function Off({ label }: { label: string }) {
  return (
    <button type="button" className="desk-text security-off" {...offButton(true, { dim: false })}>
      {label}
    </button>
  );
}

/** A row that opens in place, lit with no ring, what it holds under a Violet rule. */
function Openable({
  title,
  line,
  lead,
  on,
  onToggle,
  children,
}: {
  title: string;
  line: string;
  lead: GlyphName;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <li>
      <button
        type="button"
        className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={on}
        aria-controls={on ? id : undefined}
        onClick={onToggle}
      >
        <Lead name={lead} />
        <RowWords title={title} lines={[line]} />
        <Glyph name={on ? 'chevup' : 'chevdown'} size={18} weight={2.4} className="desk-chevron" />
      </button>
      {on && (
        <div id={id} className="account-open" role="group" aria-label={title}>
          {children}
        </div>
      )}
    </li>
  );
}

function WayInside({
  page,
  provider,
  email,
  onLink,
  onUnlink,
}: {
  page: SecurityPage;
  provider: Provider;
  email: string;
  onLink: () => void;
  onUnlink: () => void;
}) {
  if (!page.ways[provider])
    return (
      <>
        <div className="account-acts">
          <button type="button" className="desk-text" onClick={onLink}>
            {W.link(provider)}
          </button>
        </div>
        <p className="desk-note">{W.linkNote(provider, email)}</p>
      </>
    );

  if (keptByRule(page, provider))
    return (
      <>
        <div className="account-acts">
          <Off label={W.unlinkKept} />
        </div>
        <p className="desk-note">{W.keptWay(provider, otherProvider(provider))}</p>
      </>
    );

  return (
    <>
      <div className="account-acts">
        <button type="button" className="desk-text is-red" onClick={onUnlink}>
          {W.unlinkAsking}
        </button>
      </div>
      <p className="desk-note">{W.unlinkLine(provider, stillLine(page.ways, provider))}</p>
    </>
  );
}
