import { useLocalSearchParams } from 'expo-router';

import { withBoldText } from '../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute, sectionOfSlug } from '../../../src/demo/settings/Route.tsx';

function DemoSettingsSectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();

  return <SettingsRoute section={sectionOfSlug(section)} />;
}

export default withBoldText(DemoSettingsSectionScreen);
