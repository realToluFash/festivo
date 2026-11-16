import { type ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { FieldError } from './Field.tsx';
import { fieldFocused, fieldLeft } from './focusedField.ts';
import { Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';

/** A typed field as the event's boards draw it: the label and any Optional, the box, then its error or its help. */
export function EventField({
  label,
  optional,
  error = null,
  help,
  children,
}: {
  label: string;
  /** The word Optional, for a field that may be left empty. */
  optional?: string | undefined;
  error?: string | null;
  help?: string | undefined;
  children: ReactNode;
}) {
  const field = useRef<ViewInstance>(null);
  useEffect(() => {
    const mounted = field.current;

    return () => fieldLeft(mounted);
  }, []);

  return (
    <View
      ref={field}
      onFocus={() => fieldFocused(field.current)}
      onBlur={() => fieldLeft(field.current)}
      style={styles.labelled}
    >
      <View
        style={styles.fieldHead}
        accessible
        accessibilityLabel={optional == null ? label : `${label}, ${optional}`}
      >
        <Text size={14} weight="semibold" style={styles.label}>
          {label}
        </Text>
        {optional != null && (
          <Text size={14} weight="medium" style={[styles.secondary, styles.label]}>
            {` · ${optional}`}
          </Text>
        )}
      </View>
      {children}
      {error != null ? (
        <FieldError message={error} />
      ) : (
        help != null && (
          <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
            {help}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  fieldHead: { flexDirection: 'row', flexWrap: 'wrap' },
  labelled: { gap: 7 },
  label: { lineHeight: 14 * 1.3 },
  hint: { lineHeight: 13.5 * 1.4 },
});
