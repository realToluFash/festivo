import { useLocalSearchParams } from 'expo-router';

import { PillFitScreen } from '../../src/demo/pillFit/PillFitScreen.tsx';
import {
  languageOf,
  largestOf,
  organisationOf,
  sendingOf,
  waitingOf,
} from '../../src/demo/pillFit/pillFitRules.ts';

export default function DemoPillFit() {
  const { lang, org, waiting, sending, size } = useLocalSearchParams<{
    lang?: string;
    org?: string;
    waiting?: string;
    sending?: string;
    size?: string;
  }>();
  const start = {
    language: languageOf(lang),
    organisation: organisationOf(org),
    waiting: waitingOf(waiting),
    sending: sendingOf(sending),
    largest: largestOf(size),
  };

  return <PillFitScreen key={JSON.stringify(start)} start={start} />;
}
