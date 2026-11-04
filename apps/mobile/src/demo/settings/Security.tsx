import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Security, in B: drawn on its own board on page 29. */
export function SecuritySection() {
  return (
    <SettingsPage title="Security">
      <Card>
        <CardHead title="Security" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
