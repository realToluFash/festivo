import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Notification settings, in B: drawn on its own board on page 29. */
export function NotificationsSection() {
  return (
    <SettingsPage title="Notification settings">
      <Card>
        <CardHead title="Notification settings" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
