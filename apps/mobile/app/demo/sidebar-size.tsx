import { useLocalSearchParams } from 'expo-router';

import { SidebarSizeScreen } from '../../src/demo/sidebarSize/SidebarSizeScreen.tsx';
import {
  sidebarAtOf,
  sidebarLanguageOf,
  sidebarOrgOf,
  sidebarSizeOf,
  sidebarWaitingOf,
} from '../../src/demo/sidebarSize/sidebarSizeRules.ts';

export default function DemoSidebarSize() {
  const { size, lang, at, org, waiting } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    at?: string;
    org?: string;
    waiting?: string;
  }>();
  const start = {
    size: sidebarSizeOf(size),
    language: sidebarLanguageOf(lang),
    at: sidebarAtOf(at),
    org: sidebarOrgOf(org),
    waiting: sidebarWaitingOf(waiting),
  };

  return <SidebarSizeScreen key={JSON.stringify(start)} start={start} />;
}
