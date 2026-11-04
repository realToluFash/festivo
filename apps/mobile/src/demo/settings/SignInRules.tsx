import { Card, CardHead } from './parts.tsx';
import { SettingsPage } from './Frame.tsx';

/** Sign-in rules, in B: drawn on its own board on page 29. */
export function SignInRulesSection() {
  return (
    <SettingsPage title="Sign-in rules">
      <Card>
        <CardHead title="Sign-in rules" line="This section is being built in the demo." />
      </Card>
    </SettingsPage>
  );
}
