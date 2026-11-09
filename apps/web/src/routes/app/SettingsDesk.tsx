import type { ReactNode } from 'react';
import { Outlet, useOutletContext } from 'react-router';

import { SettingsList } from '../../components/SettingsList.tsx';

/** Settings at a desk: the Settings list, then the open section's page in the rest of the width (Web-Settings). */
export function SettingsDesk() {
  const standIn = useOutletContext<ReactNode>();

  return (
    <div className="settings-desk">
      <SettingsList />
      <div className="settings-desk-page">{standIn ?? <Outlet />}</div>
    </div>
  );
}
