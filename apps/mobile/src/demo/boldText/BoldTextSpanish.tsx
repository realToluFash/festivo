import { useMemo } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { SettingsRoute } from '../settings/Route.tsx';

/** The real Settings page in Spanish: every word from es.json, as the app shows it. */
export function BoldTextSpanish() {
  const { i18n } = useTranslation();
  const spanish = useMemo(() => i18n.cloneInstance({ lng: 'es', initAsync: false }), [i18n]);

  return (
    <I18nextProvider i18n={spanish}>
      <SettingsRoute section={null} />
    </I18nextProvider>
  );
}
