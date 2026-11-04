import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Your account, in B: drawn on its own board on page 29. */
export function AccountSection() {
  return (
    <SettingsPage title="Your account">
      <Card>
        <CardHead title="Your account" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
