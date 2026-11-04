import { nameToSave } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { RowPill, StepPill } from './AccountParts.tsx';
import { Card, CardHead, Pair } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

const NAME_LABEL = 'Full name';

export function NameCard({
  layout,
  name,
  startEditing,
  onSaved,
}: {
  layout: SettingsLayout;
  name: string;
  startEditing: boolean;
  onSaved: (name: string) => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const typed = useRef(name);

  function open(): void {
    typed.current = name;
    setSaved(null);
    setError(null);
    setEditing(true);
  }

  function save(): void {
    const next = nameToSave(typed.current, name);

    if (next.kind === 'blank') {
      setError('Enter your name.');
      return;
    }
    if (next.kind === 'changed') {
      onSaved(next.name);
      setSaved(next.name);
    }
    setEditing(false);
  }

  if (!editing)
    return (
      <Card>
        <CardHead title="Name" />
        {saved != null && (
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={`Name changed to ${saved}.`}
            announce
          />
        )}
        <View style={styles.line}>
          <Text size={17} weight="medium" style={styles.name}>
            {name}
          </Text>
          <RowPill label="Change" onPress={open} accessibilityLabel="Change your name" />
        </View>
      </Card>
    );

  return (
    <Card>
      <CardHead title="Name" />
      <Field label={NAME_LABEL} error={error}>
        <TextField
          defaultValue={name}
          wrong={error != null}
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
          onChangeText={(text) => {
            typed.current = text;
            if (error != null) setError(null);
          }}
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={NAME_LABEL}
          testID="demo.account.name"
        />
      </Field>
      <Pair
        layout={layout}
        dismiss={
          <StepPill
            layout={layout}
            label="Cancel"
            kind="secondary"
            onPress={() => {
              setError(null);
              setEditing(false);
            }}
          />
        }
        confirm={<StepPill layout={layout} label="Save name" onPress={save} />}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  name: { flex: 1, minWidth: 0 },
});
