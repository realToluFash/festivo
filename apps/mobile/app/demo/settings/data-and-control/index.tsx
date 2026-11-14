import { withBoldText } from '../../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../../src/demo/settings/Route.tsx';

function DemoDataAndControlScreen() {
  return <SettingsRoute section={null} data="hub" />;
}

export default withBoldText(DemoDataAndControlScreen);
