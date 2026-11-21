import { withBoldText } from '../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../src/demo/settings/Route.tsx';

function DemoSettingsScreen() {
  return <SettingsRoute section={null} />;
}

export default withBoldText(DemoSettingsScreen);
