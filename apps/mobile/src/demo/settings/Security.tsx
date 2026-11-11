import type { Provider } from '@soirely/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { createRef, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { ConfirmScreen } from '../../components/AccountConfirm.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { SecurityCard } from '../../components/SecurityCard.tsx';
import { DevicesSection, Everywhere } from '../../components/SecurityDevices.tsx';
import {
  ChangePasswordScreen,
  type ChangeStage,
  SetPasswordScreen,
} from '../../components/SecurityPassword.tsx';
import { QR_SIDE, TwoFactorSection } from '../../components/SecurityTwoFactor.tsx';
import { WaysSection } from '../../components/SecurityWays.tsx';
import { useShell } from '../../components/settingsShell.ts';
import {
  Ask,
  bringIntoView,
  RowShapes,
  Section,
  SectionFailed,
  useRowClear,
} from '../../components/Summary.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import { dateLocale } from '../../i18n/index.ts';
import {
  type AskWords,
  cardCounts,
  cardLine,
  cardSays,
  everywhereAsk,
  everywhereDone,
  linked,
  newCodesAsk,
  signOutAsk,
  turnOffAsk,
  unlinkAsk,
} from '../../kit/securityPage.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { sampleContinue } from './AccountModel.ts';
import {
  changeRefusal,
  chooseRefusal,
  emailedCodeRefusal,
  type Factor,
  finishedLine,
  type Proof,
  proofAsks,
  sampleDevice,
  type SecurityAsk,
  type SecurityScreen,
  type SecurityStart,
  securityStart,
  securityStateOf,
  setupRefusal,
  waysOf,
} from './SecurityModel.ts';
import {
  AUTHENTICATOR_KEY,
  DEVICES,
  type Device,
  enrolledKey,
  otpauthLink,
  PROOF_MINUTES,
  PROVIDER_NAME,
  qrPath,
  RECOVERY_CODES,
} from './SecuritySample.ts';
import { type DemoEnrolment, DemoTwoFactorScreen } from './SecurityAddToApp.tsx';
import { AloneLine } from '../../components/SecurityAlone.tsx';
import { SummaryPage } from './SummaryPage.tsx';

export { SECURITY_STATES } from './SecurityModel.ts';

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

const EVERYWHERE = 'everywhere';
const QR_MODULES = 21;
const RESEND_SECONDS = 42;
const FACTOR_LOADING_MS = 8000;
const RETRY_MS = 500;
const KEY_LOADING_MS = 1500;

/** Settings › Security in B, summary first, on sample data that stays on the device. */
export function SecuritySection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = securityStateOf(state);

  return <SecurityPage key={name} start={securityStart(name)} />;
}

