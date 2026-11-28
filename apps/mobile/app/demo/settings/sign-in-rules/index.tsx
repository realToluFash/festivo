import { withBoldText } from '../../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../../src/demo/settings/Route.tsx';

function DemoSignInRulesScreen() {
  return <SettingsRoute section="signInRules" />;
}

export default withBoldText(DemoSignInRulesScreen);
