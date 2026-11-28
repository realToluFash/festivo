import { type Href, router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { ConfettiSwitch } from '../../components/ConfettiSwitch.tsx';
import { PaneWithBack } from '../../components/DataParts.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import {
  Ask,
  CardSays,
  Line,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { writtenTime } from '../clock.ts';
import { dataHref } from './DataModel.ts';
import { SeenBy } from './Frame.tsx';
import { memberLooking } from './sample.ts';
import { SsoForm, type Refused } from './SingleSignOnForm.tsx';
import {
  askKept,
  changeAsked,
  changeStarted,
  FIELD_OF,
  type FieldKey,
  firstProblem,
  picked,
  providerOf,
  removeAsked,
  removed,
  requiredConfirmed,
  requiredSwitched,
  requiredTurnedOff,
  retyped,
  rulesHref,
  savePressed,
  serverRefusal,
  setsIt,
  setupCancelled,
  type SsoCard,
  type SsoModel,
  ssoCard,
  ssoOwns,
  ssoStart,
  ssoStateOf,
  type SsoState,
  standingOf,
  switched,
  testCame,
  testStarted,
  testStopped,
  withSaved,
} from './SingleSignOnModel.ts';
import { BrowserStandIn, CardTag, ProtocolLine, Refusal } from './SingleSignOnParts.tsx';
import { SummaryPage } from './SummaryPage.tsx';
import { SSO_WORDS as W } from './SingleSignOnWords.ts';

const SEND_MS = 600;

type Opened = 'step' | 'switch' | 'required' | 'testAgain' | 'change' | 'remove';
const JULIEN = 'julien@ire.events';

function clock(): string {
  return writtenTime(new Date(), 'en-GB');
}

/** Sign-in rules › Single sign-on (sc-610): an owner connects the identity provider, tests it, then switches it on. */
export function SingleSignOnSection() {
  const params = useLocalSearchParams<{ state?: string; as?: string; plan?: string }>();
  const state = ssoStateOf(params.state);
  const owns = ssoOwns(state, params.as);
  const plan = params.plan === 'free' ? 'free' : 'enterprise';
  const looking = useMemo(() => memberLooking(JULIEN), []);
  const page = <SsoPage key={`${state}:${String(owns)}:${plan}`} {...{ state, owns, plan }} />;

  return owns ? page : <SeenBy looking={looking}>{page}</SeenBy>;
}

function SsoSubPage({ model, children }: { model: SsoModel; children: ReactNode }) {
  const shell = useShell();
  const toRules = () => {
    const href = rulesHref(standingOf(model)) as Href;
    if (shell.layout === 'landscape') router.replace(href);
    else router.dismissTo(href);
  };
  const back = { label: W.back, onPress: toRules };

  if (shell.layout !== 'landscape')
    return (
      <SummaryPage title={W.title} back={back}>
        {children}
      </SummaryPage>
    );

  return (
    <SummaryPage>
      <PaneWithBack title={W.title} back={back}>
        <View style={styles.pane}>{children}</View>
      </PaneWithBack>
    </SummaryPage>
  );
}

function SsoPage({
  state,
  owns,
  plan,
}: {
  state: SsoState;
  owns: boolean;
  plan: 'enterprise' | 'free';
}) {
  const shell = useShell();
  const tell = shell.tell;
  const phone = shell.layout === 'phone';
  const [start] = useState(() => ssoStart(state, { owns, plan, at: clock() }));
  const [model, setModel] = useState(start.model);
  const [refused, setRefused] = useState<Refused>(start.refused);
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stepRef = useRef<ViewInstance>(null);
  const switchRef = useRef<ViewInstance>(null);
  const requiredRef = useRef<ViewInstance>(null);
  const testAgainRef = useRef<ViewInstance>(null);
  const changeRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ViewInstance>(null);
  const last = useRef<Opened>('step');
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(() => {
    const refs: Record<Opened, RefObject<ViewInstance | null>> = {
      step: stepRef,
      switch: switchRef,
      required: requiredRef,
      testAgain: testAgainRef,
      change: changeRef,
      remove: removeRef,
    };

    return {
      get current() {
        return refs[last.current].current;
      },
    };
  }, []);
  const pressed = (key: Opened, then: (now: SsoModel) => SsoModel) => {
    last.current = key;
    setModel(then);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (start.model.toast != null) tell(start.model.toast);
  }, [start, tell]);

  const card = ssoCard(model);
  const provider = model.provider;
  const name = provider?.name ?? '';
  const setup = owns && setsIt(model) ? model.setup : null;
  const go = (step: NonNullable<SsoCard['step']>) => {
    if (step.go === 'test') pressed('step', testStarted);
    else if (step.go === 'plans') tell(W.plansToast);
    else router.push(dataHref('emailDomains', { state: 'ed_add' }) as Href);
  };
  const save = (focus: (field: FieldKey, refusal: boolean) => void) => {
    const next = savePressed(model);
    const now = next.setup;
    if (now?.protocol == null) return;
    const protocol = now.protocol;
    setModel(next);
    setRefused(null);
    const first = firstProblem(protocol, now.problems);
    if (first != null) {
      focus(first, false);
      return;
    }
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      const refusal = serverRefusal(protocol, now.typed);
      if (refusal != null) {
        setRefused(refusal);
        focus(refusal.field, true);
        return;
      }
      setModel((then) => withSaved(then, providerOf(protocol, now.typed)));
    }, SEND_MS);
  };

  return (
    <>
      <SsoSubPage model={model}>
        {setup == null && card != null && (
          <SummaryCard
            size={shell.layout === 'portrait' ? 'wide' : 'page'}
            height={card.step == null ? 170 : 210}
            step={
              card.step == null
                ? null
                : {
                    label: card.step.label,
                    onPress: () => card.step != null && go(card.step),
                    ref: stepRef,
                    testID: 'sso.step',
                  }
            }
            testID="sso.card"
          >
            <CardTag mark={card.mark} word={card.word} />
            <CardSays text={card.says} size={shell.layout === 'landscape' ? 26 : 24} heading />
            {card.lines.map((line) => (
              <OnCard key={line} text={line} />
            ))}
          </SummaryCard>
        )}
        {(setup == null || provider == null) && <Line text={W.intro} />}
        {setup != null && (
          <SsoForm
            key={visit}
            setup={setup}
            refused={refused}
            busy={busy}
            phone={phone}
            note={model.on && provider != null ? W.changeNote(provider.name) : null}
            cancels={provider != null}
            tell={tell}
            onPick={(protocol) => {
              setRefused(null);
              setModel((now) => picked(now, protocol));
            }}
            onType={(patch) => {
              const touched = Object.keys(patch).map((key) => FIELD_OF[key as keyof typeof patch]);
              if (refused != null && touched.includes(refused.field)) setRefused(null);
              setModel((now) => retyped(now, patch));
            }}
            onSave={save}
            onCancel={() => {
              setRefused(null);
              setModel(setupCancelled);
            }}
          />
        )}
        {setup == null && provider != null && setsIt(model) && (
          <Section title={W.provider} foot={owns ? undefined : W.notOwner}>
            <RowList
              items={[
                {
                  key: 'provider',
                  row: (
                    <Row
                      title={provider.name}
                      below={<ProtocolLine protocol={provider.protocol} source={provider.source} />}
                    />
                  ),
                },
                {
                  key: 'switch',
                  row: (
                    <Row
                      title={W.switchName}
                      line={model.on ? W.onRow(name) : W.switchLine}
                      trail={
                        <View ref={switchRef}>
                          <ConfettiSwitch
                            on={model.on}
                            label={W.switchName}
                            locked={!owns}
                            stacked={phone}
                            onChange={(next) => pressed('switch', (now) => switched(now, next))}
                            testID="sso.switch"
                          />
                        </View>
                      }
                    />
                  ),
                },
                ...(model.refusal === 'untested' || model.refusal === 'switchOff'
                  ? [
                      {
                        key: 'refusal',
                        row: (
                          <Refusal
                            words={model.refusal === 'untested' ? W.untested : W.switchOffRefused}
                            step={
                              model.refusal === 'untested'
                                ? { label: W.test, onPress: () => pressed('switch', testStarted) }
                                : {
                                    label: W.turnOffRequired,
                                    onPress: () => setModel(requiredTurnedOff),
                                  }
                            }
                            testID="sso.switch.refused"
                          />
                        ),
                      },
                    ]
                  : []),
                ...(model.on
                  ? [
                      {
                        key: 'required',
                        row: (
                          <Row
                            title={W.requiredName}
                            line={W.requiredLine(name)}
                            trail={
                              <View ref={requiredRef}>
                                <ConfettiSwitch
                                  on={model.required}
                                  label={W.requiredName}
                                  locked={!owns}
                                  stacked={phone}
                                  onChange={(next) =>
                                    pressed('required', (now) => requiredSwitched(now, next))
                                  }
                                  testID="sso.required"
                                />
                              </View>
                            }
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {owns && (
              <View style={styles.actions}>
                {(model.test === 'passed' || model.on) && (
                  <TextAction
                    ref={testAgainRef}
                    label={W.testAgain}
                    onPress={() => pressed('testAgain', testStarted)}
                    testID="sso.testAgain"
                  />
                )}
                <TextAction
                  ref={changeRef}
                  label={W.change}
                  onPress={() => {
                    last.current = 'change';
                    if (!model.on) setVisit((now) => now + 1);
                    setModel(changeAsked);
                  }}
                  testID="sso.change"
                />
                <TextAction
                  ref={removeRef}
                  label={W.remove(name)}
                  removes
                  onPress={() => pressed('remove', removeAsked)}
                  testID="sso.remove"
                />
              </View>
            )}
            {model.refusal === 'remove' && (
              <Refusal
                words={W.removeRefused(name)}
                step={{ label: W.turnOffRequired, onPress: () => setModel(requiredTurnedOff) }}
                testID="sso.remove.refused"
              />
            )}
          </Section>
        )}
        {!owns && (provider == null || !setsIt(model)) && <Line text={W.notOwner} />}
      </SsoSubPage>
      <Ask
        open={model.ask === 'required'}
        opener={opener}
        title={W.requiredAsk.title(name)}
        line={W.requiredAsk.lines(name)[0] ?? ''}
        body={<Line text={W.requiredAsk.lines(name)[1] ?? ''} />}
        keep={{ label: W.requiredAsk.keep, testID: 'sso.required.keep' }}
        confirm={{ label: W.requiredAsk.confirm, testID: 'sso.required.confirm' }}
        onKeep={() => setModel(askKept)}
        onConfirm={() => setModel(requiredConfirmed)}
        testID="sso.requiredAsk"
      />
      <Ask
        open={model.ask === 'change'}
        opener={opener}
        title={W.changeAsk.title}
        line={W.changeAsk.line(name)}
        keep={{ label: W.changeAsk.keep(name), testID: 'sso.change.keep' }}
        confirm={{ label: W.changeAsk.confirm, testID: 'sso.change.confirm' }}
        onKeep={() => setModel(askKept)}
        onConfirm={() => {
          setVisit((now) => now + 1);
          setModel(changeStarted);
        }}
        testID="sso.changeAsk"
      />
      <Ask
        open={model.ask === 'remove'}
        opener={opener}
        title={W.removeAsk.title(name)}
        line={W.removeAsk.line}
        keep={{ label: W.removeAsk.keep(name), testID: 'sso.remove.keep' }}
        confirm={{ label: W.removeAsk.confirm(name), removes: true, testID: 'sso.remove.confirm' }}
        onKeep={() => setModel(askKept)}
        onConfirm={() => {
          setVisit((now) => now + 1);
          setModel(removed);
          tell(W.removed(name));
        }}
        testID="sso.removeAsk"
      />
      <BrowserStandIn
        open={model.test === 'running'}
        title={W.testing}
        name={name}
        opener={opener}
        stop={W.stopTesting}
        checks
        onCame={(came) => setModel((now) => testCame(now, came, clock()))}
        onStop={() => setModel(testStopped)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pane: { gap: 18 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    paddingTop: tokens.spaceSm,
  },
});
