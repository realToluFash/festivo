import { useMemo } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { SettingsRoute } from '../settings/Route.tsx';
import {
  SETTINGS_WORDS,
  type SettingsWords,
  SettingsWordsContext,
} from '../settings/SettingsHome.tsx';
import { YOU } from '../settings/sample.ts';

const ROLES: Readonly<Record<string, string>> = {
  Owner: 'Propietario',
  Admin: 'Administrador',
  Member: 'Miembro',
};

/** main's es.json, the board's Spanish state. Personalisation and the Design demo row have no Spanish there, so they stay as the demo has them. */
const SPANISH: SettingsWords = {
  title: 'Configuración',
  headings: { yourAccount: 'Su cuenta', organisationHeading: 'Organización' },
  rows: {
    security: {
      title: 'Seguridad',
      line: 'Contraseña, formas de iniciar sesión, verificación en dos pasos y dispositivos con sesión abierta',
    },
    notifications: {
      title: 'Notificaciones',
      line: 'Push y correo electrónico, para cada tipo de notificación',
    },
    personalisation: SETTINGS_WORDS.rows.personalisation,
    organisation: {
      title: YOU.organisation,
      line: 'Nombre, dirección de contacto, moneda, zona horaria',
    },
    members: { title: 'Miembros', line: 'Quién forma parte y con qué rol' },
    signInRules: {
      title: 'Normas de inicio de sesión',
      line: 'Cómo se inicia sesión y durante cuánto tiempo',
    },
  },
  role: (role) => ROLES[role] ?? role,
  signOut: 'Cerrar sesión',
};

/** The real Settings page in Spanish: its own words from the table above, and what it reads from es.json (the tab bar) in Spanish too. */
export function BoldTextSpanish() {
  const { i18n } = useTranslation();
  const spanish = useMemo(() => i18n.cloneInstance({ lng: 'es', initAsync: false }), [i18n]);

  return (
    <I18nextProvider i18n={spanish}>
      <SettingsWordsContext.Provider value={SPANISH}>
        <SettingsRoute section={null} />
      </SettingsWordsContext.Provider>
    </I18nextProvider>
  );
}
