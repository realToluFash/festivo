import { withBoldText } from '../../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../../src/demo/settings/Route.tsx';

function DemoEmailDomainsScreen() {
  return <SettingsRoute section={null} data="emailDomains" />;
}

export default withBoldText(DemoEmailDomainsScreen);
