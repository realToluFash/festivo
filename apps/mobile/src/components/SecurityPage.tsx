import {
  type Account,
  ApiError,
  type DeviceSession,
  type Membership,
  primaryEmailAddress,
  type Provider,
  ProviderCancelled,
  type ProviderSignInAttempt,
  type TwoFactorStatus,
} from '@soirely/api-client';
import {
  appDevice,
  cleanCode,
  confirmWith,
  formatDay,
  formatTimeOfDay,
  keepsWhatLoaded,
  lockLiftsAt,
  othersOf,
  PROOF_MINUTES,
  proveWith,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { createRef, type RefObject, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { retryAfter } from '../kit/code.ts';
import { deviceMoment, deviceName } from '../kit/devices.ts';
import { passwordRefusal, setCodeRefusal } from '../kit/passwordChange.ts';
import {
  askBusy,
  type AskWords,
  cardCounts,
  cardLine,
  cardSays,
  type DeviceKind,
  type DeviceView,
  everywhereAsk,
  linked,
  newCodesAsk,
  type SecurityRules,
  signOutAsk,
  signOutOthers,
  turnOffAsk,
  unlinkAsk,
  type Ways,
} from '../kit/securityPage.ts';
import { codeHelp, proveIntro, unlinkProofLapsed } from '../kit/waysProof.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { heldProof } from '../recentProof.ts';
import { currentSessionId } from '../tokens.ts';
import { ConfirmScreen, type ConfirmSays, type ProofAsks } from './AccountConfirm.tsx';
import { useProof } from './ConfirmItsYou.tsx';
import { SETTLED_MS, ScreenScroll } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { SecurityCard } from './SecurityCard.tsx';
import { DevicesSection, Everywhere } from './SecurityDevices.tsx';
import { ChangePasswordScreen, SetPasswordScreen, type Setting } from './SecurityPassword.tsx';
import {
  type Enrolment,
  QR_SIDE,
  TwoFactorScreen,
  TwoFactorSection,
} from './SecurityTwoFactor.tsx';
import { WaysSection } from './SecurityWays.tsx';
import { useShellLayout } from './settingsShell.ts';
import {
  Ask,
  bringIntoView,
  FailedBlock,
  LoadingBlock,
  RowShapes,
  Section,
  useRowClear,
} from './Summary.tsx';
import type { TextHandle } from './Text.tsx';

type AskKind = 'unlink' | 'turnOff' | 'newCodes' | 'signOut' | 'everywhere';
type Proof = 'link' | 'unlink' | 'everywhere' | 'turnOff' | 'newCodes';
type Screen = 'change' | 'setPassword' | 'confirm' | 'setup';

type Target =
  | 'card'
  | 'step'
  | 'password'
  | 'link'
  | 'unlink'
  | 'setup'
  | 'turnOff'
  | 'newCodes'
  | 'signOut'
  | 'everywhere';

type Loaded<T> = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; value: T };

const EVERYWHERE = 'everywhere';

export function SecurityPage({
  account,
  organisations,
  watch,
  refresh,
  onLoaded,
  onChanged,
  onRefused,
  onSignOutHere,
  onEndedHere,
}: {
  account: Account;
  organisations: readonly Membership[];
  /** The screen's offline watch, and the count it raises to read the page again under the band. */
  watch: <T>(load: Promise<T>) => Promise<T>;
  refresh: number;
  onLoaded: (loaded: boolean) => void;
  onChanged: () => Promise<void>;
  /** The server refused a change, so the rows on screen may be stale; a failed read leaves them. */
  onRefused: () => Promise<void>;
  onSignOutHere: () => void;
  /** This device's session has already ended on the server, so only the tokens are left to clear. */
  onEndedHere: () => void;
}) {
  const { t } = useTranslation();
  const layout = useShellLayout();
  const clear = useRowClear();
  const screenScroll = useContext(ScreenScroll);
  const [status, setStatus] = useState<Loaded<TwoFactorStatus>>({ kind: 'loading' });
  const [sessions, setSessions] = useState<Loaded<DeviceSession[]>>({ kind: 'loading' });
  const [reads, setReads] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [ask, setAsk] = useState<AskKind | null>(null);
  const [acting, setActing] = useState(false);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | { failed: string } | null>(null);
  const [newCodes, setNewCodes] = useState<readonly string[] | null>(null);
  const [visit, setVisit] = useState(0);
  const blocks = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const [targets] = useState(() => ({
    card: createRef<TextHandle>(),
    step: createRef<ViewInstance>(),
    password: createRef<ViewInstance>(),
    link: createRef<ViewInstance>(),
    unlink: createRef<ViewInstance>(),
    setup: createRef<ViewInstance>(),
    turnOff: createRef<ViewInstance>(),
    newCodes: createRef<ViewInstance>(),
    signOut: createRef<ViewInstance>(),
    everywhere: createRef<ViewInstance>(),
  }));
  const from = useRef<Target>('card');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return targets[from.current].current ?? targets.card.current;
      },
    }),
    [targets],
  );
  const locale = dateLocale();
  const [stepUp] = useState(() => ({ token: '' }));
  const adding = settingPassword(t, locale, stepUp);
  const email = primaryEmailAddress(account) ?? '';
  const ways: Ways = {
    email,
    password: account.hasPassword,
    providers: (['google', 'apple'] as const).map((provider) => {
      const mine = account.providers.find((each) => each.provider === provider);

      return {
        provider,
        name: PROVIDER_NAMES[provider],
        linked: mine != null,
        address: mine?.email ?? null,
      };
    }),
  };
  const rules: SecurityRules = {
    providerOnly: organisations.find((one) => one.signInRules.providerOnly)?.name ?? null,
    twoFactor: organisations.find((one) => one.signInRules.everyoneNeedsTwoFactor)?.name ?? null,
  };
  const twoFactor = status.kind === 'ready' ? status.value : null;
  const on = twoFactor?.on ?? false;
  const listed = sessions.kind === 'ready' ? sessions.value : null;
  const devices = listed?.map((session) => deviceView(session, locale, t)) ?? [];
  const others = listed == null ? { count: 0, sessionId: null } : othersOf(listed);
  const openedWay = ways.providers.find((way) => way.provider === opened) ?? null;
  const openedDevice = devices.find((device) => device.id === opened && !device.here) ?? null;

  useEffect(() => {
    let live = true;

    watch(api.twoFactorStatus())
      .then((value) => live && setStatus({ kind: 'ready', value }))
      .catch((error: unknown) => {
        if (live)
          setStatus((now) =>
            now.kind === 'ready' && keepsWhatLoaded(error) ? now : { kind: 'failed' },
          );
      });
    watch(api.sessions())
      .then((value) => live && setSessions({ kind: 'ready', value }))
      .catch((error: unknown) => {
        if (live)
          setSessions((now) =>
            now.kind === 'ready' && keepsWhatLoaded(error) ? now : { kind: 'failed' },
          );
      });

    return () => {
      live = false;
    };
  }, [reads, refresh, watch]);

  const loaded = status.kind === 'ready' && sessions.kind === 'ready';

  useEffect(() => onLoaded(loaded), [loaded, onLoaded]);

  useEffect(() => {
    if (said != null) screenScroll?.ref.current?.scrollTo({ y: 0, animated: true });
  }, [said, screenScroll]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function readAgain(): void {
    setReads((count) => count + 1);
  }

  function retry(): void {
    setStatus({ kind: 'loading' });
    setSessions({ kind: 'loading' });
    readAgain();
  }

  function onBlock(id: string, block: ViewInstance | null): void {
    blocks.current[id] = block;
  }

  function show(next: Screen, target: Target): void {
    from.current = target;
    setVisit((count) => count + 1);
    setScreen(next);
  }

  function prove(next: Proof, target: Target): void {
    setAsk(null);
    setProof(next);
    show('confirm', target);
  }

  function asking(question: AskKind, block: string, target: Target): void {
    from.current = target;
    setRowError(null);
    setAsk(question);
    bringIntoView(blocks.current[block], screenScroll?.ref.current ?? null, clear, true);
  }

  function done(words: string): void {
    from.current = 'card';
    setSaid(words);
    setOpened(null);
    setRowError(null);
    setAsk(null);
    setScreen(null);
    setNewCodes(null);
  }

  function doneAtOnce(words: string): void {
    done(words);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => moveScreenReaderFocus(targets.card.current), SETTLED_MS);
  }

  /** A refusal stays under the opened row's offers, with the screen over it closed. */
  function refuseRow(id: string, message: string): void {
    setAsk(null);
    setScreen(null);
    setRowError({ id, message });
  }

  async function link(provider: Provider, held: string, atOnce: boolean): Promise<void> {
    setActing(true);
    setRowError(null);

    let signIn: ProviderSignInAttempt;
    try {
      signIn = await confirmWithProvider(provider);
    } catch (refusal) {
      setActing(false);
      if (refusal instanceof ProviderCancelled) setScreen(null);
      else refuseRow(provider, waysRefusal(refusal, provider, t, true));
      return;
    }

    try {
      await api.linkProvider(provider, held, signIn);
      await onChanged();
      const words = t('security.linkedDone', { provider: PROVIDER_NAMES[provider] });
      if (atOnce) doneAtOnce(words);
      else done(words);
    } catch (refusal) {
      refuseRow(provider, waysRefusal(refusal, provider, t, false));
    } finally {
      setActing(false);
    }
  }

  async function unlink(provider: Provider, held: string): Promise<void> {
    setActing(true);
    setRowError(null);

    try {
      const { thisDevice } = await api.unlinkProvider(provider, held);
      if (thisDevice) {
        onSignOutHere();
        return;
      }
      await onChanged();
      done(t('waysCard.unlinkedDone', { provider: PROVIDER_NAMES[provider] }));
      readAgain();
    } catch (refusal) {
      if (unlinkProofLapsed(refusal)) {
        prove('unlink', 'unlink');
        return;
      }
      if (refusal instanceof ApiError) await onRefused().catch(() => {});
      refuseRow(provider, waysRefusal(refusal, provider, t, false));
    } finally {
      setActing(false);
    }
  }

  async function signOut(device: DeviceView): Promise<void> {
    if (acting) return;
    setActing(true);

    try {
      await api.endSession(device.id);
      setSessions((now) =>
        now.kind === 'ready'
          ? { kind: 'ready', value: now.value.filter((session) => session.id !== device.id) }
          : now,
      );
      done(t('devices.ended', { name: device.name }));
    } catch {
      refuseRow(device.id, t('devices.endFailedBody'));
    } finally {
      setActing(false);
    }
  }

  async function signOutEverywhere(held: string): Promise<ConfirmSays | null> {
    const outcome = await signOutOthers(() => api.signOutEverywhereElse(held, others.sessionId), t);
    switch (outcome.kind) {
      case 'endedHere':
        onEndedHere();
        return null;
      case 'done':
        done(outcome.words);
        readAgain();
        return null;
      case 'failed':
        if (outcome.refused) await onRefused().catch(() => {});
        return { password: null, code: null, checked: false, other: outcome.message };
    }
  }

  function setUp(target: Target): void {
    setEnrolment(null);
    setNewCodes(null);
    show('setup', target);
    api.enrolTwoFactor().then(
      (enrolled) =>
        setEnrolment({
          qr: <SvgXml xml={enrolled.qrSvg} width={QR_SIDE} height={QR_SIDE} />,
          secret: enrolled.secret,
        }),
      () => setEnrolment({ failed: t('twoFactorCard.failedBody') }),
    );
  }

  function onLink(provider: Provider): void {
    from.current = 'link';
    const held = heldProof();
    if (held == null) prove('link', 'link');
    else void link(provider, held, true);
  }

  function confirmAsk(): void {
    switch (ask) {
      case 'unlink': {
        if (openedWay == null) return;
        const held = heldProof();
        if (held == null) prove('unlink', 'unlink');
        else void unlink(openedWay.provider, held);
        return;
      }
      case 'turnOff':
      case 'newCodes':
      case 'everywhere':
        prove(ask, ask);
        return;
      case 'signOut':
        if (openedDevice != null) void signOut(openedDevice);
        return;
      case null:
        return;
    }
  }

  const question = askOf(ask, {
    unlink: openedWay?.linked === true ? unlinkAsk(openedWay, ways, t) : null,
    signOut: openedDevice == null ? null : signOutAsk(openedDevice.name, t),
    everywhere: others.count > 0 ? everywhereAsk(others.count, others.sessionId != null, t) : null,
    turnOff: turnOffAsk(email, t),
    newCodes: newCodesAsk(t),
  });

  if (status.kind === 'loading') return <LoadingBlock words={t('pending.loading')} icons />;
  if (status.kind === 'failed')
    return (
      <FailedBlock
        title={t('twoFactorCard.failedTitle')}
        line={t('twoFactorCard.failedBody')}
        onRetry={retry}
        testID="security.retry"
      />
    );

  const acted = openedWay ?? ways.providers[0];

  return (
    <>
      <SecurityCard
        says={cardSays(on, t)}
        counts={cardCounts(ways, listed?.length ?? null, t)}
        line={cardLine(said, on, t)}
        wide={layout === 'portrait'}
        saysRef={targets.card}
        step={
          on
            ? null
            : {
                label: t('twoFactorCard.turnOn'),
                onPress: () => setUp('step'),
                testID: 'security.step',
                ref: targets.step,
              }
        }
      />
      <WaysSection
        ways={ways}
        rules={rules}
        opened={opened}
        error={rowError != null && rowError.id === opened ? rowError.message : null}
        busy={acting}
        passwordRef={targets.password}
        linkRef={targets.link}
        unlinkRef={targets.unlink}
        onPassword={() => show(ways.password ? 'change' : 'setPassword', 'password')}
        onBlock={onBlock}
        onToggle={toggle}
        onLink={onLink}
        onUnlink={(provider) => asking('unlink', provider, 'unlink')}
      />
      <TwoFactorSection
        on={on}
        codesLeft={twoFactor?.recoveryCodesLeft ?? 0}
        email={email}
        rules={rules}
        opened={opened}
        error={rowError != null && rowError.id === opened ? rowError.message : null}
        setupRef={targets.setup}
        turnOffRef={targets.turnOff}
        newCodesRef={targets.newCodes}
        onSetup={() => setUp('setup')}
        onBlock={onBlock}
        onToggle={toggle}
        onTurnOff={() => asking('turnOff', 'authenticator', 'turnOff')}
        onNewCodes={() => asking('newCodes', 'codes', 'newCodes')}
      />
      {sessions.kind === 'ready' && (
        <DevicesSection
          devices={devices}
          opened={opened}
          error={rowError != null && rowError.id === opened ? rowError.message : null}
          signOutRef={targets.signOut}
          onBlock={onBlock}
          onToggle={toggle}
          onSignOut={(device) => asking('signOut', device.id, 'signOut')}
          onSignOutHere={onSignOutHere}
        />
      )}
      {sessions.kind === 'loading' && (
        <Section title={t('devices.title')}>
          <RowShapes count={2} words={t('devices.loading')} icons />
        </Section>
      )}
      {sessions.kind === 'failed' && (
        <FailedBlock
          title={t('devices.failedTitle')}
          line={t('devices.failedBody')}
          onRetry={retry}
          testID="security.devices.retry"
        />
      )}
      {others.count > 0 && (
        <Everywhere
          everywhereRef={targets.everywhere}
          blockRef={(block) => onBlock(EVERYWHERE, block)}
          onPress={() => asking('everywhere', EVERYWHERE, 'everywhere')}
        />
      )}
      <Ask
        open={question != null}
        opener={opener}
        title={question?.title ?? ''}
        line={question?.line ?? ''}
        keep={{
          label: question?.keep ?? '',
          testID: `security.${ask ?? 'ask'}.keep`,
          off: acting,
        }}
        confirm={{
          label: question?.confirm ?? '',
          testID: `security.${ask ?? 'ask'}.confirm`,
          removes: question?.removes ?? false,
          busy: acting ? askBusy(ask, t) : undefined,
        }}
        onKeep={() => {
          if (!acting) setAsk(null);
        }}
        onConfirm={confirmAsk}
        testID={`security.${ask ?? 'ask'}`}
      />
      <ChangePasswordScreen
        key={`change.${visit}`}
        open={screen === 'change'}
        email={email}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={async (current, next) => {
          try {
            const { signedOut } = await api.changePassword({
              currentPassword: current,
              newPassword: next,
              sessionId: currentSessionId(),
            });
            done(t('passwordCard.done', { count: signedOut }));
            readAgain();

            return null;
          } catch (refusal) {
            const said = passwordRefusal(refusal, t, locale);

            return {
              field:
                said.field === 'currentPassword'
                  ? 'current'
                  : said.field === 'newPassword'
                    ? 'next'
                    : 'other',
              message: said.message,
            };
          }
        }}
        onSend={async (address) => {
          try {
            await api.forgotPassword(address);

            return null;
          } catch (refusal) {
            const lifts =
              refusal instanceof ApiError && refusal.is('too_many_attempts')
                ? lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')))
                : null;

            return lifts == null
              ? t('recovery.failedLine')
              : t('recovery.limitedLine', { time: formatTimeOfDay(lifts, locale) });
          }
        }}
      />
      <SetPasswordScreen
        key={`set.${visit}`}
        open={screen === 'setPassword'}
        email={email}
        opener={opener}
        onClose={() => setScreen(null)}
        setting={{
          ...adding,
          save: async (password) => {
            const refused = await adding.save(password);
            if (refused == null) {
              await onChanged();
              done(t('passwordCard.added', { provider: linked(ways)[0]?.name ?? '' }));
            }

            return refused;
          },
        }}
      />
      {proof != null && (
        <ProofStep
          key={`confirm.${visit}.${on}`}
          open={screen === 'confirm'}
          proof={proof}
          account={account}
          acting={acted?.provider ?? 'google'}
          twoFactorOn={on}
          email={email}
          opener={opener}
          onClose={() => setScreen(null)}
          onProved={async (held, code) => {
            if (code) readAgain();
            switch (proof) {
              case 'link':
                if (acted != null) await link(acted.provider, held, false);
                return null;
              case 'unlink':
                if (acted != null) await unlink(acted.provider, held);
                return null;
              case 'everywhere':
                return signOutEverywhere(held);
              default:
                return null;
            }
          }}
          onCode={async (code) => {
            try {
              if (proof === 'turnOff') {
                await api.disableTwoFactor(code);
                setStatus({ kind: 'ready', value: { on: false, recoveryCodesLeft: 0 } });
                done(t('security.twoFactorOff', { email }));
              } else {
                const codes = await api.newRecoveryCodes(code);
                setNewCodes(codes);
                show('setup', 'newCodes');
              }
              readAgain();

              return null;
            } catch (refusal) {
              if (refusal instanceof ApiError && refusal.is('two_factor_kept_by_rule')) {
                refuseRow(
                  'authenticator',
                  t('twoFactorCard.keptByRule', {
                    organisation: refusal.problem.organisation ?? '',
                  }),
                );
                return null;
              }

              return codeRefusal(refusal, t, locale);
            }
          }}
        />
      )}
      <TwoFactorScreen
        key={`twoFactor.${visit}`}
        open={screen === 'setup'}
        enrolment={enrolment}
        startCodes={newCodes}
        phone={layout === 'phone'}
        opener={opener}
        onClose={() => setScreen(null)}
        onTurnOn={async (code) => {
          try {
            const codes = await api.activateTwoFactor(cleanCode(code));
            setStatus({ kind: 'ready', value: { on: true, recoveryCodesLeft: codes.length } });
            void onChanged();

            return { codes };
          } catch (refusal) {
            return { error: codeRefusal(refusal, t, locale, 'twoFactorCard.setupWrong') };
          }
        }}
        onFinished={() =>
          done(newCodes == null ? t('security.twoFactorOn') : t('security.newCodesDone'))
        }
      />
    </>
  );

  function toggle(id: string): void {
    setRowError(null);
    setOpened((now) => (now === id ? null : id));
  }
}

