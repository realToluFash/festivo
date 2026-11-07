import { router, useLocalSearchParams } from 'expo-router';
import { createRef, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import type { TextHandle } from '../../components/Text.tsx';
import { ConfirmScreen } from './AccountConfirm.tsx';
import { SecurityCard } from './SecurityCard.tsx';
import { DevicesSection, Everywhere } from './SecurityDevices.tsx';
import {
  type AskWords,
  cardCounts,
  cardLine,
  cardSays,
  everywhereAsk,
  NEW_CODES_ASK,
  type Proof,
  proofAsks,
  RESULTS,
  type SecurityAsk,
  type SecurityScreen,
  type SecurityStart,
  securityStart,
  securityStateOf,
  signOutAsk,
  TURN_OFF_ASK,
  unlinkAsk,
  WORDS,
} from './SecurityModel.ts';
import { ChangePasswordScreen, type ChangeStage, SetPasswordScreen } from './SecurityPassword.tsx';
import {
  DEVICES,
  type Device,
  PROOF_MINUTES,
  type Provider,
  RECOVERY_CODES,
} from './SecuritySample.ts';
import { TwoFactorScreen, TwoFactorSection } from './SecurityTwoFactor.tsx';
import { WaysSection } from './SecurityWays.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import { Ask, bringIntoView, useRowClear } from '../../components/Summary.tsx';

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

/** Settings › Security in B, summary first, on sample data that stays on the device. */
export function SecuritySection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = securityStateOf(state);

  return <SecurityPage key={name} start={securityStart(name)} />;
}

function SecurityPage({ start }: { start: SecurityStart }) {
  const shell = useShell();
  const clear = useRowClear();
  const { rules } = start;
  const [ways, setWays] = useState(start.ways);
  const [twoFactor, setTwoFactor] = useState(start.twoFactor);
  const [codesLeft, setCodesLeft] = useState(start.codesLeft);
  const [devices, setDevices] = useState<readonly Device[]>(DEVICES);
  const [said, setSaid] = useState<string | null>(null);
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
  const others = devices.filter((device) => !device.here);
  const provider: Provider = opened === 'Apple' ? 'Apple' : 'Google';
  const openedDevice = devices.find((device) => device.id === opened && !device.here) ?? null;
  const startBlock = start.opened ?? start.inView;

  useEffect(() => {
    if (said != null) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [said]);

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

  function show(next: SecurityScreen, target: Target): void {
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
    from.current = target;
    setAsk(question);
    bringIntoView(blocks.current[block], scroll.current, clear, true);
  }

  function done(words: string): void {
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
    setWays({ ...ways, [which]: true });
    if (atOnce) doneAtOnce(RESULTS.linked(which));
    else done(RESULTS.linked(which));
  }

  function unlink(which: Provider): void {
    setWays({ ...ways, [which]: false });
    done(RESULTS.unlinked(which));
  }

  function signOutOthers(): number {
    setDevices(devices.filter((device) => device.here));

    return others.length;
  }

  function setUp(target: Target): void {
    setCodesFor('setup');
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
        done(RESULTS.everywhere(signOutOthers()));
        return;
      case 'turnOff':
        setTwoFactor(false);
        done(RESULTS.twoFactorOff);
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
    unlink: opened === 'Google' || opened === 'Apple' ? unlinkAsk(provider, ways) : null,
    signOut: openedDevice == null ? null : signOutAsk(openedDevice),
    everywhere: others.length > 0 ? everywhereAsk(others.length) : null,
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
        done(RESULTS.signedOut(openedDevice));
        return;
      case 'everywhere':
        prove('everywhere', 'everywhere');
        return;
      case null:
        return;
    }
  }

  return (
    <>
      <SummaryPage title={WORDS.title} scrollRef={scroll}>
        <SecurityCard
          says={cardSays(twoFactor)}
          counts={cardCounts(ways, devices.length)}
          line={cardLine(said, twoFactor)}
          wide={shell.layout === 'portrait'}
          saysRef={targets.card}
          step={
            twoFactor
              ? null
              : {
                  label: WORDS.turnOn,
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
          passwordRef={targets.password}
          linkRef={targets.link}
          unlinkRef={targets.unlink}
          onPassword={() => show(ways.password ? 'change' : 'setPassword', 'password')}
          onBlock={onBlock}
          onToggle={(id) => setOpened((now) => (now === id ? null : id))}
          onLink={(which) => {
            from.current = 'link';
            if (proved) link(which, true);
            else prove('link', 'link');
          }}
          onUnlink={(which) => asking('unlink', which, 'unlink')}
        />
        <TwoFactorSection
          on={twoFactor}
          codesLeft={codesLeft}
          rules={rules}
          opened={opened}
          setupRef={targets.setup}
          turnOffRef={targets.turnOff}
          newCodesRef={targets.newCodes}
          onSetup={() => setUp('setup')}
          onBlock={onBlock}
          onToggle={(id) => setOpened((now) => (now === id ? null : id))}
          onTurnOff={() => asking('turnOff', 'authenticator', 'turnOff')}
          onNewCodes={() => asking('newCodes', 'codes', 'newCodes')}
        />
        <DevicesSection
          devices={devices}
          opened={opened}
          signOutRef={targets.signOut}
          onBlock={onBlock}
          onToggle={(id) => setOpened((now) => (now === id ? null : id))}
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
        opener={opener}
        onClose={() => setScreen(null)}
        onSaved={() => done(RESULTS.passwordChanged(signOutOthers()))}
      />
      <SetPasswordScreen
        key={`set.${visit}`}
        open={screen === 'setPassword' || screen === 'setPasswordExpired'}
        start={screen === 'setPasswordExpired' ? 'expired' : 'entering'}
        opener={opener}
        onClose={() => setScreen(null)}
        onSaved={() => {
          const next = { ...ways, password: true };
          setWays(next);
          done(RESULTS.passwordAdded(next));
        }}
      />
      <ConfirmScreen
        key={`confirm.${visit}`}
        open={screen === 'confirm' && proof != null}
        asks={proofAsks(proof ?? 'link', provider, ways, twoFactor)}
        opener={opener}
        onClose={() => {
          setScreen(null);
          setProof(null);
        }}
        onProved={proven}
        testID="security.confirm"
      />
      <TwoFactorScreen
        key={`twoFactor.${visit}`}
        open={screen === 'setup' || screen === 'recovery'}
        start={screen === 'recovery' ? 'codes' : 'setup'}
        phone={shell.layout === 'phone'}
        opener={opener}
        onClose={() => setScreen(null)}
        onTurnedOn={() => {
          setTwoFactor(true);
          setCodesLeft(RECOVERY_CODES.length);
        }}
        onFinished={() => done(codesFor === 'setup' ? RESULTS.twoFactorOn : RESULTS.newCodes)}
      />
    </>
  );
}

function askOf(
  ask: SecurityAsk | null,
  words: Record<'unlink' | 'signOut' | 'everywhere', AskWords | null>,
): AskWords | null {
  switch (ask) {
    case 'turnOff':
      return TURN_OFF_ASK;
    case 'newCodes':
      return NEW_CODES_ASK;
    case null:
      return null;
    default:
      return words[ask];
  }
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
