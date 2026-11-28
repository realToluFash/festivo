import { withBoldText } from '../../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../../src/demo/settings/Route.tsx';

function DemoSingleSignOnScreen() {
  return <SettingsRoute section="signInRules" sso />;
}

export default withBoldText(DemoSingleSignOnScreen);