/** Confirm it's you before the change: the password, or the provider, then the code; turning off and new codes take the code alone. */
function ProofStep({
  open,
  proof,
  account,
  acting,
  twoFactorOn,
  email,
  opener,
  onClose,
  onProved,
  onCode,
}: {
  open: boolean;
  proof: Proof;
  account: Account;
  acting: Provider;
  twoFactorOn: boolean;
  email: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onProved: (proof: string, codeSpent: boolean) => Promise<ConfirmSays | null>;
  /** Turning off and new codes: the code is the proof, sent with the change. */
  onCode: (code: string) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const codeOnly = proof === 'turnOff' || proof === 'newCodes';
  const via =
    proof === 'everywhere'
      ? confirmWith(account.hasPassword, account.providers)
      : proveWith(account.hasPassword, account.providers, acting);
  const proving = useProof(codeOnly ? 'password' : via, twoFactorOn);
  const provider = codeOnly || via === 'password' || via == null ? null : PROVIDER_NAMES[via];
  const stepTwo = provider != null && proving.signedIn != null ? provider : null;
  const lead = codeOnly
    ? t('twoFactorCard.offBody')
    : provider != null && !proving.codeAsked
      ? t('waysCard.proveWithProvider', { provider })
      : proof === 'everywhere'
        ? t('devices.everywhereWhy')
        : proveIntro(t, proof === 'link' ? 'link' : 'unlink', PROVIDER_NAMES[acting]);
  const asks: ProofAsks = {
    lead,
    note:
      proof === 'link'
        ? t('waysCard.linkNote', { provider: PROVIDER_NAMES[acting], email })
        : undefined,
    expired:
      proving.expired != null && provider != null
        ? {
            text: t('waysCard.proofExpired', { provider, count: PROOF_MINUTES }),
            answer: proving.expired,
          }
        : undefined,
    password: !codeOnly && via === 'password',
    code: codeOnly || proving.codeAsked,
    codeHelp:
      proof === 'turnOff'
        ? t('twoFactorCard.offEmail', { email })
        : proof === 'everywhere'
          ? t('devices.everywhereCodeHelp')
          : codeHelp(t, stepTwo),
    instead: provider,
  };

  return (
    <ConfirmScreen
      open={open}
      asks={asks}
      opener={opener}
      onClose={onClose}
      onContinue={async (password, code): Promise<ConfirmSays | null> => {
        const blank = {
          password: asks.password && password === '' ? t('waysCard.passwordBlank') : null,
          code: asks.code && code.trim() === '' ? t('waysCard.codeBlank') : null,
        };
        if (blank.password != null || blank.code != null) return { ...blank, checked: true };
        if (codeOnly) {
          const refused = await onCode(code.trim());

          return refused == null ? null : { password: null, code: refused, checked: false };
        }
        const outcome = await proving.submit(password, code);
        if (outcome.kind === 'proved') return onProved(outcome.proof, outcome.codeSpent);
        if (outcome.kind !== 'refused') return { password: null, code: null, checked: false };
        const { field, message } = outcome.refusal;

        return {
          password: field === 'password' ? message : null,
          code: field === 'code' ? message : null,
          checked: false,
          other: field === 'failed' ? message : null,
        };
      }}
      testID="security.confirm"
    />
  );
}

function askOf(ask: AskKind | null, words: Record<AskKind, AskWords | null>): AskWords | null {
  return ask == null ? null : words[ask];
}

const KIND_OF: Record<string, DeviceKind> = {
  iPhone: 'device',
  phone: 'device',
  iPad: 'tablet',
  tablet: 'tablet',
};

function deviceView(session: DeviceSession, locale: string, t: TFunction): DeviceView {
  const app = appDevice(session.userAgent);

  return {
    id: session.id,
    kind: app == null ? 'laptop' : (KIND_OF[app] ?? 'laptop'),
    name: deviceName(session, t),
    here: session.thisDevice,
    line: session.thisDevice
      ? t('security.thisDevice')
      : t('devices.lastUsed', { used: deviceMoment(session.renewedAt, locale, t) }),
    signedIn: t('devices.signedInFrom', {
      started: deviceMoment(session.startedAt, locale, t),
      ip: session.ipAddress ?? t('devices.unknownAddress'),
    }),
    expires: t('security.expires', { day: formatDay(session.expiresAt, locale) }),
  };
}

function waysRefusal(refusal: unknown, provider: Provider, t: TFunction, linking: boolean): string {
  const name = PROVIDER_NAMES[provider];

  if (refusal instanceof ApiError && refusal.is('provider_taken'))
    return `${t('waysCard.taken', { provider: name })} ${t('waysCard.takenNext', { provider: name })}`;
  if (refusal instanceof ApiError && refusal.is('last_sign_in_method'))
    return t('waysCard.lastRefused');
  if (refusal instanceof ApiError && refusal.is('provider_kept_by_rule'))
    return `${t('waysCard.keptByRule', { organisation: refusal.problem.organisation ?? '' })} ${t(
      'waysCard.keptByRuleNext',
      { provider: name, other: PROVIDER_NAMES[provider === 'google' ? 'apple' : 'google'] },
    )}`;
  if (linking && !(refusal instanceof ApiError))
    return t('waysCard.providerFailed', { provider: name });

  return t('waysCard.failedBody');
}

/** A refused two-factor code in the reader's words; a lockout gives the time it lifts. */
function codeRefusal(
  refusal: unknown,
  t: TFunction,
  locale: string,
  wrong = 'twoFactorCard.offWrong',
): string {
  if (!(refusal instanceof ApiError)) return t('twoFactorCard.failedBody');
  if (refusal.is('too_many_attempts')) {
    const lifts = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    return lifts == null
      ? t('twoFactorCard.failedBody')
      : t('twoFactor.pausedBody', { time: formatTimeOfDay(lifts, locale) });
  }
  if (refusal.is('recovery_code_used')) return t('twoFactor.recoveryUsed');

  return refusal.is('two_factor_code_invalid') ? t(wrong) : t('twoFactorCard.failedBody');
}

function settingPassword(t: TFunction, locale: string, stepUp: { token: string }): Setting {
  return {
    send: async () => {
      try {
        return await api.startSettingPassword();
      } catch (refusal) {
        return retryAfter(refusal);
      }
    },
    pass: async (code) => {
      try {
        stepUp.token = await api.passPasswordCode(cleanCode(code));

        return null;
      } catch (refusal) {
        const said = setCodeRefusal(refusal, t, locale);

        return said.refusal ?? said.paused ?? t('passwordCard.failedBody');
      }
    },
    save: async (password) => {
      try {
        await api.setPassword(password, stepUp.token);

        return null;
      } catch (refusal) {
        if (refusal instanceof ApiError && refusal.is('verification_code_expired'))
          return 'expired';
        const violation =
          refusal instanceof ApiError
            ? refusal.problem.violations?.find((v) => v.propertyPath === 'newPassword')
            : undefined;
        if (violation == null) return { field: 'other', message: t('passwordCard.failedBody') };

        return {
          field: 'password',
          message:
            violation.code === 'password_breached' ? t('register.breached') : violation.message,
        };
      }
    },
  };
}
