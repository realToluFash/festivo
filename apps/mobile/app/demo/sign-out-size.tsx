import { useLocalSearchParams } from 'expo-router';

import { headerLanguageOf, headerSizeOf } from '../../src/demo/focusedHeader/focusedHeaderRules.ts';
import { SignOutSizeScreen } from '../../src/demo/signOutSize/SignOutSizeScreen.tsx';

export default function DemoSignOutSize() {
  const { size, lang } = useLocalSearchParams<{ size?: string; lang?: string }>();
  const start = { size: headerSizeOf(size), language: headerLanguageOf(lang) };

  return <SignOutSizeScreen key={JSON.stringify(start)} start={start} />;
}
