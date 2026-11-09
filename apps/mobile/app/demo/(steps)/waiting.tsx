import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { QuietButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { LifecycleSheet } from '../../../src/components/LifecycleSheet.tsx';
import { Notice } from '../../../src/components/Notice.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import {
  type Answer,
  CLOSED,
  NOT_CANCELLED,
  askToCancel,
  cancelSettled,
  keepWaiting,
  pressCancel,
} from '../../../src/demo/lostAuth.ts';
import { DemoOnly, Heading, Plain } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

const ANSWERS = [
  ['Confirm', 'approved'],
  ['Turn it down', 'turnedDown'],
  ['Let it end', 'ended'],
  ['Ask from another device', 'replaced'],
] as const;

/** The answers sc-29961 says close the sheet: approved, turned down, replaced from another device. */
const WHILE_ASKED: readonly string[] = ['approved', 'turnedDown', 'replaced'];

const CANCEL_MS = 700;
const LOOK_MS = 20_000;

/** Answers given while this screen has not looked yet: the next look finds them, and a cancel that reaches Soirely first shows them (sc-30737). */
const ANSWERED_FIRST: readonly (readonly [string, Answer])[] = [
  ['Confirm', 'approved'],
  ['Turn it down', 'turnedDown'],
  ['Let it end', 'ended'],
  ['Ask from another device', 'replaced'],
];

/** Waiting in plain lines; with nobody left to confirm (`?state=nobody`), the title and line send the person to Soirely support and the request stays open (sc-29072); the screen changes by itself, which the demo's buttons stand in for. Cancel the request asks first (sc-29961), and says so when it does not go through (sc-30737). */
export default function Waiting() {
  const params = useLocalSearchParams<{ email?: string; state?: string }>();
  const email = params.email ?? SAMPLE.email;
  const phone = useLayout().kind === 'phone';
  const opener = useRef<ViewInstance>(null);
  const [asked, setAsked] = useState<object | null>(
    params.state === 'cancel' || params.state === 'notCancelled' ? {} : null,
  );
  const [sheet, setSheet] = useState(() =>
    params.state === 'notCancelled'
      ? { ...askToCancel(), notCancelled: true }
      : params.state === 'cancel'
        ? askToCancel()
        : CLOSED,
  );
  const [reachable, setReachable] = useState(true);
  const [nobody, setNobody] = useState(params.state === 'nobody');
  const [support, setSupport] = useState(false);
  const [answered, setAnswered] = useState<Answer | null>(null);
  const end = useCallback(
    (kind: string) => {
      setAsked(null);
      setSheet(CLOSED);
      router.replace({ pathname: '/demo/ending', params: { kind, email } });
    },
    [email],
  );

  useEffect(() => {
    if (!sheet.sending) return;
    const timer = setTimeout(() => {
      const settled = cancelSettled(sheet, reachable, answered);
      if (typeof settled === 'string') end(settled);
      else setSheet(settled);
    }, CANCEL_MS);

    return () => clearTimeout(timer);
  }, [answered, end, reachable, sheet]);

  const firstLabel = ANSWERED_FIRST.find(([, kind]) => kind === answered)?.[0];

  useEffect(() => {
    if (answered == null) return;
    const look = setTimeout(() => end(answered), LOOK_MS);

    return () => clearTimeout(look);
  }, [answered, end]);

  return (
    <DemoScreen
      nav={<NavBar left="close" step={[3, 3]} />}
      foot={
        <View style={styles.foot}>
          <Text size={tokens.typeBodyPhone.size} weight="semibold">
            This wasn’t you?
          </Text>
          <QuietButton
            ref={opener}
            label="Cancel the request"
            onPress={() => {
              setAsked({});
              setSheet(askToCancel());
            }}
            testID="demo.cancel"
          />
        </View>
      }
    >
      <Heading
        mark={['progress', 'Waiting for an answer']}
        title={nobody ? 'Contact Soirely support' : `Waiting for ${SAMPLE.organisation}`}
        intro={
          nobody
            ? 'Nobody in your organisation can confirm this. Contact Soirely support.'
            : `We’ve asked the owners and admins of ${SAMPLE.organisation} to confirm it’s you. One answer is enough.`
        }
      />
      <Plain top={tokens.spaceXxl} ink>
        {`Asked ${SAMPLE.askedAt}. If nobody answers by ${SAMPLE.endsAt}, the request ends.`}
      </Plain>
      <Plain top={tokens.spaceLg}>
        {`You stay signed out until somebody answers. We’ll email ${email} either way, and this screen changes by itself.`}
      </Plain>
      {nobody && (
        <View style={styles.ways}>
          <SecondaryButton
            label="Email Soirely support"
            onPress={() => setSupport(true)}
            testID="demo.support"
          />
        </View>
      )}
      {support && (
        <Plain top={tokens.spaceLg}>In the build, this opens a new email to Soirely support.</Plain>
      )}
      <DemoOnly title="Demo: who is left to confirm">
        <SecondaryButton
          label={nobody ? 'An owner or admin joins' : 'The last owner or admin leaves'}
          onPress={() => {
            setNobody(!nobody);
            setSupport(false);
          }}
          testID="demo.nobody"
        />
      </DemoOnly>
      <DemoOnly title={`Demo: answer as ${SAMPLE.organisation}`}>
        {ANSWERS.map(([label, kind]) => (
          <SecondaryButton
            key={kind}
            label={label}
            onPress={() => end(kind)}
            testID={`demo.answer.${kind}`}
          />
        ))}
      </DemoOnly>
      <LifecycleSheet
        phone={phone}
        open={sheet.open}
        opener={opener}
        testID="demo.cancelAsk"
        title="Cancel your request?"
        lines={['You’ll need to start again to get back in.']}
        confirm={{
          label: 'Cancel the request',
          keep: 'Keep waiting',
          pending: sheet.sending,
          ends: true,
          onGo: () => setSheet(pressCancel(sheet)),
        }}
        retold={asked ?? undefined}
        scrimLabel="Keep waiting"
        onClose={() => {
          const kept = keepWaiting(sheet);
          setSheet(kept);
          if (!kept.open) setAsked(null);
        }}
      >
        {sheet.notCancelled && (
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={NOT_CANCELLED} announce />
        )}
        <DemoOnly title={`Demo: answer as ${SAMPLE.organisation} while this is open`}>
          {ANSWERS.filter(([, kind]) => WHILE_ASKED.includes(kind)).map(([label, kind]) => (
            <SecondaryButton
              key={kind}
              label={label}
              onPress={() => end(kind)}
              testID={`demo.cancelAsk.answer.${kind}`}
            />
          ))}
        </DemoOnly>
        <DemoOnly
          title={`Demo: ${SAMPLE.organisation} answers before the cancel arrives${firstLabel == null ? '' : ` · ${firstLabel}`}`}
        >
          {ANSWERED_FIRST.map(([label, kind]) => (
            <SecondaryButton
              key={kind}
              label={label}
              onPress={() => setAnswered(kind)}
              testID={`demo.cancelAsk.first.${kind}`}
            />
          ))}
        </DemoOnly>
        <DemoOnly title="Demo: the connection">
          <SecondaryButton
            label={reachable ? 'Lose it' : 'Bring it back'}
            onPress={() => setReachable(!reachable)}
            testID="demo.cancelAsk.connection"
          />
        </DemoOnly>
      </LifecycleSheet>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  foot: { alignItems: 'center', gap: tokens.spaceXs },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
});
