import {
  ApiError,
  type DeviceSession,
  type Provider,
  type ProviderSignInAttempt,
  type TwoFactorStatus,
} from '@soirely/api-client';
import { PROOF_MINUTES, confirmWith, othersOf, proveWith, thisDeviceFirst } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { Lead } from '../../../components/AccountParts.tsx';
import { ProveDialog } from '../../../components/AccountDialogs.tsx';
import { FieldError } from '../../../components/FieldError.tsx';
import { Bones } from '../../../components/GeneralParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import {
  ChangePasswordDialog,
  ChoosePasswordDialog,
  FactorDialog,
  ForgotDialog,
  RecoveryDialog,
  SectionFailed,
  SentDialog,
  SetCodeDialog,
  SetupDialog,
} from '../../../components/SecurityDialogs.tsx';
import { KeptAction, Openable, SaidLine, ShieldCard } from '../../../components/SecurityParts.tsx';
import {
  Ask,
  Chevron,
  DeskPage,
  Head,
  RedAction,
  RowWords,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import {
  PROVIDER_NAMES,
  type ProviderReturn,
  dropProviderReturn,
  heldProviderReturn,
  startProviderSignIn,
} from '../../../providerSignIn.ts';
import { dropProof, heldProof, holdProof } from '../../../recentProof.ts';
import {
  type AskWords,
  type WayIn,
  cardCounts,
  cardLine,
  dayAtTime,
  deviceLead,
  deviceLine,
  deviceName,
  everywhereAsk,
  everywhereDone,
  keptByRule,
  keptNote,
  lastWayIn,
  linked,
  newCodesAsk,
  passwordLine,
  providerLine,
  rulesOf,
  signOutAsk,
  turnOffAsk,
  unlinkAsk,
  unlinkNote,
  waysOf,
} from '../../../securityPage.ts';
import { wayRefusal, wayRefusalLine } from '../../../securityRefusals.ts';
import { opensOn } from '../settings/signInRulesDesk.ts';
import { forgetSession, refreshAccount, rereadCredentials, useSession } from '../../../session.ts';
import { useSignOut } from '../../../signOut.ts';
import { currentSessionId } from '../../../tokens.ts';
import '../../../components/SettingsParts.css';

type Load<T> = T | 'failed' | null;
type AskKind = 'unlink' | 'turnOff' | 'newCodes' | 'signOut' | 'everywhere';
type Act = { action: 'link' | 'unlink'; provider: Provider };
type Opened =
  | { kind: 'change' }
  | { kind: 'forgot'; typed: string }
  | { kind: 'sent'; typed: string }
  | { kind: 'setCode'; expired: boolean }
  | { kind: 'choose'; stepUp: string }
  | { kind: 'setup' }
  | { kind: 'recovery'; codes: readonly string[]; made: 'on' | 'new' }
  | { kind: 'factor'; purpose: 'turnOff' | 'newCodes' }
  | { kind: 'prove'; act: Act | 'everywhere'; returned: ProviderSignInAttempt | null };

const RETURNS = ['prove', 'link', 'signOutOthers'] as const;

/** Security at a desk in B · Summary first (sc-30411), as the design demo's /demo/settings/security draws it. */
export function SecurityDesk() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const locale = dateLocale();
  const title = useRef<HTMLHeadingElement>(null);
  const saidLine = useRef<HTMLParagraphElement | null>(null);
  const lineHeld = useRef(false);
  const { layers, covered, setHost } = useDeskLayers();
  const [twoFactor, setTwoFactor] = useState<Load<TwoFactorStatus>>(null);
  const [devices, setDevices] = useState<Load<DeviceSession[]>>(null);
  const [factorTry, setFactorTry] = useState(0);
  const [devicesTry, setDevicesTry] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  const [returned] = useState<ProviderReturn | null>(() => heldProviderReturn([...RETURNS]));
  const [rowError, setRowError] = useState<{ row: string; message: string } | null>(() =>
    returnRefusal(returned, t),
  );
  const [open, setOpen] = useState<string | null>(() =>
    rowError == null || rowError.row === 'everywhere' ? null : rowError.row,
  );
  const [ask, setAsk] = useState<AskKind | null>(null);
  const [acting, setActing] = useState(false);
  const [dialog, setDialog] = useState<Opened | null>(() => returnedProof(returned));
  const [opensOnLine] = useState(() => linksOnArrival(returned));
  const opensSetup = useRef(opensOn(location.state) === 'turnOn');
  const here = useSignOut(() => navigate('/sign-in'));
  const ways = waysOf(session.hasPassword, session.providers);
  const rules = rulesOf(session.organisations);
  const sessions = devices != null && devices !== 'failed' ? thisDeviceFirst(devices) : null;
  const others = sessions == null ? { count: 0, sessionId: null } : othersOf(sessions);
  const status = twoFactor != null && twoFactor !== 'failed' ? twoFactor : null;
  const { watch, refreshing } = useOffline({
    loaded: status != null && sessions != null,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

  useEffect(() => {
    let live = true;
    watch(api.twoFactorStatus()).then(
      (now) => {
        if (!live) return;
        lineHeld.current = saidLine.current != null && document.activeElement === saidLine.current;
        setTwoFactor(now);
        // A held step elsewhere in Settings opens two-factor's set-up, once the page knows it is off.
        if (!opensSetup.current) return;
        opensSetup.current = false;
        void navigate(location.pathname, { replace: true, state: null });
        if (!now.on) setDialog({ kind: 'setup' });
      },
      (error: unknown) =>
        live && setTwoFactor((was) => (was != null && keepsWhatLoaded(error) ? was : 'failed')),
    );

    return () => {
      live = false;
    };
  }, [factorTry, refresh, watch, navigate, location.pathname]);

  useEffect(() => {
    let live = true;
    watch(api.sessions()).then(
      (now) => live && setDevices(now),
      (error: unknown) =>
        live && setDevices((was) => (was != null && keepsWhatLoaded(error) ? was : 'failed')),
    );

    return () => {
      live = false;
    };
  }, [devicesTry, refresh, watch]);

  useEffect(() => {
    if (said != null) focusWhenFree(() => saidLine.current);
  }, [said]);

  // The alone line unmounts as the card arrives, so its copy in the card takes focus it held.
  useEffect(() => {
    if (status == null || !lineHeld.current) return;
    lineHeld.current = false;
    saidLine.current?.focus();
  }, [status]);

  // From an effect, so it lands after the closing Ask has handed focus back to its opener.
  useEffect(() => {
    if (rowError == null) return;
    focusWhenFree(() => document.getElementById(`security-${rowError.row}-error`));
  }, [rowError]);

  function done(words: string): void {
    setSaid(words);
    setOpen(null);
    setRowError(null);
    setAsk(null);
    setDialog(null);
  }

  function refuseOn(row: string, message: string): void {
    setAsk(null);
    setDialog(null);
    setOpen(row);
    setRowError({ row, message });
  }

  function rereadFactor(): void {
    setFactorTry((n) => n + 1);
  }

  function rereadDevices(): void {
    setDevicesTry((n) => n + 1);
  }

  function leaveHere(): void {
    forgetSession();
    void navigate('/sign-in');
  }

  async function proved<T>(send: Promise<T>): Promise<T> {
    try {
      return await send;
    } catch (refusal) {
      dropProof();
      throw refusal;
    }
  }

  function start(act: Act): void {
    setRowError(null);
    if (heldProof() == null) setDialog({ kind: 'prove', act, returned: null });
    else void proceed(act);
  }

  async function proceed(act: Act): Promise<void> {
    if (act.action === 'unlink') return unlink(act.provider);
    setDialog(null);
    try {
      await startProviderSignIn(act.provider, { kind: 'link' });
    } catch {
      refuseOn(
        act.provider,
        t('waysCard.providerFailed', { provider: PROVIDER_NAMES[act.provider] }),
      );
    }
  }

  async function unlink(provider: Provider): Promise<void> {
    const proof = heldProof();
    if (proof == null) {
      setAsk(null);
      setDialog({ kind: 'prove', act: { action: 'unlink', provider }, returned: null });
      return;
    }
    setActing(true);
    try {
      const { thisDevice } = await api.unlinkProvider(provider, proof);
      if (thisDevice) return leaveHere();
      await refreshAccount();
      done(t('waysCard.unlinkedDone', { provider: PROVIDER_NAMES[provider] }));
      rereadDevices();
    } catch (refusal) {
      if (refusal instanceof ApiError) await rereadCredentials().catch(() => {});
      refuseOn(provider, wayRefusalLine(wayRefusal(refusal, provider), t));
    } finally {
      setActing(false);
    }
  }

  async function endDevice(device: DeviceSession): Promise<void> {
    setActing(true);
    try {
      await api.endSession(device.id);
      done(t('devices.ended', { name: deviceName(device, t) }));
      setDevices((now) =>
        now == null || now === 'failed' ? now : now.filter((one) => one.id !== device.id),
      );
    } catch {
      refuseOn(device.id, t('devices.endFailedBody'));
    } finally {
      setActing(false);
    }
  }

  async function everywhere(proof: string): Promise<void> {
    try {
      // Back from a provider the proof can come before the list; without this device's id every session ends.
      const keep =
        sessions == null
          ? othersOf(thisDeviceFirst(await api.sessions())).sessionId
          : others.sessionId;
      const result = await api.signOutEverywhereElse(proof, keep);
      if (result.thisDevice) return leaveHere();
      done(everywhereDone(result.signedOut, t));
      rereadDevices();
    } catch {
      setDialog(null);
      setRowError({ row: 'everywhere', message: t('devices.everywhereFailedBody') });
    }
  }

  // Back from Google to link it: once, on arrival, since a provider's sign-in is spent on first use.
  const arrived = useRef(false);
  useEffect(() => {
    if (returned == null || arrived.current) return;
    arrived.current = true;
    const proof = heldProof();
    if ('failed' in returned || returned.purpose.kind !== 'link' || proof == null) return;
    const { provider } = returned;
    void api
      .linkProvider(provider, proof, returned.signIn)
      .then(() => refreshAccount())
      .then(
        () => done(t('security.linkedDone', { provider: PROVIDER_NAMES[provider] })),
        (refusal: unknown) => refuseOn(provider, wayRefusalLine(wayRefusal(refusal, provider), t)),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) => {
    setRowError(null);
    setOpen((now) => (now === key ? null : key));
  };
  const openWay = ways.providers.find((way) => way.provider === open) ?? null;
  const openDevice = sessions?.find((device) => device.id === open) ?? null;
  const last = lastWayIn(ways);
  const error = (row: string) =>
    rowError?.row === row && (
      <FieldError id={`security-${row}-error`} message={rowError.message} focusable />
    );
  const askWords: AskWords | null =
    ask === 'unlink' && openWay != null
      ? unlinkAsk(openWay, ways, t)
      : ask === 'turnOff'
        ? turnOffAsk(session.email, t)
        : ask === 'newCodes'
          ? newCodesAsk(t)
          : ask === 'signOut' && openDevice != null
            ? signOutAsk(deviceName(openDevice, t), t)
            : ask === 'everywhere'
              ? everywhereAsk(others.count, others.sessionId != null, t)
              : null;

  function goAsk(): void {
    if (ask === 'unlink' && openWay != null) void unlink(openWay.provider);
    else if (ask === 'turnOff' || ask === 'newCodes') {
      setAsk(null);
      setDialog({ kind: 'factor', purpose: ask });
    } else if (ask === 'signOut' && openDevice != null) void endDevice(openDevice);
    else if (ask === 'everywhere') {
      setAsk(null);
      const proof = heldProof();
      if (proof == null) setDialog({ kind: 'prove', act: 'everywhere', returned: null });
      else void everywhere(proof);
    }
  }

  function wayRow(way: WayIn) {
    const line = providerLine(way, t);

    if (last?.provider === way.provider)
      return (
        <li key={way.provider} className="desk-row">
          <Lead name="link" />
          <RowWords title={way.name} lines={[line]} />
        </li>
      );

    return (
      <Openable
        key={way.provider}
        title={way.name}
        line={line}
        lead="link"
        on={open === way.provider}
        onToggle={() => toggle(way.provider)}
      >
        {!way.linked ? (
          <>
            <div className="account-acts">
              <button
                type="button"
                className="desk-text"
                onClick={() => start({ action: 'link', provider: way.provider })}
              >
                {t('waysCard.link', { provider: way.name })}
              </button>
            </div>
            <p className="desk-note">
              {t('waysCard.linkNote', { provider: way.name, email: session.email })}
            </p>
          </>
        ) : rules.providerOnly != null && keptByRule(ways, way, rules) ? (
          <>
            <div className="account-acts">
              <KeptAction label={t('security.unlinkKept')} />
            </div>
            <p className="desk-note">{keptNote(ways, way, rules.providerOnly, t)}</p>
          </>
        ) : (
          <>
            <div className="account-acts">
              <button
                type="button"
                className="desk-text is-red"
                onClick={() => {
                  setRowError(null);
                  setAsk('unlink');
                }}
              >
                {t('waysCard.unlink')}
              </button>
            </div>
            <p className="desk-note">{unlinkNote(ways, way, t)}</p>
          </>
        )}
        {error(way.provider)}
      </Openable>
    );
  }

  const proving = dialog?.kind === 'prove' ? dialog : null;
  const provingAct = proving != null && proving.act !== 'everywhere' ? proving.act : null;

  return (
    <DeskPage layers={layers}>
      <div className="desk-column account-desk" inert={covered}>
        {refreshing && <Refreshing />}
        <TitleRow title={t('account.sectionSecurity')} titleRef={title} />
        {status == null ? (
          <SaidLine
            alone
            said={said == null ? null : { text: said, done: true }}
            saidRef={(line) => {
              saidLine.current = line;
            }}
          />
        ) : (
          <ShieldCard
            says={status.on ? t('security.on') : t('security.off')}
            summary={cardCounts(ways, sessions?.length ?? null, t)}
            said={cardLine(said, status.on, t)}
            saidRef={(line) => {
              saidLine.current = line;
            }}
            step={
              status.on
                ? null
                : { label: t('twoFactorCard.turnOn'), onClick: () => setDialog({ kind: 'setup' }) }
            }
          />
        )}
        <section className="desk-block">
          <Head title={t('waysCard.title')} />
          <ul className="desk-rows account-rows">
            <li>
              <button
                type="button"
                className="desk-row account-row"
                onClick={() =>
                  setDialog(
                    ways.password ? { kind: 'change' } : { kind: 'setCode', expired: false },
                  )
                }
              >
                <Lead name="keyRound" />
                <RowWords title={t('waysCard.password')} lines={[passwordLine(ways, t)]} />
                <Chevron />
              </button>
            </li>
            {ways.providers.map(wayRow)}
          </ul>
          {last != null && (
            <p className="desk-foot">{t('waysCard.last', { provider: last.name })}</p>
          )}
        </section>
        <section className="desk-block">
          <Head title={t('twoFactorCard.title')} />
          {twoFactor === 'failed' ? (
            <SectionFailed
              title={t('twoFactorCard.failedTitle')}
              line={t('twoFactorCard.failedBody')}
              announce={factorTry === 0 && !opensOnLine}
              onRetry={() => {
                setTwoFactor(null);
                rereadFactor();
              }}
            />
          ) : status == null ? (
            <Bones count={1} label={t('pending.loading')} />
          ) : status.on ? (
            <ul className="desk-rows account-rows">
              <Openable
                title={t('security.authenticator')}
                line={t('security.authenticatorOn')}
                lead="shield"
                on={open === 'auth'}
                onToggle={() => toggle('auth')}
              >
                <div className="account-acts">
                  {rules.twoFactor != null ? (
                    <KeptAction label={t('twoFactorCard.turnOff')} />
                  ) : (
                    <button
                      type="button"
                      className="desk-text is-red"
                      onClick={() => {
                        setRowError(null);
                        setAsk('turnOff');
                      }}
                    >
                      {t('twoFactorCard.turnOffAsks')}
                    </button>
                  )}
                </div>
                <p className="desk-note">
                  {rules.twoFactor != null
                    ? t('twoFactorCard.keptByRule', { organisation: rules.twoFactor })
                    : t('security.turnOffNote', { email: session.email })}
                </p>
                {error('auth')}
              </Openable>
              <Openable
                title={t('twoFactorCard.recoveryCodes')}
                line={t('twoFactorCard.unused', { left: status.recoveryCodesLeft, total: 10 })}
                lead="lock"
                on={open === 'codes'}
                onToggle={() => toggle('codes')}
              >
                <div className="account-acts">
                  <button type="button" className="desk-text" onClick={() => setAsk('newCodes')}>
                    {t('twoFactorCard.makeNewCodes')}
                  </button>
                </div>
                <p className="desk-note">{t('twoFactorCard.newWarningBody')}</p>
              </Openable>
            </ul>
          ) : (
            <>
              <ul className="desk-rows account-rows">
                <li>
                  <button
                    type="button"
                    className="desk-row account-row"
                    onClick={() => setDialog({ kind: 'setup' })}
                  >
                    <Lead name="shield" />
                    <RowWords
                      title={t('security.authenticator')}
                      lines={[t('twoFactorCard.off')]}
                    />
                    <Chevron />
                  </button>
                </li>
              </ul>
              <p className="desk-foot">{t('security.twoFactorFoot')}</p>
            </>
          )}
        </section>
        <section className="desk-block">
          <Head title={t('devices.title')} />
          {devices === 'failed' ? (
            <SectionFailed
              title={t('devices.failedTitle')}
              line={t('devices.failedBody')}
              announce={devicesTry === 0}
              onRetry={() => {
                setDevices(null);
                rereadDevices();
              }}
            />
          ) : sessions == null ? (
            <Bones count={2} label={t('pending.loading')} />
          ) : (
            <>
              <ul className="desk-rows account-rows" aria-label={t('devices.listLabel')}>
                {sessions.map((device) => (
                  <Openable
                    key={device.id}
                    title={deviceName(device, t)}
                    line={deviceLine(device, locale, t)}
                    lead={deviceLead(device)}
                    on={open === device.id}
                    onToggle={() => toggle(device.id)}
                  >
                    <p className="security-meta">
                      {t('devices.signedInFrom', {
                        started: dayAtTime(device.startedAt, locale, t),
                        ip: device.ipAddress ?? t('devices.unknownAddress'),
                      })}
                    </p>
                    <p className="security-meta">
                      {t('security.expires', {
                        day: new Intl.DateTimeFormat(locale, {
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(device.expiresAt)),
                      })}
                    </p>
                    <div className="account-acts">
                      {device.thisDevice ? (
                        <button
                          type="button"
                          className="desk-text"
                          onClick={() => void here.signOut()}
                        >
                          <Glyph name="signOut" size={17} weight={2.3} />
                          {t('devices.signOut')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="desk-text is-red"
                          onClick={() => {
                            setRowError(null);
                            setAsk('signOut');
                          }}
                        >
                          {t('devices.signOutAsks')}
                        </button>
                      )}
                    </div>
                    <p className="desk-note">
                      {device.thisDevice ? t('security.signOutHereNote') : t('devices.signInAgain')}
                    </p>
                    {device.thisDevice && here.unreached && (
                      <FieldError
                        id={`security-${device.id}-unreached`}
                        message={t('session.stillSignedInBody')}
                      />
                    )}
                    {error(device.id)}
                  </Openable>
                ))}
              </ul>
              <p className="desk-foot">{t('devices.intro')}</p>
            </>
          )}
        </section>
        {others.count > 0 && (
          <>
            <RedAction
              label={t('devices.everywhere')}
              line={t('devices.everywhereHint')}
              onClick={() => {
                setRowError(null);
                setAsk('everywhere');
              }}
            />
            {error('everywhere')}
          </>
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
      {askWords != null && (
        <Ask
          title={askWords.title}
          line={askWords.line}
          keep={askWords.keep}
          go={askWords.confirm}
          red={askWords.removes}
          busy={
            acting
              ? ask === 'unlink'
                ? t('security.unlinking')
                : ask === 'signOut'
                  ? t('security.signingOut')
                  : undefined
              : undefined
          }
          onKeep={() => !acting && setAsk(null)}
          onGo={goAsk}
        />
      )}
      {dialog?.kind === 'change' && (
        <ChangePasswordDialog
          email={session.email}
          change={(current, next) =>
            api.changePassword({
              currentPassword: current,
              newPassword: next,
              sessionId: currentSessionId(),
            })
          }
          onForgot={() => setDialog({ kind: 'forgot', typed: session.email })}
          onClose={() => setDialog(null)}
          onChanged={(signedOut) => {
            done(t('passwordCard.done', { count: signedOut }));
            rereadDevices();
          }}
        />
      )}
      {dialog?.kind === 'forgot' && (
        <ForgotDialog
          start={{ typed: dialog.typed }}
          send={(email) => api.forgotPassword(email)}
          onClose={() => setDialog(null)}
          onSent={(typed) => setDialog({ kind: 'sent', typed })}
        />
      )}
      {dialog?.kind === 'sent' && (
        <SentDialog
          onDone={() => setDialog(null)}
          onAgain={() => setDialog({ kind: 'forgot', typed: dialog.typed })}
        />
      )}
      {dialog?.kind === 'setCode' && (
        <SetCodeDialog
          email={session.email}
          start={{ expired: dialog.expired }}
          begin={() => api.startSettingPassword()}
          pass={(code) => api.passPasswordCode(code)}
          onClose={() => setDialog(null)}
          onPassed={(stepUp) => setDialog({ kind: 'choose', stepUp })}
        />
      )}
      {dialog?.kind === 'choose' && (
        <ChoosePasswordDialog
          email={session.email}
          save={(password) => api.setPassword(password, dialog.stepUp)}
          onClose={() => setDialog(null)}
          onExpired={() => setDialog({ kind: 'setCode', expired: true })}
          onAdded={() => {
            void refreshAccount();
            done(t('passwordCard.added', { provider: linked(ways)[0]?.name ?? '' }));
          }}
        />
      )}
      {dialog?.kind === 'setup' && (
        <SetupDialog
          enrol={() => api.enrolTwoFactor()}
          activate={(code) => api.activateTwoFactor(code)}
          onClose={() => setDialog(null)}
          onOn={(codes) => {
            void refreshAccount();
            setDialog({ kind: 'recovery', codes, made: 'on' });
          }}
        />
      )}
      {dialog?.kind === 'recovery' && (
        <RecoveryDialog
          codes={dialog.codes}
          onFinish={() => {
            done(dialog.made === 'on' ? t('security.twoFactorOn') : t('security.newCodesDone'));
            rereadFactor();
          }}
        />
      )}
      {dialog?.kind === 'factor' && (
        <FactorDialog
          purpose={dialog.purpose}
          email={session.email}
          submit={async (code) => {
            if (dialog.purpose === 'turnOff') await api.disableTwoFactor(code);
            else
              setDialog({ kind: 'recovery', codes: await api.newRecoveryCodes(code), made: 'new' });
          }}
          onClose={() => setDialog(null)}
          onDone={() => {
            if (dialog.purpose !== 'turnOff') return;
            done(t('security.twoFactorOff', { email: session.email }));
            rereadFactor();
          }}
          onKept={(organisation) =>
            refuseOn('auth', t('twoFactorCard.keptByRule', { organisation }))
          }
        />
      )}
      {proving != null && (
        <ProveDialog
          via={
            provingAct == null
              ? confirmWith(ways.password, session.providers)
              : proveWith(ways.password, session.providers, provingAct.provider)
          }
          twoFactorOn={status?.on ?? false}
          returned={proving.returned}
          purpose={
            provingAct == null ? { kind: 'signOutOthers' } : { kind: 'prove', then: provingAct }
          }
          lead={
            provingAct == null
              ? t('devices.everywhereWhy')
              : t(provingAct.action === 'link' ? 'waysCard.proveLink' : 'waysCard.proveUnlink', {
                  provider: PROVIDER_NAMES[provingAct.provider],
                  count: PROOF_MINUTES,
                })
          }
          note={
            provingAct?.action === 'link'
              ? t('waysCard.linkNote', {
                  provider: PROVIDER_NAMES[provingAct.provider],
                  email: session.email,
                })
              : undefined
          }
          codeHelp={provingAct == null ? t('devices.everywhereCodeHelp') : undefined}
          prove={(first, code) =>
            proved(
              api.prove(first, code).then((proof) => {
                holdProof(proof);
                if (code != null) rereadFactor();

                return proof.proof;
              }),
            )
          }
          onClose={() => setDialog(null)}
          onProved={(proof) =>
            provingAct == null ? void everywhere(proof) : void proceed(provingAct)
          }
        />
      )}
    </DeskPage>
  );
}

/** A provider that failed on the way back, said under the row it was for; a cancel says nothing. */
function returnRefusal(
  back: ProviderReturn | null,
  t: TFunction,
): { row: string; message: string } | null {
  if (back == null || !('failed' in back) || back.failed === 'cancelled') return null;
  const provider = PROVIDER_NAMES[back.provider];

  return back.purpose.kind === 'signOutOthers'
    ? { row: 'everywhere', message: t('devices.everywhereProviderFailed', { provider }) }
    : { row: back.provider, message: t('waysCard.providerFailed', { provider }) };
}

/** A link back from the provider with the proof still held: the page opens on its done line. */
function linksOnArrival(back: ProviderReturn | null): boolean {
  return back != null && !('failed' in back) && back.purpose.kind === 'link' && heldProof() != null;
}

/** Confirm it's you, opened again on the provider's answer it went to fetch, or when a link came back after the proof ran out. */
function returnedProof(back: ProviderReturn | null): Opened | null {
  if (back == null || 'failed' in back) return null;
  if (back.purpose.kind === 'link')
    return heldProof() == null
      ? { kind: 'prove', act: { action: 'link', provider: back.provider }, returned: null }
      : null;
  if (back.purpose.kind === 'prove')
    return { kind: 'prove', act: back.purpose.then, returned: back.signIn };

  return back.purpose.kind === 'signOutOthers'
    ? { kind: 'prove', act: 'everywhere', returned: back.signIn }
    : null;
}
