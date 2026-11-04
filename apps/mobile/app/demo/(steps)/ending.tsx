import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import type { MarkTone } from '../../../src/components/StatusMark.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { Heading, Plain } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

interface Ending {
  mark?: [MarkTone, string];
  title: string;
  intro: string;
  note?: string;
  button: string;
}

const ORG = SAMPLE.organisation;

const ENDINGS: Record<string, Ending> = {
  approved: {
    mark: ['done', 'Confirmed'],
    title: 'Two-factor is off',
    intro: `Somebody in ${ORG} confirmed it was you. Every session you had has ended. Sign in, then set it up again.`,
    button: 'Sign in',
  },
  turnedDown: {
    mark: ['broken', 'Turned down'],
    title: 'Your request was turned down',
    intro: `Two-factor is still on, so you can’t sign in without it. Ask an owner or admin of ${ORG}, or contact Soirely support.`,
    button: 'Email Soirely support',
  },
  ended: {
    mark: ['skipped', 'Ended'],
    title: 'Your request ended',
    intro: 'Nobody answered within 7 days. Two-factor is still on. You can ask again.',
    button: 'Ask again',
  },
  cancelled: {
    mark: ['skipped', 'Cancelled'],
    title: 'Request cancelled',
    intro: 'Nothing changed. Two-factor is still on.',
    button: 'Back to sign in',
  },
  replaced: {
    mark: ['skipped', 'Replaced'],
    title: 'A newer request replaced this one',
    intro: 'A newer request was started on another device. Start again to ask from here.',
    note: 'Starting again sends new codes here and ends the request on the other device. It counts as one of your 3 requests a day.',
    button: 'Start again',
  },
  nobody: {
    title: 'Contact Soirely support',
    intro: 'Nobody in your organisation can confirm this. Contact Soirely support.',
    button: 'Email Soirely support',
  },
};

/** Every ending is the mark, a title, one line and one button. */
export default function LostEnding() {
  const params = useLocalSearchParams<{ kind?: string; email?: string }>();
  const email = params.email ?? SAMPLE.email;
  const ending = ENDINGS[params.kind ?? 'approved'] ?? ENDINGS.approved!;
  const [support, setSupport] = useState(false);

  function next(): void {
    switch (params.kind) {
      case 'turnedDown':
      case 'nobody':
        setSupport(true);
        return;
      case 'ended':
      case 'replaced':
        router.replace({ pathname: '/demo/lost', params: { email } });
        return;
      case 'cancelled':
        router.replace({ pathname: '/demo/sign-in', params: { email } });
        return;
      default:
        router.replace({ pathname: '/demo/sign-in', params: { email, after: 'tfaAgain' } });
    }
  }

  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={<PrimaryButton label={ending.button} onPress={next} testID="demo.next" />}
    >
      <Heading
        {...(ending.mark != null && { mark: ending.mark })}
        title={ending.title}
        intro={ending.intro}
      />
      {ending.note != null && <Plain top={tokens.spaceXl}>{ending.note}</Plain>}
      {support && (
        <Plain top={tokens.spaceXl}>In the build, this opens a new email to Soirely support.</Plain>
      )}
    </DemoScreen>
  );
}
