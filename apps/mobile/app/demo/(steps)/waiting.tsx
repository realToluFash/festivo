import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ViewInstance } from 'react-native';

import { QuietButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { LifecycleSheet } from '../../../src/components/LifecycleSheet.tsx';
import { Notice } from '../../../src/components/Notice.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import {
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
  ['Nobody can confirm', 'nobody'],
] as const;

/** The answers sc-29961 says close the sheet: approved, turned down, replaced from another device. */
const WHILE_ASKED: readonly string[] = ['approved', 'turnedDown', 'replaced'];

const CANCEL_MS = 700;

/** Waiting in plain lines; the screen changes by itself, which the demo's buttons stand in for. Cancel the request asks first (sc-29961), and says so when it does not go through (sc-30737). */
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
      const settled = cancelSettled(sheet, reachable);
      if (settled === 'cancelled') end('cancelled');
      else setSheet(settled);
    }, CANCEL_MS);

    return () => clearTimeout(timer);
  }, [end, reachable, sheet]);

  return (
    <DemoScreen
      nav={<NavBar left="close" step={[3, 3]} />}
      foot={
        <QuietButton
          ref={opener}
          label="Cancel the request"
          onPress={() => {
            setAsked({});
            setSheet(askToCancel());
          }}
          testID="demo.cancel"
        />
      }
    >
      <Heading
        mark={['progress', 'Waiting for an answer']}
        title={`Waiting for ${SAMPLE.organisation}`}
        intro={`We’ve asked the owners and admins of ${SAMPLE.organisation} to confirm it’s you. One answer is enough.`}
      />
      <Plain top={tokens.spaceXxl} ink>
        {`Asked ${SAMPLE.askedAt}. If nobody answers by ${SAMPLE.endsAt}, the request ends.`}
      </Plain>
      <Plain top={tokens.spaceLg}>
        {`You stay signed out until somebody answers. We’ll email ${email} either way, and this screen changes by itself.`}
      </Plain>
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
        testID="demo.cancelSheet"
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
              testID={`demo.cancelSheet.answer.${kind}`}
            />
          ))}
        </DemoOnly>
        <DemoOnly title="Demo: the connection">
          <SecondaryButton
            label={reachable ? 'Lose it' : 'Bring it back'}
            onPress={() => setReachable(!reachable)}
            testID="demo.cancelSheet.connection"
          />
        </DemoOnly>
      </LifecycleSheet>
    </DemoScreen>
  );
}
