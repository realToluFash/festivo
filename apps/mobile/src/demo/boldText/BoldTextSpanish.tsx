import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Caps, Tile, TYPE } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { YOU } from '../settings/sample.ts';

type Tiled = 'security' | 'notifications' | 'organisation' | 'members' | 'signInRules';

/** main's es.json, the board's Spanish state: this is the one place the demo is not in English. */
const GROUPS: readonly {
  heading: string;
  rows: readonly { of: Tiled; title: string; line: string; initials?: string }[];
}[] = [
  {
    heading: 'Su cuenta',
    rows: [
      {
        of: 'security',
        title: 'Seguridad',
        line: 'Contraseña, formas de iniciar sesión, verificación en dos pasos y dispositivos con sesión abierta',
      },
      {
        of: 'notifications',
        title: 'Notificaciones',
        line: 'Push y correo electrónico, para cada tipo de notificación',
      },
    ],
  },
  {
    heading: 'Organización',
    rows: [
      {
        of: 'organisation',
        title: YOU.organisation,
        line: 'Nombre, dirección de contacto, moneda, zona horaria',
        initials: 'IE',
      },
      { of: 'members', title: 'Miembros', line: 'Quién forma parte y con qué rol' },
      {
        of: 'signInRules',
        title: 'Normas de inicio de sesión',
        line: 'Cómo se inicia sesión y durante cuánto tiempo',
      },
    ],
  },
];

export function BoldTextSpanish() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + ORGANISATION_ROW,
          paddingBottom: insets.bottom + tokens.spaceLg,
        },
      ]}
    >
      <Text size={TYPE.titlePhone} weight="bold" accessibilityRole="header" style={styles.title}>
        Configuración
      </Text>
      {GROUPS.map(({ heading, rows }, group) => (
        <View key={heading}>
          <Caps text={heading} top={group === 0 ? tokens.spaceXxl : tokens.spaceXl} />
          <View style={styles.group}>
            {rows.map(({ of, title, line, initials }) => (
              <View key={of} style={styles.row} accessible accessibilityLabel={`${title}. ${line}`}>
                <Tile of={of} side={36} initials={initials} />
                <View style={styles.words}>
                  <Text size={TYPE.row} weight="semibold" accessible={false}>
                    {title}
                  </Text>
                  <Text
                    size={TYPE.small}
                    weight="medium"
                    accessible={false}
                    style={styles.secondary}
                  >
                    {line}
                  </Text>
                </View>
                <Glyph name="chevron" size={18} ink={tokens.colorInkTertiary} weight={2.2} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Where Settings draws the organisation's pill: the title stays where it is on the real page. */
const ORGANISATION_ROW = 64;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  content: { paddingHorizontal: tokens.spaceXxl },
  title: { letterSpacing: -0.5 },
  group: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    padding: tokens.spaceXxs,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  secondary: { color: tokens.colorInkSecondary },
});
