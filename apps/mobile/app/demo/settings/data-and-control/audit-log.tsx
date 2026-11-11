import { withBoldText } from '../../../../src/demo/boldText/BoldTextSwitch.tsx';
import { SettingsRoute } from '../../../../src/demo/settings/Route.tsx';

function DemoAuditLogScreen() {
  return <SettingsRoute section={null} data="auditLog" />;
}

export default withBoldText(DemoAuditLogScreen);
