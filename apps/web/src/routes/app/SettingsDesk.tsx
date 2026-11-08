import { Outlet } from 'react-router';

import { SettingsList } from '../../components/SettingsList.tsx';

/** Settings at a desk: the Settings list, then the open section's page in the rest of the width (Web-Settings). */
export function SettingsDesk() {
  return (
    <div className="settings-desk">
      <SettingsList />
      <div className="settings-desk-page">
        <Outlet />
      </div>
    </div>
  );
}
