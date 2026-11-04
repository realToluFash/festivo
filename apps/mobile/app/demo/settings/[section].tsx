import { useLocalSearchParams } from 'expo-router';

import { SettingsRoute, sectionOfSlug } from '../../../src/demo/settings/Route.tsx';

export default function DemoSettingsSectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();

  return <SettingsRoute section={sectionOfSlug(section)} />;
}
