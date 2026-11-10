import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { CodeField, Field, focusChecked, focusRefused } from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { RoleChoices } from '../../components/RoleChoices.tsx';
import {
  firstName,
  grantable,
  type MembersViewer,
  ORGANISATION,
  type Person,
  PROOF_MINUTES,
  ROLE_MEANS,
  proofProblem,
  underRoles,
} from './MembersSample.ts';
import { type AskProps, FocusedScreen, Line } from '../../components/Summary.tsx';

export const TAKES_EFFECT = 'Takes effect on their next request. Nobody is signed out.';
const OWNER_ASKS = 'Asks for your password and a code.';
const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

/** Change role on its own screen: only the roles the viewer may give, and an owner made here asks for proof first. */
export function RoleScreen({
  person,
  viewer,
  open,
  startsProving,
  startsPicked,
  proved,
  opener,
  onProved,
  onClose,
  onChange,
}: {
  person: Person;
  viewer: MembersViewer;
  open: boolean;
  startsProving: boolean;
  startsPicked: string | null;
  proved: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onProved: () => void;
  onClose: () => void;
  onChange: (role: string) => void;
}) {
  const current = person.role ?? '';
  const [picked, setPicked] = useState(startsPicked ?? current);
  const [proving, setProving] = useState(startsProving);
  const [discarding, setDiscarding] = useState(false);
  const [problem, setProblem] = useState<ReturnType<typeof proofProblem>>(null);
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const changed = picked !== current;
  const first = firstName(person);

  function save(): void {
    if (picked === 'Owner' && !proved) setProving(true);
    else onChange(picked);
  }

  function prove(): void {
    const found = proofProblem(password.current, code.current, SAMPLE);
    if (found == null) {
      onProved();
      onChange(picked);
      return;
    }
    setProblem(found);
    const field = found.field === 'password' ? passwordInput : codeInput;
    const blank = (found.field === 'password' ? password.current : code.current.trim()) === '';
    // A blank is the client's check; a wrong password or code stands in for the server's refusal.
    if (blank) focusChecked(field);
    else focusRefused(field);
  }

  const ask: AskProps | null = discarding
    ? {
        title: 'Discard your change?',
        line: `${person.name} stays ${current}.`,
        keep: { label: 'Keep editing', testID: 'members.role.keep' },
        confirm: { label: 'Discard', testID: 'members.role.discard', removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;

  const nav = proving
    ? {
        title: `Make ${first} an owner`,
        verb: { label: 'Make owner', on: true, onPress: prove, testID: 'members.prove.continue' },
        cancel: () => {
          setProblem(null);
          setProving(false);
        },
        cancelTestID: 'members.prove.cancel',
      }
    : {
        title: `${first}'s role`,
        verb: { label: 'Save', on: changed, onPress: save, testID: 'members.role.save' },
        cancel: () => (changed ? setDiscarding(true) : onClose()),
        cancelTestID: 'members.role.cancel',
      };

  return (
    <FocusedScreen
      open={open}
      title={nav.title}
      verb={nav.verb}
      onCancel={nav.cancel}
      cancelTestID={nav.cancelTestID}
      opener={opener}
      ask={ask}
    >
      {proving ? (
        <>
          <Line
            text={`To make somebody an owner of ${ORGANISATION}, confirm it's you. You won't be asked again for ${PROOF_MINUTES} minutes.`}
          />
          <View style={styles.fields}>
            <Field
              label={PASSWORD_LABEL}
              error={problem?.field === 'password' ? problem.message : null}
            >
              <PasswordField
                ref={passwordInput}
                wrong={problem?.field === 'password'}
                autoComplete="current-password"
                textContentType="password"
                onChangeText={(text) => {
                  password.current = text;
                }}
                returnKeyType="next"
                onSubmitEditing={() => codeInput.current?.focus()}
                submitBehavior="submit"
                accessibilityLabel={PASSWORD_LABEL}
                testID="members.prove.password"
              />
            </Field>
            <Field
              label={CODE_LABEL}
              error={problem?.field === 'code' ? problem.message : null}
              help="From your authenticator app, or one of your recovery codes."
            >
              <CodeField
                ref={codeInput}
                takesRecoveryCode
                wrong={problem?.field === 'code'}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                onChangeText={(text) => {
                  code.current = text;
                }}
                returnKeyType="done"
                onSubmitEditing={prove}
                submitBehavior="submit"
                accessibilityLabel={CODE_LABEL}
                testID="members.prove.code"
              />
            </Field>
          </View>
        </>
      ) : (
        <>
          <Line
            text={
              changed
                ? `${person.name} becomes ${picked} on their next request. Nobody is signed out.`
                : TAKES_EFFECT
            }
          />
          <View accessibilityRole="radiogroup">
            <RoleChoices
              roles={grantable(viewer)}
              picked={picked}
              now={person.role == null ? null : { role: person.role, word: 'Now' }}
              owned={{ role: 'Owner', line: OWNER_ASKS }}
              lines={ROLE_MEANS}
              onPick={setPicked}
              testID="members.role"
            />
          </View>
          <Line text={underRoles(viewer)} size={14} />
        </>
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.spaceXl, paddingTop: tokens.spaceXs },
});
