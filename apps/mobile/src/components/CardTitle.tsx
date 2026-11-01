import { StyleSheet } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { tracking } from '../theme/tracking.ts';
import { Text, type TextProps } from './Text.tsx';

/** An Account card's heading, in the small caps label the [fd] board gives every card (sc-23283). */
export function CardTitle({ style, ...rest }: Omit<TextProps, 'size' | 'weight' | 'muted'>) {
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
