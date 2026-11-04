import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Members, in B: drawn on its own board on page 29. */
export function MembersSection() {
  return (
    <SettingsPage title="Members">
      <Card>
        <CardHead title="Members" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
