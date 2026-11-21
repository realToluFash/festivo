import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import {
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Line, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { Code } from './DataParts.tsx';
import {
  type FieldKey,
  firstProblem,
  formProblems,
  type MetadataWay,
  type Protocol,
  SAMPLE_FILE,
  type Setup,
  type Typed,
} from './SingleSignOnModel.ts';
import { OurValues, ProtocolCards, Stack } from './SingleSignOnParts.tsx';
import { SSO_WORDS as W } from './SingleSignOnWords.ts';

export type Refused = { field: FieldKey; words: string } | null;

type Inputs = Record<Exclude<FieldKey, 'metadata'> | 'url', RefObject<TextInputInstance | null>>;

/** One form for both protocols: pick how it connects, fill what that needs, give the provider Soirely's values, then Save. */
export function SsoForm({
  setup,
  refused,
  busy,
  phone,
  note,
  cancels,
  tell,
  onPick,
  onType,
  onSave,
  onCancel,
}: {
  setup: Setup;
  refused: Refused;
  busy: boolean;
  phone: boolean;
  note: string | null;
  cancels: boolean;
  tell: (words: string) => void;
  onPick: (protocol: Protocol) => void;
  onType: (patch: Partial<Typed>) => void;
  onSave: (focus: (field: FieldKey, refusal: boolean) => void) => void;
  onCancel: () => void;
}) {
  const inputs: Inputs = {
    name: useRef<TextInputInstance>(null),
    url: useRef<TextInputInstance>(null),
    issuer: useRef<TextInputInstance>(null),
    clientId: useRef<TextInputInstance>(null),
    secret: useRef<TextInputInstance>(null),
  };
  const [shown, setShown] = useState(false);
  const [picking, setPicking] = useState(false);
  const { protocol, typed, problems } = setup;
  const wrong = (field: FieldKey) =>
    problems[field] ?? (refused?.field === field ? refused.words : null);
  const focus = (field: FieldKey, refusal: boolean) => {
    const input = field === 'metadata' ? (typed.way === 'url' ? inputs.url : null) : inputs[field];
    if (input == null) return;
    if (refusal) focusRefused(input);
    else focusChecked(input);
  };
  const save = () => {
    if (busy || protocol == null) return;
    const problem = firstProblem(protocol, formProblems(protocol, typed));
    if (problem == null) keysStayDown();
    onSave(focus);
  };
  const field = (
    key: Exclude<FieldKey, 'metadata'> | 'url',
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options: {
      help?: string;
      error: string | null;
      secret?: boolean;
      url?: boolean;
      last?: boolean;
    },
  ) => (
    <Field
      label={label}
      error={options.error}
      help={options.help}
      labelAction={
        options.secret === true
          ? {
              label: shown ? W.hide : W.show,
              onPress: () => setShown((now) => !now),
              testID: 'sso.secret.show',
            }
          : undefined
      }
    >
      <TextField
        ref={inputs[key]}
        value={value}
        onChangeText={onChangeText}
        wrong={options.error != null}
        submitting={busy}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType={options.url === true ? 'url' : 'default'}
        secureTextEntry={options.secret === true && !shown}
        returnKeyType={options.last === true ? 'done' : 'next'}
        onSubmitEditing={options.last === true ? save : undefined}
        submitBehavior={options.last === true ? 'submit' : 'blurAndSubmit'}
        accessibilityLabel={label}
        testID={`sso.field.${key}`}
      />
    </Field>
  );

  return (
    <Stack>
      {note != null && <Line quiet={false} text={note} />}
      <Text size={15} weight="bold" accessibilityRole="header">
        {W.protocols}
      </Text>
      <ProtocolCards picked={protocol} off={busy} onPick={onPick} />
      {protocol != null && (
        <>
          {field('name', W.name, typed.name, (name) => onType({ name }), {
            help: W.nameHelp,
            error: wrong('name'),
            last: false,
          })}
          {protocol === 'saml' ? (
            <Metadata
              typed={typed}
              error={wrong('metadata')}
              picking={picking}
              busy={busy}
              onWay={(way) => onType({ way })}
              onPick={() => {
                setPicking(true);
                onType({ file: SAMPLE_FILE });
              }}
              url={field('url', W.url, typed.url, (url) => onType({ url }), {
                help: W.urlHelp,
                error: wrong('metadata'),
                url: true,
                last: true,
              })}
            />
          ) : (
            <>
              {field('issuer', W.issuer, typed.issuer, (issuer) => onType({ issuer }), {
                help: W.issuerHelp,
                error: wrong('issuer'),
                url: true,
              })}
              {field('clientId', W.clientId, typed.clientId, (clientId) => onType({ clientId }), {
                error: wrong('clientId'),
              })}
              {field('secret', W.secret, typed.secret, (secret) => onType({ secret }), {
                error: wrong('secret'),
                secret: true,
                last: true,
              })}
            </>
          )}
          <OurValues protocol={protocol} tell={tell} />
        </>
      )}
      {(protocol != null || cancels) && (
        <View style={phone ? styles.buttonsPhone : styles.buttons}>
          {protocol != null && (
            <PrimaryButton
              label={busy ? W.saving : W.save}
              busy={busy}
              grow={!phone}
              onPress={save}
              testID="sso.save"
            />
          )}
          <SecondaryButton
            label={W.cancel}
            off={busy}
            stacked={phone}
            paired={!phone}
            onPress={onCancel}
            testID="sso.cancel"
          />
        </View>
      )}
    </Stack>
  );
}

function Metadata({
  typed,
  error,
  picking,
  busy,
  onWay,
  onPick,
  url,
}: {
  typed: Typed;
  error: string | null;
  picking: boolean;
  busy: boolean;
  onWay: (way: MetadataWay) => void;
  onPick: () => void;
  url: ReactNode;
}) {
  return (
    <View style={styles.metadata}>
      <Text size={tokens.typeButton.size} weight="medium">
        {W.metadata}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.ways}>
        {(['url', 'file'] as const).map((way) => (
          <Pressable
            key={way}
            onPress={() => onWay(way)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: typed.way === way, disabled: busy }}
            accessibilityLabel={W.ways[way]}
            style={({ pressed }) => [styles.way, pressed && styles.pressed]}
            testID={`sso.way.${way}`}
          >
            <RadioMark on={typed.way === way} />
            <Text size={15} weight="semibold" accessible={false}>
              {W.ways[way]}
            </Text>
          </Pressable>
        ))}
      </View>
      {typed.way === 'url' ? (
        url
      ) : (
        <Field label={W.ways.file} error={error}>
          <View style={styles.file}>
            {typed.file != null && <Code text={typed.file} size={15} />}
            <TextAction
              label={typed.file == null ? W.chooseFile : W.chooseAnother}
              glyph="clipboard"
              off={busy}
              onPress={onPick}
              testID="sso.file"
            />
          </View>
          {picking && <DemoOnly title={W.fileDemo}>{null}</DemoOnly>}
        </Field>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceSm,
  },
  buttonsPhone: { gap: tokens.spaceSm, paddingTop: tokens.spaceSm },
  metadata: { gap: tokens.spaceXs },
  ways: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXl },
  way: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  pressed: { opacity: tokens.opacityPressed },
  file: { gap: tokens.spaceXxs, alignItems: 'flex-start' },
});