function SecurityPage({ start }: { start: SecurityStart }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const shell = useShell();
  const clear = useRowClear();
  const { rules } = start;
  const [sample, setSample] = useState(start.ways);
  const [twoFactor, setTwoFactor] = useState(start.twoFactor);
  const [codesLeft, setCodesLeft] = useState(start.codesLeft);
  const [devices, setDevices] = useState<readonly Device[]>(() =>
    DEVICES.filter((device) => !start.signedOut.includes(device.id)),
  );
  const [said, setSaid] = useState<string | null>(() => finishedLine(start.finished, t));
  const [factor, setFactor] = useState(start.factor);
  const [loadMs, setLoadMs] = useState(FACTOR_LOADING_MS);
  const [enrol, setEnrol] = useState(start.enrol);
  const [fetched, setFetched] = useState(start.fetched);
  const lineHeld = useRef(start.finished != null);
  const [opened, setOpened] = useState(start.opened);
  const [ask, setAsk] = useState(start.ask);
  const [screen, setScreen] = useState<SecurityScreen | null>(start.screen);
  const [proof, setProof] = useState<Proof | null>(start.proof);
  const [proved, setProved] = useState(false);
  const [codesFor, setCodesFor] = useState<'setup' | 'newCodes'>('setup');
  const [visit, setVisit] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const blocks = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const [targets] = useState(() => ({
    card: createRef<TextHandle>(),
    line: createRef<TextHandle>(),
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
  const from = useRef<Target>(startTarget(start));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const forgetting = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return targets[from.current].current ?? targets.card.current;
      },
    }),
    [targets],
  );
  const ways = useMemo(() => waysOf(sample), [sample]);
  const views = useMemo(
    () => devices.map((device) => sampleDevice(device, locale, t)),
    [devices, locale, t],
  );
  const enrolment = useMemo(() => {
    const secret = enrolledKey(fetched);

    return {
      qr: (
        <Svg
          width={QR_SIDE}
          height={QR_SIDE}
          viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`}
          style={secret === AUTHENTICATOR_KEY ? undefined : styles.otherKey}
        >
          <Path d={qrPath(QR_MODULES)} fill={tokens.colorInk} fillRule="evenodd" />
        </Svg>
      ),
      secret,
      otpauthUri: otpauthLink(secret),
    };
  }, [fetched]);
  const setupKey = enrolmentOf(enrol, enrolment, () => setEnrol('loading'));
  const others = devices.filter((device) => !device.here);
  const provider: Provider = opened === 'apple' ? 'apple' : 'google';
  const way = ways.providers.find((each) => each.provider === provider);
  const openedDevice = devices.find((device) => device.id === opened && !device.here) ?? null;
  const startBlock = start.opened ?? start.inView;

  useEffect(() => {
    if (said != null) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [said]);

  useEffect(() => {
    if (factor !== 'loading') return;
    const loaded = setTimeout(() => setFactor('ready'), loadMs);

    return () => clearTimeout(loaded);
  }, [factor, loadMs]);

  useEffect(() => {
    if (enrol !== 'loading') return;
    const loaded = setTimeout(() => {
      setFetched((count) => count + 1);
      setEnrol('ready');
    }, KEY_LOADING_MS);

    return () => clearTimeout(loaded);
  }, [enrol]);

  useEffect(() => {
    if (factor !== 'ready' || !lineHeld.current) return;
    lineHeld.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => moveScreenReaderFocus(targets.line.current), SETTLED_MS);
  }, [factor, targets]);

  useEffect(() => {
    if (start.finished == null || start.factor === 'ready') return;
    const settled = setTimeout(() => moveScreenReaderFocus(targets.card.current), SETTLED_MS);

    return () => clearTimeout(settled);
  }, [start, targets]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(forgetting.current);
    },
    [],
  );

  useEffect(() => {
    if (startBlock == null) return;
    const frame = requestAnimationFrame(() =>
      bringIntoView(blocks.current[startBlock], scroll.current, clear, false),
    );

    return () => cancelAnimationFrame(frame);
  }, [startBlock, clear]);

  function onBlock(id: string, block: ViewInstance | null): void {
    blocks.current[id] = block;
  }

  function retryFactor(): void {
    lineHeld.current = false;
    setLoadMs(RETRY_MS);
    setFactor('loading');
  }

  function toggle(id: string): void {
    lineHeld.current = false;
    setOpened((now) => (now === id ? null : id));
  }

  function show(next: SecurityScreen, target: Target): void {
    lineHeld.current = false;
    from.current = target;
    setVisit((count) => count + 1);
    setScreen(next);
  }

  function prove(next: Proof, target: Target): void {
    setAsk(null);
    setProof(next);
    show('confirm', target);
  }

  function asking(question: SecurityAsk, block: string, target: Target): void {
    lineHeld.current = false;
    from.current = target;
    setAsk(question);
    bringIntoView(blocks.current[block], scroll.current, clear, true);
  }

  function done(words: string): void {
    lineHeld.current = factor !== 'ready';
    from.current = 'card';
    setSaid(words);
    setOpened(null);
    setAsk(null);
    setScreen(null);
    setProof(null);
  }

  function doneAtOnce(words: string): void {
    done(words);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => moveScreenReaderFocus(targets.card.current), SETTLED_MS);
  }

  function remember(): void {
    setProved(true);
    clearTimeout(forgetting.current);
    forgetting.current = setTimeout(() => setProved(false), PROOF_MINUTES * 60_000);
  }

  function link(which: Provider, atOnce: boolean): void {
    setSample({ ...sample, [which]: true });
    const words = t('security.linkedDone', { provider: PROVIDER_NAME[which] });
    if (atOnce) doneAtOnce(words);
    else done(words);
  }

  function unlink(which: Provider): void {
    setSample({ ...sample, [which]: false });
    done(t('waysCard.unlinkedDone', { provider: PROVIDER_NAME[which] }));
  }

  function signOutOthers(): number {
    setDevices(devices.filter((device) => device.here));

    return others.length;
  }

  function setUp(target: Target): void {
    setCodesFor('setup');
    setEnrol('loading');
    show('setup', target);
  }

  function proven(): void {
    if (proof === 'link' || proof === 'unlink') remember();
    switch (proof) {
      case 'link':
        link(provider, false);
        return;
      case 'unlink':
        unlink(provider);
        return;
      case 'everywhere':
        done(everywhereDone(signOutOthers(), t));
        return;
      case 'turnOff':
        setTwoFactor(false);
        done(t('security.twoFactorOff', { email: SAMPLE.email }));
        return;
      case 'newCodes':
        setCodesLeft(RECOVERY_CODES.length);
        setCodesFor('newCodes');
        show('recovery', 'newCodes');
        return;
      case null:
        return;
    }
  }

  const question = askOf(ask, {
    unlink:
      (opened === 'google' || opened === 'apple') && way != null ? unlinkAsk(way, ways, t) : null,
    turnOff: turnOffAsk(SAMPLE.email, t),
    newCodes: newCodesAsk(t),
    signOut: openedDevice == null ? null : signOutAsk(openedDevice.name, t),
    everywhere: others.length > 0 ? everywhereAsk(others.length, true, t) : null,
  });

  function confirmAsk(): void {
    switch (ask) {
      case 'unlink':
        if (proved) unlink(provider);
        else prove('unlink', 'unlink');
        return;
      case 'turnOff':
        prove('turnOff', 'turnOff');
        return;
      case 'newCodes':
        prove('newCodes', 'newCodes');
        return;
      case 'signOut':
        if (openedDevice == null) return;
        setDevices(devices.filter((device) => device.id !== openedDevice.id));
        done(t('devices.ended', { name: openedDevice.name }));
        return;
      case 'everywhere':
        prove('everywhere', 'everywhere');
        return;
      case null:
        return;
    }
  }

  const asks = proofAsks(proof ?? 'link', provider, sample, twoFactor, t);

  return (
    <>
      <SummaryPage title={t('security.title')} scrollRef={scroll}>
        {factor === 'ready' ? (
          <SecurityCard
            says={cardSays(twoFactor, t)}
            counts={cardCounts(ways, devices.length, t)}
            line={cardLine(said, twoFactor, t)}
            wide={shell.layout === 'portrait'}
            saysRef={targets.card}
            lineRef={targets.line}
            step={
              twoFactor
                ? null
                : {
                    label: t('twoFactorCard.turnOn'),
                    onPress: () => setUp('step'),
                    testID: 'security.step',
                    ref: targets.step,
                  }
            }
          />
        ) : (
          said != null && <AloneLine text={said} lineRef={targets.card} />
        )}
        <WaysSection
          ways={ways}
          rules={rules}
          opened={opened}
          error={null}
          passwordRef={targets.password}
          linkRef={targets.link}
          unlinkRef={targets.unlink}
          onPassword={() => show(ways.password ? 'change' : 'setPassword', 'password')}
          onBlock={onBlock}
          onToggle={toggle}
          onLink={(which) => {
            from.current = 'link';
            if (proved) link(which, true);
            else prove('link', 'link');
          }}
          onUnlink={(which) => asking('unlink', which, 'unlink')}
        />
        {factor !== 'ready' && (
          <Section title={t('twoFactorCard.title')}>
            {factor === 'loading' ? (
              <RowShapes count={1} words={t('pending.loading')} />
            ) : (
              <SectionFailed
                title={t('twoFactorCard.failedTitle')}
                line={t('twoFactorCard.failedBody')}
                onRetry={retryFactor}
                testID="security.retry"
              />
            )}
          </Section>
        )}
        {factor === 'ready' && (
          <TwoFactorSection
            on={twoFactor}
            codesLeft={codesLeft}
            email={SAMPLE.email}
            rules={rules}
            opened={opened}
            error={null}
            setupRef={targets.setup}
            turnOffRef={targets.turnOff}
            newCodesRef={targets.newCodes}
            onSetup={() => setUp('setup')}
            onBlock={onBlock}
            onToggle={toggle}
            onTurnOff={() => asking('turnOff', 'authenticator', 'turnOff')}
            onNewCodes={() => asking('newCodes', 'codes', 'newCodes')}
          />
        )}
        <DevicesSection
          devices={views}
          opened={opened}
          error={null}
          signOutRef={targets.signOut}
          onBlock={onBlock}
          onToggle={toggle}
          onSignOut={(device) => asking('signOut', device.id, 'signOut')}
          onSignOutHere={() => router.replace('/demo/welcome?notice=signedOut')}
        />
        {others.length > 0 && (
          <Everywhere
            everywhereRef={targets.everywhere}
            blockRef={(block) => onBlock(EVERYWHERE, block)}
            onPress={() => asking('everywhere', EVERYWHERE, 'everywhere')}
          />
        )}
      </SummaryPage>
      <Ask
        open={question != null}
        opener={opener}
        title={question?.title ?? ''}
        line={question?.line ?? ''}
        keep={{ label: question?.keep ?? '', testID: `security.${ask ?? 'ask'}.keep` }}
        confirm={{
          label: question?.confirm ?? '',
          testID: `security.${ask ?? 'ask'}.confirm`,
          removes: question?.removes ?? false,
        }}
        onKeep={() => setAsk(null)}
        onConfirm={confirmAsk}
        testID={`security.${ask ?? 'ask'}`}
      />
      <ChangePasswordScreen
        key={`change.${visit}`}
        open={screen === 'change' || screen === 'forgot' || screen === 'forgotSent'}
        start={changeStageOf(screen)}
        email={SAMPLE.email}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={(current, next) => {
          const refused = changeRefusal(current, next);
          if (refused == null) done(t('passwordCard.done', { count: signOutOthers() }));

          return Promise.resolve(refused);
        }}
        onSend={() => Promise.resolve(null)}
      />
      <SetPasswordScreen
        key={`set.${visit}`}
        open={screen === 'setPassword' || screen === 'setPasswordExpired'}
        email={SAMPLE.email}
        startExpired={screen === 'setPasswordExpired'}
        setting={{
          send: () => Promise.resolve(RESEND_SECONDS),
          pass: (code) => Promise.resolve(emailedCodeRefusal(code)),
          save: (password) => {
            const refused = chooseRefusal(password);
            if (refused == null) {
              setSample({ ...sample, password: true });
              done(t('passwordCard.added', { provider: linked(ways)[0]?.name ?? '' }));
            }

            return Promise.resolve(refused);
          },
        }}
        opener={opener}
        onClose={() => setScreen(null)}
      />
      <ConfirmScreen
        key={`confirm.${visit}`}
        open={screen === 'confirm' && proof != null}
        asks={asks}
        opener={opener}
        onClose={() => {
          setScreen(null);
          setProof(null);
        }}
        onContinue={(password, code) => sampleContinue(asks, proven)(password, code)}
        testID="security.confirm"
      />
      <DemoTwoFactorScreen
        key={`twoFactor.${visit}`}
        open={screen === 'setup' || screen === 'recovery'}
        enrolment={setupKey}
        startCodes={screen === 'recovery' ? RECOVERY_CODES : null}
        phone={shell.layout === 'phone'}
        takesLinks={start.takesLinks}
        {...(visit === 0
          ? {
              startTyped: start.typed,
              startError: start.typed === '' ? null : setupRefusal(start.typed),
              startHanded: start.handed,
            }
          : {})}
        opener={opener}
        onClose={() => setScreen(null)}
        onTurnOn={(code) => {
          const refused = setupRefusal(code);
          if (refused != null) return Promise.resolve({ error: refused });
          setTwoFactor(true);
          setCodesLeft(RECOVERY_CODES.length);

          return Promise.resolve({ codes: RECOVERY_CODES });
        }}
        onFinished={() =>
          done(codesFor === 'setup' ? t('security.twoFactorOn') : t('security.newCodesDone'))
        }
      />
    </>
  );
}

function enrolmentOf(
  enrol: Factor,
  ready: DemoEnrolment,
  retry: () => void,
): DemoEnrolment | { retry: () => void } | null {
  if (enrol === 'ready') return ready;

  return enrol === 'failed' ? { retry } : null;
}

function askOf(
  ask: SecurityAsk | null,
  words: Record<SecurityAsk, AskWords | null>,
): AskWords | null {
  return ask == null ? null : words[ask];
}

function changeStageOf(screen: SecurityScreen | null): ChangeStage {
  if (screen === 'forgot') return 'forgot';

  return screen === 'forgotSent' ? 'sent' : 'change';
}

function startTarget(start: SecurityStart): Target {
  if (start.ask != null) return start.ask;
  switch (start.screen) {
    case 'change':
    case 'forgot':
    case 'forgotSent':
    case 'setPassword':
    case 'setPasswordExpired':
      return 'password';
    case 'confirm':
      return 'link';
    case 'setup':
      return 'step';
    case 'recovery':
    case null:
      return 'card';
  }
}

const styles = StyleSheet.create({
  otherKey: { transform: [{ scaleX: -1 }] },
});
