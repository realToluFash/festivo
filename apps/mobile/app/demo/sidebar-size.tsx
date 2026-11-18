import { useLocalSearchParams } from 'expo-router';

import { SidebarSizeScreen } from '../../src/demo/sidebarSize/SidebarSizeScreen.tsx';
import {
  sidebarAtOf,
  sidebarLanguageOf,
  sidebarSizeOf,
} from '../../src/demo/sidebarSize/sidebarSizeRules.ts';

export default function DemoSidebarSize() {
  const { size, lang, at } = useLocalSearchParams<{ size?: string; lang?: string; at?: string }>();
  const start = {
    size: sidebarSizeOf(size),
    language: sidebarLanguageOf(lang),
    at: sidebarAtOf(at),
  };

  return <SidebarSizeScreen key={JSON.stringify(start)} start={start} />;
}
