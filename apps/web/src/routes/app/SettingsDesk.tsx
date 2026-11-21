import type { ReactNode } from 'react';
import { Outlet, useOutletContext } from 'react-router';

import { SettingsList } from '../../components/SettingsList.tsx';
import { useDeskTop } from '../../deskTop.ts';

/** Settings at a desk: the Settings list, then the open section's page in the rest of the width (Web-Settings). */
export function SettingsDesk() {
  const standIn = useOutletContext<ReactNode>();
  const desk = useDeskTop();

  return (
    <div className="settings-desk">
      <SettingsList />
      <div className="settings-desk-page">
        {standIn == null ? (
          <Outlet />
        ) : (
          <>
            {desk.offline}
            {desk.said}
            {standIn}
          </>
        )}
      </div>
    </div>
  );
}
