import { useLocalSearchParams } from 'expo-router';

import { PillFitScreen } from '../../src/demo/pillFit/PillFitScreen.tsx';
import {
  languageOf,
  organisationOf,
  sendingOf,
  waitingOf,
} from '../../src/demo/pillFit/pillFitRules.ts';

export default function DemoPillFit() {
  const { lang, org, waiting, sending } = useLocalSearchParams<{
    lang?: string;
    org?: string;
    waiting?: string;
    sending?: string;
  }>();
  const start = {
    language: languageOf(lang),
    organisation: organisationOf(org),
    waiting: waitingOf(waiting),
    sending: sendingOf(sending),
  };

  return <PillFitScreen key={JSON.stringify(start)} start={start} />;
}
