import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { type Provider as ApiProvider } from '@soirely/api-client';
import { formattingLocale } from '@soirely/domain';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Lead } from '../components/AccountParts.tsx';
import { Bones } from '../components/GeneralParts.tsx';
import { KeptAction, Openable, SaidLine, ShieldCard } from '../components/SecurityParts.tsx';
import {
  ASK_WORDS as A,
  type AskKind,
  CODES_MADE,
  FACTOR_LOADING_MS,
  type Device,
  type DialogStart,
  NEW_CODES,
  PROOF_MINUTES,
  PROVIDERS,
  type Provider,
  RECOVERY_CODES,
  SEND_MS,
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
import { ProveDialog } from '../components/AccountDialogs.tsx';
import {
  ChangePasswordDialog,
  ChoosePasswordDialog,
  FactorDialog,
  ForgotDialog,
  RecoveryDialog,
  SentDialog,
  SectionFailed,
  SetCodeDialog,
  SetupDialog,
} from '../components/SecurityDialogs.tsx';
import { afterSending } from './account.ts';
import {
  sampleActivate,
  sampleBegin,
  sampleChange,
  sampleEnrol,
  sampleFactor,
  samplePass,
  sampleSavePassword,
  sampleSecurityProof,
  sampleSend,
} from './securitySamples.ts';
import type { Viewer } from './settings.ts';
import { Ask, Chevron, Head, RedAction, RowWords, TitleRow } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { useLater } from '../useLater.ts';

/** Security at a desk in B · Summary first (Web-Security-*.dc.html): the app's page, the same for every role. */
export function Security({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [loadMs, setLoadMs] = useState(FACTOR_LOADING_MS);
  const [deviceLoad, setDeviceLoad] = useState<'loaded' | 'loading' | 'failed'>(
    state === 'loading' || state === 'failed' ? state : 'loaded',
  );
  const column = useRef<HTMLDivElement>(null);
  const saidLine = useRef<HTMLParagraphElement | null>(null);
  const lineHeld = useRef(false);
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
    if (said != null) focusWhenFree(() => saidLine.current);
  }, [said]);

  useEffect(() => {
    if (page.factor !== 'loading') return;
    const timer = setTimeout(() => {
      lineHeld.current = saidLine.current != null && document.activeElement === saidLine.current;
      setPage((now) => ({ ...now, factor: 'loaded' }));
    }, loadMs);
    return () => clearTimeout(timer);
  }, [page.factor, loadMs]);

  useLayoutEffect(() => {
    if (page.factor !== 'loaded' || !lineHeld.current) return;
    lineHeld.current = false;
    saidLine.current?.focus();
  }, [page.factor]);

  useEffect(() => {
    if (deviceLoad !== 'loading') return;
    const timer = setTimeout(() => setDeviceLoad('loaded'), loadMs);
    return () => clearTimeout(timer);
  }, [deviceLoad, loadMs]);

  function retryFactor(): void {
    setLoadMs(SEND_MS);
    setPage((now) => ({ ...now, factor: 'loading' }));
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
        <DemoOffline />
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        {page.factor === 'loaded' ? (
          <ShieldCard
            says={card.says}
            summary={card.summary}
            said={card.line == null ? null : { text: card.line, done: card.done }}
            saidRef={(line) => {
              saidLine.current = line;
            }}
            step={
              card.step == null
                ? null
                : { label: card.step, onClick: () => setDialog(opening('setup')) }
            }
          />
        ) : (
          <SaidLine
            alone
            said={said == null ? null : { text: said, done: true }}
            saidRef={(line) => {
              saidLine.current = line;
            }}
          />
        )}
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
          {page.factor === 'failed' ? (
            <SectionFailed
              title={W.factorFailed}
              line={W.factorFailedLine}
              announce={said == null}
              onRetry={retryFactor}
            />
          ) : page.factor === 'loading' ? (
            <Bones count={1} label={W.loading} />
          ) : page.on ? (
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
                    <KeptAction label={W.turnOffKept} />
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
          {deviceLoad === 'failed' ? (
            <SectionFailed
              title={t('devices.failedTitle')}
              line={t('devices.failedBody')}
              announce={false}
              onRetry={() => {
                setLoadMs(SEND_MS);
                setDeviceLoad('loading');
              }}
            />
          ) : deviceLoad === 'loading' ? (
            <Bones count={2} label={W.loading} />
          ) : (
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
          )}
          {deviceLoad === 'loaded' && <p className="desk-foot">{W.devicesFoot}</p>}
        </section>
        {deviceLoad === 'loaded' && others > 0 && (
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
        <ChangePasswordDialog
          start={dialog}
          email={you.email}
          change={(current, next) => sampleChange(current, next, others)}
          onClose={() => setDialog(null)}
          onForgot={() => setDialog(opening('forgot', { typed: you.email }))}
          onChanged={() => done(R.changed(others), { devices: here(page) })}
        />
      )}
      {dialog?.kind === 'forgot' && (
        <ForgotDialog
          start={dialog}
          send={sampleSend}
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
          begin={sampleBegin}
          pass={samplePass}
          onClose={() => setDialog(null)}
          onPassed={() => setDialog(opening('choose'))}
        />
      )}
      {dialog?.kind === 'choose' && (
        <ChoosePasswordDialog
          start={dialog}
          email={you.email}
          save={sampleSavePassword}
          onClose={() => setDialog(null)}
          onExpired={() => setDialog(opening('setCode', { expired: true }))}
          onAdded={() =>
            done(R.added(linkedProviders(page.ways)[0] ?? 'Google'), {
              ways: { ...page.ways, password: true },
            })
          }
        />
      )}
      {dialog?.kind === 'prove' &&
        (dialog.purpose === 'turnOff' || dialog.purpose === 'newCodes') && (
          <FactorDialog
            purpose={dialog.purpose}
            email={you.email}
            start={{ typed: dialog.second, tried: dialog.tried }}
            submit={sampleFactor}
            onClose={() => setDialog(null)}
            onDone={() => dialog.purpose != null && provedFor(dialog.purpose, null)}
            onKept={() => setDialog(null)}
          />
        )}
      {dialog?.kind === 'prove' &&
        (dialog.purpose === 'link' ||
          dialog.purpose === 'unlink' ||
          dialog.purpose === 'everywhere') && (
          <ProveSample
            dialog={dialog}
            purpose={dialog.purpose}
            page={page}
            email={you.email}
            onClose={() => setDialog(null)}
            onProved={(purpose, provider) => provedFor(purpose, provider)}
          />
        )}
      {dialog?.kind === 'setup' && (
        <SetupDialog
          start={dialog}
          enrol={sampleEnrol}
          activate={sampleActivate}
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

const ID: Record<Provider, ApiProvider> = { Google: 'google', Apple: 'apple' };

/** Confirm it's you for a link, an unlink or signing out everywhere else; with no password, the provider comes back at once. */
function ProveSample({
  dialog,
  purpose,
  page,
  email,
  onClose,
  onProved,
}: {
  dialog: DialogStart;
  purpose: 'link' | 'unlink' | 'everywhere';
  page: SecurityPage;
  email: string;
  onClose: () => void;
  onProved: (purpose: Purpose, provider: Provider | null) => void;
}) {
  const asks = proveAsks(purpose, dialog.provider, page, email);
  const by = asks.provider == null ? null : ID[asks.provider];

  return (
    <ProveDialog
      via={asks.password ? 'password' : by}
      twoFactorOn={page.on}
      returned={null}
      purpose={
        purpose === 'everywhere' || dialog.provider == null
          ? { kind: 'signOutOthers' }
          : { kind: 'prove', then: { action: purpose, provider: ID[dialog.provider] } }
      }
      start={{ password: dialog.typed, typed: dialog.second, tried: dialog.tried }}
      lead={asks.lead}
      note={asks.note ?? undefined}
      codeHelp={asks.codeHelp}
      prove={sampleSecurityProof}
      leave={() => afterSending(() => onProved(purpose, dialog.provider))}
      onClose={onClose}
      onProved={() => onProved(purpose, dialog.provider)}
    />
  );
}

function here(page: SecurityPage): string[] {
  return devicesOf(page)
    .filter((device) => device.here)
    .map((device) => device.id);
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
          <KeptAction label={W.unlinkKept} />
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
