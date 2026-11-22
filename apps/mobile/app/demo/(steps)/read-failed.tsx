import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { PrimaryButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { DemoOnly, Heading } from '../../../src/steps/Lines.tsx';

/** Reading the reset link failed on the server: nothing is said about the link, and Try again reads it again. */
export default function ReadFailed() {
  const [trying, setTrying] = useState(false);
  const [next, setNext] = useState<Href | null>(null);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    if (!trying) return;
    const timer = setTimeout(() => {
      setTrying(false);
      if (next == null) setFailures((count) => count + 1);
      else router.replace(next);
    }, 900);

    return () => clearTimeout(timer);
  }, [next, trying]);

  function read(then: Href | null): void {
    if (trying) return;
    setNext(then);
    setTrying(true);
  }

  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={
        <PrimaryButton
          label={trying ? 'Trying again…' : 'Try again'}
          busy={trying}
          onPress={() => read(null)}
          testID="demo.tryAgain"
        />
      }
    >
      <Heading
        title="That did not work"
        intro="Something went wrong on the way. Try again in a moment."
        answer={failures === 0 ? undefined : failures}
      />
      <DemoOnly title="Demo: what the next read gets">
        <SecondaryButton
          label="A live link"
          onPress={() => read('/demo/new-password')}
          testID="demo.readLive"
        />
        <SecondaryButton
          label="A dead link"
          onPress={() => read('/demo/link-expired')}
          testID="demo.readDead"
        />
        <SecondaryButton
          label="No answer"
          onPress={() => read('/demo/unreachable?back=/demo/read-failed')}
          testID="demo.readNoAnswer"
        />
      </DemoOnly>
    </DemoScreen>
  );
}
