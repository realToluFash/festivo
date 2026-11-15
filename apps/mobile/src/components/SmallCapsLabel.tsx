import { StyleSheet } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { tracking } from '../theme/tracking.ts';
import { Text, type TextProps } from './Text.tsx';

/** The small caps label the [fd] boards head a card or a group with, announced as a heading. */
export function SmallCapsLabel({ style, ...rest }: Omit<TextProps, 'size' | 'weight' | 'muted'>) {
  return (
    <Text
      size={tokens.typeLabel.size}
      weight="semibold"
      muted
      accessibilityRole="header"
      style={[styles.title, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { letterSpacing: tracking(tokens.typeLabel), textTransform: 'uppercase' },
});
