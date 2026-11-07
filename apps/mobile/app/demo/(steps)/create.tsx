import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { useReadOut } from '../../../src/components/ReadOut.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { createOpening } from '../../../src/demo/signUp.ts';
import { FieldLine, InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Says } from '../../../src/steps/Lines.tsx';
import { emailLooksRight, passwordLongEnough } from '../../../src/steps/rules.ts';
import { tokens } from '../../../src/theme/tokens.ts';

type Blank = { field: 'name' | 'email' | 'password'; words: string } | null;

export default function CreateAccount() {
  const { after, ...params } = useLocalSearchParams<{
    after?: string;
    state?: string;
    name?: string;
    email?: string;
  }>();
  const [opening] = useState(() => createOpening(params));
  const [name, setName] = useState(opening.name);
  const [email, setEmail] = useState(opening.email);
  const [password, setPassword] = useState('');
  const [blank, setBlank] = useState<Blank>(null);
  // Said without moving focus from Password; it goes once Create account is pressed (sc-29923).
  const [line, setLine] = useState(opening.line);
  const nameField = useRef<TextInputInstance>(null);
  const emailField = useRef<TextInputInstance>(null);
  const passwordField = useRef<TextInputInstance>(null);
  const long = passwordLongEnough(password);

  function refuse(next: NonNullable<Blank>): void {
    setBlank(next);
    const field = { name: nameField, email: emailField, password: passwordField }[next.field];
    field.current?.focus();
  }

  useReadOut(line);

  function create(): void {
    setLine(null);
    if (name.trim() === '') return refuse({ field: 'name', words: 'Enter your name.' });
    if (email.trim() === '') return refuse({ field: 'email', words: 'Enter your email address.' });
    if (!emailLooksRight(email))
      return refuse({ field: 'email', words: 'Enter an email address like name@example.com.' });
    if (!long) return refuse({ field: 'password', words: '' });
    router.push({
      pathname: '/demo/email-code',
      params: { email: email.trim(), after: after ?? '' },
    });
  }

  const typed =
    (field: NonNullable<Blank>['field'], set: (text: string) => void) => (text: string) => {
      set(text);
      if (blank?.field === field) setBlank(null);
    };

  return (
    <DemoScreen
      nav={<NavBar step={[1, 4]} />}
      foot={<PrimaryButton label="Create account" onPress={create} testID="demo.createAccount" />}
    >
      <Heading title="Create your account" {...(line != null && { intro: line })} />
      <View style={styles.first}>
        <InsideField
          ref={nameField}
          label="Full name"
          value={name}
          onChangeText={typed('name', setName)}
          state={blank?.field === 'name' ? 'blank' : 'plain'}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailField.current?.focus()}
          autoFocus={opening.focus === 'name'}
          testID="demo.name"
        />
        {blank?.field === 'name' && <Says words={blank.words} />}
      </View>
      <View style={styles.next}>
        <InsideField
          ref={emailField}
          label="Email"
          value={email}
          onChangeText={typed('email', setEmail)}
          state={blank?.field === 'email' ? 'blank' : 'plain'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordField.current?.focus()}
          testID="demo.email"
        />
        {blank?.field === 'email' && <Says words={blank.words} />}
      </View>
      <View style={styles.next}>
        <InsideField
          ref={passwordField}
          label="Password"
          value={password}
          onChangeText={typed('password', setPassword)}
          password
          state={blank?.field === 'password' ? 'blank' : 'plain'}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={create}
          autoFocus={opening.focus === 'password'}
          testID="demo.password"
        />
        <FieldLine
          words="At least 15 characters"
          tone={long ? 'met' : blank?.field === 'password' ? 'wrong' : 'unmet'}
        />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXl },
});
