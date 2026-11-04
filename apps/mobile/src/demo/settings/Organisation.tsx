import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Organisation, in B: drawn on its own board on page 29. */
export function OrganisationSection() {
  return (
    <SettingsPage title="Organisation">
      <Card>
        <CardHead title="Organisation" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
