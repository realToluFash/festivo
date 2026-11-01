import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The kit only holds if screens cannot quietly go around it, so its rules are read from the source.
const KIT_STYLES = [
  'cta',
  'ctaOff',
  'ctaBusy',
  'input',
  'inputWrong',
  'inputWithReveal',
  'reveal',
  'code',
  'fieldError',
  'mark',
  'footnote',
  'footnoteAction',
  'card',
  'brandRow',
  'phoneContent',
  'portraitContent',
  'landscapeContent',
];
const KIT_FIELDS = ['TextField', 'PasswordField', 'CodeField'];

describe('every field carries the caret colour', () => {
  it('in every TextInput in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      selfClosing('TextInput', text)
        .filter((tag) => !caretSet(tag.markup))
        .map((tag) => `${path}:${tag.line}`),
    );

    expect(
      offenders,
      'Spread FIELD_DEFAULTS, codeProps() or passwordProps() from src/kit/fields.ts.',
    ).toEqual([]);
  });

  it('notices a TextInput that leaves the caret to the platform', () => {
    expect(
      selfClosing('TextInput', '<TextInput\n  style={styles.input}\n/>').filter(
        (tag) => !caretSet(tag.markup),
      ),
    ).toHaveLength(1);
    expect(selfClosing('TextInput', 'const input = useRef<TextInputInstance>(null);')).toHaveLength(
      0,
    );
    expect(
      selfClosing('TextInput', '<TextInput {...FIELD_DEFAULTS} style={x} />').filter(
        (tag) => !caretSet(tag.markup),
      ),
    ).toHaveLength(0);
  });
});

describe('the account cards share one frame', () => {
  it('draws the card frame only in cardFrame.ts', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('cardFrame.ts'))
      .filter(({ text }) => /padding: tokens\.space3xl, maxWidth: 640\b/u.test(text))
      .map(({ path }) => path);

    expect(offenders, 'Use cardFrame(kind) from src/components/cardFrame.ts.').toEqual([]);
  });
});

describe('screen reader focus moves on both platforms', () => {
  it('is moved only in screenReaderFocus.ts', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/screenReaderFocus.ts'))
      .filter(({ text }) => movesFocus(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Use moveScreenReaderFocus(view) from src/components/screenReaderFocus.ts.',
    ).toEqual([]);
  });

  it('notices a screen that moves focus itself', () => {
    expect(movesFocus('if (node != null) AccessibilityInfo.setAccessibilityFocus(node);')).toBe(
      true,
    );
    expect(movesFocus("AccessibilityInfo.sendAccessibilityEvent(view, 'focus');")).toBe(true);
    expect(movesFocus('moveScreenReaderFocus(ref.current);')).toBe(false);
  });
});

describe('a message is read out on both platforms', () => {
  // VoiceOver has no live region, and Fabric flattens away a layout-only View along with its live region, so a message marked with one can be silent (sc-10955).
  it('is marked only in ReadOut.tsx', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/ReadOut.tsx'))
      .filter(({ text }) => readsOut(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Use ReadOut, useReadOut or readOut from src/components/ReadOut.tsx.',
    ).toEqual([]);
  });

  it('notices a screen that marks a message itself', () => {
    expect(readsOut('<View accessibilityLiveRegion="polite">')).toBe(true);
    expect(readsOut('<Text style={styles.error} aria-live="polite">')).toBe(true);
    expect(readsOut('AccessibilityInfo.announceForAccessibility(words);')).toBe(true);
    expect(readsOut('<ReadOut words={saved}>')).toBe(false);
  });
});

describe('a screen reader skips the initials beside a name', () => {
  it('on both platforms, in every tile in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      [...text.matchAll(/<Initials\b/gu)]
        .filter(
          (match) => !hiddenTile(text.slice(text.lastIndexOf('<View', match.index), match.index)),
        )
        .map((match) => `${path}:${text.slice(0, match.index).split('\n').length}`),
    );

    expect(offenders).toEqual([]);
  });

  it('draws them only through Initials.tsx', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/Initials.tsx'))
      .filter(({ text }) => /\{initials\(/u.test(text))
      .map(({ path }) => path);

    expect(offenders, 'Use <Initials name={…} /> from src/components/Initials.tsx.').toEqual([]);
  });

  it('whose text iOS cannot report', () => {
    const tags = sources(['src'])
      .filter(({ path }) => path.endsWith('/Initials.tsx'))
      .flatMap(({ text }) => textTags(text).map(({ markup }) => markup));

    expect(tags).toHaveLength(1);
    expect(tags.filter((markup) => !unreportable(markup) || !hidesItself(markup))).toEqual([]);
  });

  it('notices a tile Text that leaves its hiding to the View around it', () => {
    expect(
      hidesItself(
        '<Text {...rest} accessible={false} accessibilityElementsHidden importantForAccessibility="no">',
      ),
    ).toBe(true);
    expect(hidesItself('<Text {...rest} accessible={false} importantForAccessibility="no">')).toBe(
      false,
    );
    expect(hidesItself('<Text {...rest} accessible={false} accessibilityElementsHidden>')).toBe(
      false,
    );
    expect(
      hidesItself(
        '<Text accessibilityElementsHidden importantForAccessibility="no" {...rest} accessible={false}>',
      ),
    ).toBe(false);
  });

  it('notices a tile Android still reads', () => {
    expect(
      hiddenTile('<View accessibilityElementsHidden importantForAccessibility="no"><Text>'),
    ).toBe(false);
    expect(hiddenTile('<View style={styles.tile}><Text>')).toBe(false);
    expect(
      hiddenTile(
        '<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text>',
      ),
    ).toBe(true);
  });
});

describe('a Text hidden from screen readers stays hidden on iOS', () => {
  // iOS asks a Text for its items by `accessible` alone, so hiding it some other way fails on some opens (sc-10712).
  it('in every Text marked hidden in the app, or inside a View marked hidden', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      hiddenTexts(text)
        .filter((tag) => !unreportable(tag.markup, tag.when))
        .map((tag) => `${path}:${tag.line}`),
    );

    expect(
      offenders,
      'Give it accessible={false}, or accessible={x ? false : undefined} when hidden by x, after any spread.',
    ).toEqual([]);
  });

  it('notices a Text hidden by the View around it, and only while that View is open', () => {
    expect(
      hiddenTexts(
        '<View accessibilityElementsHidden>\n  <View style={s}>\n    <Text>✓</Text>\n  </View>\n</View>',
      ).map((tag) => tag.line),
    ).toEqual([3]);
    expect(
      hiddenTexts(
        '<View accessibilityElementsHidden>\n  <View style={s} />\n  <Text accessible={false}>✓</Text>\n</View>\n<Text>Saved</Text>',
      ).map((tag) => tag.line),
    ).toEqual([3]);
    expect(
      hiddenTexts('<Text accessibilityElementsHidden>✓</Text>').map((tag) => tag.line),
    ).toEqual([1]);
    expect(
      hiddenTexts('<View {...hidden}>\n  <Text>Zone</Text>\n</View>\n<Text>Saved</Text>'),
    ).toMatchObject([{ line: 2, when: 'closing' }]);
    expect(
      hiddenTexts('<View style={s} {...savedHidden}>\n  <Text>Zone</Text>\n</View>'),
    ).toMatchObject([{ line: 2, when: 'savedClosing' }]);
    expect(
      hiddenTexts(
        '<View {...hidden}>\n  <View {...stepHidden(busy)}>\n    <Text>Zone</Text>\n  </View>\n</View>',
      ),
    ).toMatchObject([{ line: 3, when: 'busy' }]);
    expect(hiddenTexts('<View {...fieldHidden}>\n  <Text>Zone</Text>\n</View>')).toMatchObject([
      { line: 2, when: 'closing' },
    ]);
  });

  it('notices a Text that iOS can still report', () => {
    expect(unreportable('<Text {...rest} accessible={false}>')).toBe(true);
    expect(unreportable('<Text accessible={false} {...rest}>')).toBe(false);
    expect(
      unreportable(
        '<Text accessibilityElementsHidden={closing} accessible={closing ? false : undefined}>',
        'closing',
      ),
    ).toBe(true);
    expect(
      unreportable('<Text accessible={closing ? false : undefined} {...rest}>', 'closing'),
    ).toBe(false);
    expect(unreportable('<Text accessible={saving ? false : undefined}>', 'closing')).toBe(false);
    expect(unreportable('<Text accessible={closing ? false : undefined}>')).toBe(false);
    expect(
      unreportable('<Text accessibilityElementsHidden={closing} accessible={!closing}>', 'closing'),
    ).toBe(false);
    expect(unreportable('<Text accessible={closing}>')).toBe(false);
    expect(unreportable('<Text accessibilityElementsHidden importantForAccessibility="no">')).toBe(
      false,
    );
  });
});

describe('a screen reader reaches what is inside a button', () => {
  // iOS reads a Pressable as one item, so a button inside another is out of VoiceOver's reach (sc-10712).
  it('in every Pressable in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      nestedPressables(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Make the outer press a sibling, not a parent.').toEqual([]);
  });

  it('notices a Pressable inside another', () => {
    expect(
      nestedPressables(
        '<Pressable onPress={() => close()}>\n  <Pressable onPress={x} />\n</Pressable>',
      ),
    ).toEqual([2]);
    expect(
      nestedPressables(
        '<Pressable onPress={x} />\n<Pressable style={a > b ? s : t}>\n</Pressable>',
      ),
    ).toEqual([]);
  });
});

describe("every dialog closes by VoiceOver's escape (sc-11063)", () => {
  // React Native's Modal leaves the two-finger scrub unanswered, so each dialog answers it itself.
  it('in every file that opens a Modal', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ text }) => escapesAnswered(text) < modalsOpened(text))
      .map(({ path }) => path);

    expect(
      offenders,
      "Pass onAccessibilityEscape the dialog's own close, on a View with collapsable={false} or accessibilityViewIsModal.",
    ).toEqual([]);
  });

  it('notices a Modal nothing escapes', () => {
    expect(modalsOpened('<Modal visible={open}>\n  <View />\n</Modal>')).toBe(1);
    expect(escapesAnswered('<Modal visible={open}>\n  <View />\n</Modal>')).toBe(0);
    expect(modalsOpened("import { Modal, type TextInputInstance } from 'react-native';")).toBe(0);
  });

  // Fabric flattens a View that only lays out, and its escape goes with it.
  it('notices an escape on a View that flattens away', () => {
    expect(escapesAnswered('<View style={s} onAccessibilityEscape={() => close()}>')).toBe(0);
    expect(escapesAnswered('<View collapsable={false} onAccessibilityEscape={onClose}>')).toBe(1);
    expect(
      escapesAnswered('<View\n  accessibilityViewIsModal\n  onAccessibilityEscape={onClose}\n>'),
    ).toBe(1);
    expect(escapesAnswered('<View collapsable onAccessibilityEscape={onClose}>')).toBe(0);
  });
});

describe('every Modal stays under the update-required state (sc-22962)', () => {
  // A Modal is a window of its own, so only useModalOpen keeps it from covering the update-required screen.
  it('in every Modal in the app', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ text }) => modalsLeftOpen(text) > 0)
      .map(({ path }) => path);

    expect(
      offenders,
      "Take the Modal's visible from useModalOpen in src/updateRequired.ts.",
    ).toEqual([]);
  });

  it('passes a Modal whose visible comes from useModalOpen', () => {
    expect(modalsLeftOpen('<Modal visible={useModalOpen(open)}>\n</Modal>')).toBe(0);
    expect(
      modalsLeftOpen('const shown = useModalOpen(open);\n<Modal visible={shown}>\n</Modal>'),
    ).toBe(0);
    expect(modalsLeftOpen("import { Modal, type TextInputInstance } from 'react-native';")).toBe(0);
  });

  it('passes a Modal whose turn for the window comes after useModalOpen', () => {
    expect(
      modalsLeftOpen(
        'const { shown, gone } = useWindowTurn(useModalOpen(open));\n<Modal visible={shown}>\n</Modal>',
      ),
    ).toBe(0);
    expect(
      modalsLeftOpen('const { shown } = useWindowTurn(open);\n<Modal visible={shown}>\n</Modal>'),
    ).toBe(1);
  });

  it('notices a Modal that shows over the update-required state', () => {
    expect(modalsLeftOpen('<Modal visible={open}>\n</Modal>')).toBe(1);
    expect(modalsLeftOpen('<Modal transparent>\n</Modal>')).toBe(1);
    expect(modalsLeftOpen('<Modal visible={useModalOpen(open) || forced}>\n</Modal>')).toBe(1);
    expect(
      modalsLeftOpen(
        'const shown = useModalOpen(open) || forced;\n<Modal visible={shown}>\n</Modal>',
      ),
    ).toBe(1);
    expect(
      modalsLeftOpen(
        'const shown = useModalOpen(open);\n<Modal visible={shown}>\n</Modal>\n<Modal visible={open}>\n</Modal>',
      ),
    ).toBe(1);
  });
});

describe('a label goes only where a screen reader lands', () => {
  // VoiceOver never reads a label on a plain View, and TalkBack makes it a stop of its own (sc-11419, sc-11564).
  it('in every View and ScrollView in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      labelsNobodyLandsOn(text).map((line) => `${path}:${line}`),
    );

    expect(
      offenders,
      'Drop the label, or make the View accessible when it is one item to read.',
    ).toEqual([]);
  });

  it('notices a label on a View no screen reader lands on', () => {
    expect(labelsNobodyLandsOn("<View style={s} accessibilityLabel={t('a')}>")).toEqual([1]);
    expect(
      labelsNobodyLandsOn(
        "<View>\n  <ScrollView\n    nestedScrollEnabled\n    accessibilityLabel={t('a')}\n  >",
      ),
    ).toEqual([2]);
    expect(labelsNobodyLandsOn('<Animated.View aria-label={name} />')).toEqual([1]);
    expect(labelsNobodyLandsOn("<View accessible={false} accessibilityLabel={t('a')}>")).toEqual([
      1,
    ]);
    expect(labelsNobodyLandsOn("<View style={s} accessible accessibilityLabel={t('a')}>")).toEqual(
      [],
    );
    expect(
      labelsNobodyLandsOn(
        "<ScrollView\n  onLayout={(e) => f(e)}\n  accessibilityLabel={t('a')}\n>",
      ),
    ).toEqual([1]);
  });
});

describe('a screen reader reaches each button in a group', () => {
  // iOS reads an accessible View as one item, as it reads a Pressable, so the buttons inside it are out of reach (sc-11563).
  it('in every accessible View in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      pressablesInAccessibleViews(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Take `accessible` off the group, so each button is its own item.').toEqual(
      [],
    );
  });

  it('notices a Pressable inside an accessible View', () => {
    expect(
      pressablesInAccessibleViews(
        '<View accessible accessibilityRole="radiogroup">\n  <Pressable onPress={x} />\n</View>',
      ),
    ).toEqual([2]);
    expect(
      pressablesInAccessibleViews(
        '<View accessible={shown}>\n  <Text>{words}</Text>\n  <Pressable onPress={x} />\n</View>',
      ),
    ).toEqual([3]);
    expect(
      pressablesInAccessibleViews(
        '<View accessible />\n<View style={a > b ? s : t}>\n  <Pressable onPress={x} />\n</View>',
      ),
    ).toEqual([]);
    expect(
      pressablesInAccessibleViews(
        '<View accessible={false}>\n  <View>\n  </View>\n  <Pressable onPress={x} />\n</View>',
      ),
    ).toEqual([]);
  });
});

describe('a field is read by the name it shows', () => {
  // sc-11238: a label chosen once for the eye and once for the reader drifted apart (WCAG 2.5.3, Label in Name).
  // sc-11297: three fields in Ownership and leaving had no name, and TalkBack read each as "Edit box".
  it('in every TextField, PasswordField and CodeField in the app, which has a name', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      KIT_FIELDS.flatMap((name) =>
        selfClosing(name, text)
          .filter((tag) => !named(tag.markup))
          .map((tag) => `${path}:${tag.line}`),
      ),
    );

    expect(offenders, 'Give the field accessibilityLabel, its shown label.').toEqual([]);
  });

  it('notices a field with no name', () => {
    expect(named('<TextField\n  value={name}\n  testID="delete.name"\n')).toBe(false);
    expect(named('<CodeField {...sharedInput} ')).toBe(false);
    expect(named("<PasswordField\n  accessibilityLabel={t('leave.password')}\n")).toBe(true);
  });

  it('in every Field in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      fieldsReadByAnotherName(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Give the control the accessibilityLabel its Field shows.').toEqual([]);
  });

  it('notices a field read by another name', () => {
    expect(
      fieldsReadByAnotherName(
        "<Field label={t('a')}>\n  <CodeField accessibilityLabel={t('b')} />\n</Field>",
      ),
    ).toEqual([1]);
    expect(
      fieldsReadByAnotherName(
        "<Field label={t(x ? 'a' : 'b')} error={e}>\n  <CodeField accessibilityLabel={t(x ? 'a' : 'b')} />\n</Field>",
      ),
    ).toEqual([]);
    expect(
      fieldsReadByAnotherName(
        "<Field\n  label={t(\n    x ? 'a' : 'b',\n  )}\n>\n  <CodeField\n    accessibilityLabel={t(\n      x ? 'a' : 'b',\n    )}\n  />\n</Field>",
      ),
    ).toEqual([]);
    expect(
      fieldsReadByAnotherName("<Field label={t('a')}>\n  <TextField value={v} />\n</Field>"),
    ).toEqual([]);
  });
});

describe('every text field is named through fieldName (sc-17333)', () => {
  // TalkBack reads a content description in place of what the field holds, and says it again on every key.
  it('in every TextInput in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      inputsNamedAnotherWay(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Spread fieldName(...) after the props the TextInput is given.').toEqual([]);
  });

  it('notices a TextInput named another way', () => {
    expect(
      inputsNamedAnotherWay(
        '<TextInput\n  {...rest}\n  {...fieldName(Platform.OS, rest.accessibilityLabel, { labelID })}\n/>',
      ),
    ).toEqual([]);
    expect(inputsNamedAnotherWay("<TextInput\n  accessibilityLabel={t('a')}\n/>")).toEqual([1]);
    expect(
      inputsNamedAnotherWay(
        '<TextInput\n  {...fieldName(Platform.OS, a, {})}\n  accessibilityValue={{ text: v }}\n/>',
      ),
    ).toEqual([1]);
  });
});

describe('a field hands its children the id its label shows under (sc-17333)', () => {
  // On Android a TextField is named only by this id; without it, fieldName falls back to a content description.
  it('in Field', () => {
    expect(
      labelLinkBroken(readFileSync(join('src', 'components', 'Field.tsx'), 'utf8')),
      'Give the label Text nativeID={labelID} and wrap the children in <FieldLabel value={labelID}>.',
    ).toBe(false);
  });

  it('notices a label and a provider that name different ids', () => {
    const shown = '<Text weight="semibold" nativeID={labelID}>\n  {label}\n</Text>';
    expect(labelLinkBroken(`${shown}\n<FieldLabel value={labelID}>{children}</FieldLabel>`)).toBe(
      false,
    );
    expect(labelLinkBroken(`${shown}\n<FieldLabel value={otherID}>{children}</FieldLabel>`)).toBe(
      true,
    );
    expect(labelLinkBroken(`<Text>\n  {label}\n</Text>\n{children}`)).toBe(true);
  });
});

describe('changing the layout keeps the form', () => {
  // A frame that returns a different tree per layout remounts the form, and a rotation throws away what was typed.
  it('is one tree at every size in AuthFrame', () => {
    const frame = sources(['src/components']).find(({ path }) => path.endsWith('AuthFrame.tsx'));

    expect(frame, 'AuthFrame.tsx').toBeDefined();
    expect(frame?.text.match(/<Screen\b/gu)?.length, 'one <Screen>, not one per layout').toBe(1);
  });
});

describe('the app runs on Hermes', () => {
  // Hermes lacks these: a screen that calls one without its polyfill crashes on open (sc-509 QA, #1113).
  const POLYFILLED = { ListFormat: 'intl-listformat', DisplayNames: 'intl-displaynames' } as const;

  it('polyfills every Intl API it calls that Hermes lacks', () => {
    const polyfills = readFileSync(join(import.meta.dirname, 'intl.ts'), 'utf8');
    const missing = Object.entries(POLYFILLED).filter(
      ([api, pkg]) =>
        sources(['src', 'app']).some(({ text }) => text.includes(`Intl.${api}`)) &&
        !polyfills.includes(`@formatjs/${pkg}/polyfill.js`),
    );

    expect(missing.map(([api]) => api)).toEqual([]);
  });
});

describe('a field that takes a recovery code gets the full keyboard', () => {
  // sc-124 QA #1616: these fields fell back to the number pad, and a recovery code has letters and a hyphen.
  // The proof step's field is ConfirmItsYou's, named by the card that opens it (ways, contacts).
  const RECOVERY_CODE_FIELDS = ['devices.everywhere.code', '${idPrefix}.code'];

  it.each(RECOVERY_CODE_FIELDS)('%s', (testID) => {
    const fields = sources(['src', 'app']).flatMap(({ text }) =>
      selfClosing('CodeField', text).filter(
        (tag) =>
          tag.markup.includes(`testID="${testID}"`) ||
          tag.markup.includes(`testID={\`${testID}\`}`),
      ),
    );

    expect(fields, `one CodeField with testID "${testID}"`).toHaveLength(1);
    expect(takesRecoveryCode(fields[0]?.markup ?? '')).toBe(true);
  });

  it('notices a CodeField that leaves it out', () => {
    expect(takesRecoveryCode('<CodeField\n  wrong={false}\n  testID="ways.code"\n')).toBe(false);
    expect(takesRecoveryCode('<CodeField takesRecoveryCode={false} testID="ways.code" ')).toBe(
      false,
    );
    expect(takesRecoveryCode('<CodeField\n  takesRecoveryCode\n  testID="ways.code"\n')).toBe(true);
  });
});

describe('a way back in Two-factor authentication is off while its request runs (sc-12537)', () => {
  it('on Cancel, Keep it on and Keep current codes', () => {
    const text = readFileSync(join('src', 'components', 'TwoFactorCard.tsx'), 'utf8');
    const off = selfClosing('QuietButton', text)
      .filter(({ markup }) => /\boff=\{checking\}/u.test(markup))
      .map(({ markup }) => propValue(markup, 'testID'));

    expect(off).toEqual(['"twoFactor.cancel"', '"twoFactor.keepItOn"', '"twoFactor.keepCodes"']);
  });
});

const FOCUS_THROUGH =
  'A refusal focuses through focusChecked or focusRefused: focus() skips a field Android left focused with the keys hidden.';

const linesOf = (file: string, text: string) =>
  text.split('\n').map((line, index) => ({ line, index, at: `${file}:${index + 1}` }));

const bareFocus = (file: string, text: string) =>
  linesOf(file, text)
    .filter(({ line }) => /\.current\?\.focus\(\)/u.test(line))
    .filter(({ line }) => !/onSubmitEditing=|\? void submit\(\) :/u.test(line))
    .map(({ at }) => at);

const keysDropped = (file: string, text: string) =>
  linesOf(file, text).filter(({ line }) => /Keyboard\.dismiss\(|\.current\?\.blur\(\)/u.test(line));

describe('a refused submit leaves the keyboard as it was, unless dropsKeysAfter says the name cannot fix it', () => {
  // sc-9471: a field disabled while saving lost its focus, so a server refusal closed the keyboard and a client one did not.
  // sc-20208: Confirm it's you, Sign out everywhere else and Two-factor.
  // sc-20209 carries it to adding and checking an address or a number, and to A few details. sc-20210: the signed-out forms.
  const HELD_FORMS = [
    'src/components/ConfirmItsYou.tsx',
    'src/components/CreateOrganisation.tsx',
    'src/components/DevicesCard.tsx',
    'src/components/PasswordCard.tsx',
    'src/components/TimeZoneCard.tsx',
    'src/components/NameCard.tsx',
    'src/components/TwoFactorCard.tsx',
    'src/components/SecondFactorStep.tsx',
    'src/components/OrganisationDetails.tsx',
    'src/components/CompanyDomainsCard.tsx',
    'src/components/OwnershipCard.tsx',
    'src/components/ContactsCard.tsx',
    'src/components/CodeForm.tsx',
    'src/components/PhoneEntry.tsx',
    'app/phone.tsx',
    'app/complete-profile.tsx',
    'app/verify-email.tsx',
    'app/verify-phone.tsx',
    'app/sign-in.tsx',
    'app/register.tsx',
    'app/forgot-password.tsx',
    'app/reset-password.tsx',
    'app/lost-two-factor.tsx',
  ];

  it.each(HELD_FORMS)('%s holds its fields rather than disabling them', (file) => {
    const text = readFileSync(join(...file.split('/')), 'utf8');
    const fields = [...KIT_FIELDS, 'PhoneEntry', 'CodeForm'].flatMap((name) =>
      selfClosing(name, text),
    );

    expect(fields.length, `fields in ${file}`).toBeGreaterThan(0);
    expect(
      fields
        .filter((tag) => /\beditable=/u.test(tag.markup))
        // A field nobody types in, such as Sign in's address beside the provider buttons, is read-only from the start.
        .filter(
          (tag) => !tag.markup.includes('editable={false}') || tag.markup.includes('onChangeText='),
        )
        .map((tag) => `${file}:${tag.line}`),
      'Pass submitting={saving}: editable={false} drops the focus and the keyboard.',
    ).toEqual([]);
    expect(text, 'Pass submitting: editable: false drops the focus and the keyboard.').not.toMatch(
      /\beditable:/u,
    );
    expect(
      fields
        .filter((tag) => /\bonSubmitEditing=/u.test(tag.markup))
        .filter((tag) => !/onSubmitEditing=\{\(\) => \w+\.current\?\.focus\(\)\}/u.test(tag.markup))
        .filter((tag) => !tag.markup.includes('submitBehavior="submit"'))
        .map((tag) => `${file}:${tag.line}`),
      'A field that submits the form keeps its focus on return.',
    ).toEqual([]);
    expect(
      !text.includes('onSubmitEditing:') || text.includes("submitBehavior: 'submit'"),
      'Props that submit the form on return keep its focus.',
    ).toBe(true);
    expect(bareFocus(file, text), FOCUS_THROUGH).toEqual([]);
    expect(
      keysDropped(file, text)
        .filter(({ line }) => !line.includes('dropsKeysAfter('))
        .filter(({ line }) => line.trim() !== 'useEffect(() => Keyboard.dismiss(), []);'),
      'Drop the keys only through dropsKeysAfter, or as a step a success opens mounts: sc-9442 is the one exception to sc-9471.',
    ).toEqual([]);
  });

  it.each([
    ['OrganisationDetails.tsx', 'if (refusal.focus != null)', '}, [refusal.focus]);'],
    ['CompanyDomainsCard.tsx', '} catch (refusal) {', '} finally {'],
  ])('%s focuses a field a server refusal names without raising the keys', (file, from, to) => {
    const text = readFileSync(join('src', 'components', file), 'utf8');
    const start = text.indexOf(from);
    const refused = start < 0 ? '' : text.slice(start, text.indexOf(to, start));

    expect(refused, `the refusal path in ${file}`).not.toBe('');
    expect(refused.match(/\bfocus\w*\(/gu), 'focusChecked and focus() raise hidden keys.').toEqual([
      'focusRefused(',
    ]);
  });
});

describe('Ask to join holds its message rather than disabling it (sc-9674)', () => {
  const JOIN = 'join/[token].tsx';
  const text = readFileSync(join('app', 'join', '[token].tsx'), 'utf8');

  it('in join/[token].tsx', () => {
    const fields = selfClosing('TextField', text);

    expect(fields).toHaveLength(1);
    expect(fields.filter((tag) => /\beditable=/u.test(tag.markup))).toEqual([]);
    expect(bareFocus(JOIN, text), FOCUS_THROUGH).toEqual([]);
    expect(text.match(/\bfocusChecked\(input\)/gu), 'the Message check').toHaveLength(1);
  });

  it('drops the keys only when the link is dead, which no message can fix (sc-11741)', () => {
    const lines = text.split('\n');

    expect(keysDropped(JOIN, text).map(({ index }) => lines[index - 1]?.trim())).toEqual([
      "if (problem.is('request_link_dead')) {",
    ]);
  });
});

describe('Your password stays on screen when the transfer asks for a code (sc-9674)', () => {
  it('in OwnershipCard.tsx, whatever the pending proof', () => {
    const text = readFileSync(join('src', 'components', 'OwnershipCard.tsx'), 'utf8');
    const field = text.indexOf('testID="ownership.password"');
    const shown = text
      .slice(0, field)
      .split('\n')
      .findLast((line) => /^\s*\{.*&& \($/u.test(line));

    expect(field, 'the password field').toBeGreaterThan(-1);
    expect(shown, 'the condition that shows it').toBeDefined();
    expect(shown, 'Hiding it once a code is asked drops the focus and the keys.').not.toMatch(
      /\bpending\b/u,
    );
  });

  it('in OwnershipCard.tsx, freed again once the code step proof lapses', () => {
    const text = readFileSync(join('src', 'components', 'OwnershipCard.tsx'), 'utf8');

    expect(text, 'A lapse gated on vouched alone keeps the password held.').toMatch(
      /keptProofRanOut\(error, transferSentKept\(vouched, pending\)\)/u,
    );
  });

  it('in OwnershipCard.tsx, saying so on the password path, where no lapse notice shows', () => {
    const text = readFileSync(join('src', 'components', 'OwnershipCard.tsx'), 'utf8');
    const start = text.indexOf('if (keptProofRanOut(error,');
    const lapse = start < 0 ? '' : text.slice(start, text.indexOf('return;', start));

    expect(lapse, 'the lapse branch').not.toBe('');
    expect(text, 'The lapse notice names a provider.').toMatch(
      /expired != null && provider != null/u,
    );
    expect(lapse, 'A lapse that sets nothing leaves a password owner no word why.').toMatch(
      /if \(provider == null\) setRefused\(\{ field: null, message: error\.problem\.title \}\)/u,
    );
  });
});

describe('a submit with the keys down keeps them down (sc-13408, sc-9674)', () => {
  it.each([
    ['src/components/OrganisationDetails.tsx', /^\s*setStatus\('saving'\);/u, 1],
    [
      'src/components/CompanyDomainsCard.tsx',
      /^\s*setBusy\(true\);\n\s*setFlash\(null\);\n(?:.*\n){4}\s*const domain/u,
      1,
    ],
    [
      'src/components/OwnershipCard.tsx',
      /^\s*setBusy\(true\);\n\s*set(Refused|Failed)\(null\);\n\n\s*try \{\n\s*(const proof|await api\.deleteOrganisation)/u,
      2,
    ],
    ['app/join/[token].tsx', /^\s*setBusy\(true\);/u, 1],
  ])('%s lets go of a focused field before each send starts', (file, start, count) => {
    const text = readFileSync(join(...file.split('/')), 'utf8');
    const starts = [...text.matchAll(new RegExp(start.source, 'gmu'))].map((match) =>
      text.slice(0, match.index).split('\n').slice(-2, -1)[0]?.trim(),
    );

    expect(starts).toHaveLength(count);
    expect(starts.filter((before) => before !== 'keysStayDown();')).toEqual([]);
  });
});

describe('a signed-out submit sends one request, and none with the keys down opening them (sc-20210)', () => {
  // Where each submit starts its request, and what its first return waits on: the request, and a 429 where one locks the button.
  const SIGNED_OUT = [
    [
      'app/sign-in.tsx',
      /^\s*onSubmit\(/u,
      ["status.kind === 'signingIn'", "status.kind === 'rateLimited'"],
    ],
    ['app/register.tsx', /^\s*onSubmit\(/u, ['busy', 'locked']],
    ['app/forgot-password.tsx', /^\s*void send\(/u, ["status.kind === 'sending'"]],
    [
      'app/reset-password.tsx',
      /^\s*setStatus\(\{ kind: 'saving'/u,
      ["status.kind !== 'ready' && status.kind !== 'failed'"],
    ],
    ['app/lost-two-factor.tsx', /^\s*setAsking\(true\);/u, ['asking']],
    [
      'src/components/SecondFactorStep.tsx',
      /^\s*setStatus\(\{ kind: 'checking' \}\);/u,
      ['checking', "status.kind === 'paused'"],
    ],
  ] as const;

  it.each(SIGNED_OUT)('%s lets go of a focused field before its request starts', (file, start) => {
    const lines = readFileSync(join(...file.split('/')), 'utf8').split('\n');
    const starts = lines.flatMap((line, index) => (start.test(line) ? [index] : []));

    expect(starts).toHaveLength(1);
    expect(starts.filter((index) => lines[index - 1]?.trim() !== 'keysStayDown();')).toEqual([]);
  });

  it.each(SIGNED_OUT)(
    '%s sends nothing while its request runs or a 429 holds it',
    (file, _start, waits) => {
      const text = readFileSync(join(...file.split('/')), 'utf8');
      const guard =
        /(?:const submit = \(\): void => \{|function submit\(\): (?:void|Promise<void>) \{)([\s\S]*?)\breturn;/u.exec(
          text,
        )?.[1];

      expect(guard, `submit in ${file}`).toBeDefined();
      expect(waits.filter((wait) => !guard?.includes(wait))).toEqual([]);
    },
  );

  it('on Create your account, while busy and locked mean the request and the 429', () => {
    const text = readFileSync(join('app', 'register.tsx'), 'utf8');

    expect(text).toContain("const busy = status.kind === 'submitting';");
    expect(text).toContain("const locked = status.kind === 'rateLimited';");
  });

  it('on Two-factor, while checking means the request', () => {
    const text = readFileSync(join('src', 'components', 'SecondFactorStep.tsx'), 'utf8');

    expect(text).toContain("const checking = status.kind === 'checking';");
  });
});

describe('a refused code focuses its field through focusChecked (sc-20209)', () => {
  it('on Check your email, from its checks', () => {
    expect(readFileSync(join('app', 'verify-email.tsx'), 'utf8')).toMatch(
      /\(\) => focusChecked\(codeInput\),/u,
    );
  });

  it('on Check your messages, before the code check returns', () => {
    expect(readFileSync(join('app', 'verify-phone.tsx'), 'utf8')).toMatch(
      /if \(problem != null\) \{[^}]*\);\s*focusChecked\(codeInput\);\s*return;/u,
    );
  });
});

describe('a second return key while the request runs sends nothing (sc-20209)', () => {
  it.each([
    ['src/components/ContactsCard.tsx', /^\s*setSending\(true\);/u, 'sending', 2],
    ['app/phone.tsx', /^\s*setSending\(true\);/u, 'sending', 1],
    ['app/complete-profile.tsx', /^\s*setSaving\(true\);/u, 'saving', 2],
  ] satisfies [string, RegExp, string, number][])(
    '%s returns before each request while one runs',
    (file, start, flag, count) => {
      const lines = readFileSync(join(...file.split('/')), 'utf8').split('\n');
      const unguarded = lines.flatMap((line, index) => {
        if (!start.test(line)) return [];
        const header = lines.findLastIndex(
          (above, at) => at < index && /^\s*(async )?function \w+\(/u.test(above),
        );

        return new RegExp(`^\\s*if \\(${flag}\\b.*\\) return;$`, 'u').test(lines[header + 1] ?? '')
          ? [{ guarded: true }]
          : [{ guarded: false, at: `${file}:${index + 1}` }];
      });

      expect(unguarded).toHaveLength(count);
      expect(unguarded.filter(({ guarded }) => !guarded)).toEqual([]);
    },
  );

  it('CodeForm.tsx, for Check your email and Check your messages', () => {
    const field = selfClosing(
      'CodeField',
      readFileSync(join('src', 'components', 'CodeForm.tsx'), 'utf8'),
    );

    expect(field).toHaveLength(1);
    expect(field[0]?.markup).toMatch(
      /onSubmitEditing=\{\(\) => \{\s*if \(!verifying\) onVerify\(/u,
    );
  });
});

describe('a submit with the keys down keeps them down (sc-20208)', () => {
  it.each([
    ['ConfirmItsYou.tsx', 1],
    ['DevicesCard.tsx', 1],
    ['TwoFactorCard.tsx', 3],
  ])('%s lets go of a focused field before each request starts', (file, requests) => {
    const lines = readFileSync(join('src', 'components', file), 'utf8').split('\n');
    const starts = lines.flatMap((line, index) =>
      /^\s*set(Checking|Working)\(true\);/u.test(line) ? [index] : [],
    );

    expect(starts).toHaveLength(requests);
    expect(starts.filter((index) => lines[index - 1]?.trim() !== 'keysStayDown();')).toEqual([]);
  });
});

describe('a Password submit with the keys down keeps them down (sc-13408)', () => {
  it('lets go of a focused field before each request starts', () => {
    const lines = readFileSync(join('src', 'components', 'PasswordCard.tsx'), 'utf8').split('\n');
    const starts = lines.flatMap((line, index) =>
      /^\s*set(Saving|Busy)\(true\);/u.test(line) ? [index] : [],
    );

    expect(starts).toHaveLength(3);
    expect(starts.filter((index) => lines[index - 1]?.trim() !== 'keysStayDown();')).toEqual([]);
  });
});

describe('a submit with the keys down keeps them down (sc-20209)', () => {
  it.each([
    // Adding's, and not the row actions above it, which have no field.
    ['src/components/ContactsCard.tsx', /^\s*setSending\(true\);/u, 1, 'function Adding('],
    ['app/verify-email.tsx', /^\s*setStatus\(\{ kind: 'verifying' \}\);/u, 1],
    ['app/verify-phone.tsx', /^\s*setStatus\(\{ kind: 'verifying' \}\);/u, 1],
    ['app/phone.tsx', /^\s*setSending\(true\);/u, 1],
    ['app/complete-profile.tsx', /^\s*setSaving\(true\);/u, 2],
  ] satisfies [string, RegExp, number, string?][])(
    '%s lets go of a focused field before each request starts',
    (file, start, count, from: string = '') => {
      const text = readFileSync(join(...file.split('/')), 'utf8');
      const lines = text.slice(text.indexOf(from)).split('\n');
      const starts = lines.flatMap((line, index) => (start.test(line) ? [index] : []));

      expect(starts).toHaveLength(count);
      expect(starts.filter((index) => lines[index - 1]?.trim() !== 'keysStayDown();')).toEqual([]);
    },
  );
});

describe('a Cancel is off while the change beside it runs (sc-12545)', () => {
  const offWhile = (file: string, busy: string) =>
    selfClosing('QuietButton', readFileSync(join('src', 'components', file), 'utf8'))
      .filter(({ markup }) => markup.includes(`off={${busy}}`))
      .map(({ markup }) => propValue(markup, 'testID'));

  it('in Password, beside Save new password and Save password, not beside the code check', () => {
    expect([
      ...offWhile('PasswordCard.tsx', 'saving'),
      ...offWhile('PasswordCard.tsx', 'busy'),
    ]).toEqual(['"password.cancel"', '"password.setCancel"']);
  });

  it('in Time zone, beside Save time zone', () => {
    expect(offWhile('TimeZoneCard.tsx', 'saving')).toEqual(['"timeZone.cancel"']);
  });

  it('in Name, beside Save name', () => {
    expect(offWhile('NameCard.tsx', 'saving')).toEqual(['"nameCard.cancel"']);
  });

  it("in Confirm it's you, beside Continue", () => {
    expect(offWhile('ConfirmItsYou.tsx', 'checking')).toEqual(['{`${idPrefix}.cancel`}']);
  });
});

describe("a lapsed proof at Unlink goes back to Confirm it's you (sc-12545)", () => {
  it('in the ways card, before the refusal reaches the list', () => {
    const text = readFileSync(join('src', 'components', 'WaysCard.tsx'), 'utf8');

    expect(text).toMatch(
      /if \(unlinkProofLapsed\(error\)\) \{\s*setStage\(\{ kind: 'proving', act: \{ action: 'unlink', provider \} \}\);/,
    );
  });
});

describe('a contact confirmation shows its request running, its way back off (sc-12546)', () => {
  const text = readFileSync(join('src', 'components', 'ContactsCard.tsx'), 'utf8');

  it('on Make it primary and Remove it, busy while they send', () => {
    const busy = ['DestructiveButton', 'PrimaryButton'].flatMap((button) =>
      selfClosing(button, text)
        .filter(({ markup }) => /\bbusy=\{sending\}/u.test(markup))
        .map(({ markup }) => propValue(markup, 'testID')),
    );

    expect(busy).toEqual([
      '{`contacts.${row.id}.confirm`}',
      '{`contacts.${row.id}.confirm`}',
      '{`contacts.${kind}.send`}',
    ]);
  });

  it('on Keep and on Cancel under an add form, off until the answer', () => {
    const off = selfClosing('QuietButton', text)
      .filter(({ markup }) => /\boff=\{sending\}/u.test(markup))
      .map(({ markup }) => propValue(markup, 'testID'));

    expect(off).toEqual(['{`contacts.${row.id}.keep`}', '{`contacts.${kind}.cancel`}']);
  });

  it('back on Make this your primary address? when a change fails past the check', () => {
    expect(text).toMatch(
      /else if \(proof != null\) setAsking\(\{ id: row\.id, what: 'promote' \}\);/u,
    );
  });
});

describe('a screen is a composition of the kit', () => {
  it('takes its fields from the kit, never a bare TextInput', () => {
    const offenders = sources(['app'])
      .filter(({ text }) =>
        /import\s*\{[^}]*(?<!type )\bTextInput\b[^}]*\}\s*from\s*'react-native'/u.test(text),
      )
      .map(({ path }) => path);

    expect(offenders, 'Use TextField, PasswordField or CodeField from src/components.').toEqual([]);
  });

  it('keeps no local copy of a style the kit provides', () => {
    const offenders = sources(['app']).flatMap(({ path, text }) =>
      KIT_STYLES.filter((key) => new RegExp(`^\\s{2}${key}: `, 'mu').test(text)).map(
        (key) => `${path}: ${key}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

describe('every numbered step shares one mark (sc-18140)', () => {
  it('draws the step circle only in StepMark.tsx', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/StepMark.tsx'))
      .filter(({ text }) => drawsStepCircle(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Use <StepMark step={…} state={…} /> from src/components/StepMark.tsx.',
    ).toEqual([]);
  });

  it('notices a step circle drawn in place', () => {
    expect(drawsStepCircle('  const markSide = useMarkSide(tokens.space3xl);')).toBe(true);
    expect(drawsStepCircle('  const markSide = useMarkSide(tokens.sizeMark);')).toBe(false);
  });
});

describe('a mark or a pill grows with the text inside it (sc-13281)', () => {
  it('in every style in the app, which sizes it only through useMarkSide or minHeight', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      fixedAroundText(text).map((line) => `${path}:${line}`),
    );

    expect(
      offenders,
      'Use useMarkSide(side) from src/components/markSide.ts, or minHeight.',
    ).toEqual([]);
  });

  it('notices a mark or a pill of a fixed size', () => {
    expect(
      fixedAroundText('  mark: {\n    width: tokens.sizeMark,\n    height: tokens.sizeMark,'),
    ).toEqual([2, 3]);
    expect(fixedAroundText('  pill: { height: tokens.sizePill, borderRadius: 11 },')).toEqual([1]);
    expect(fixedAroundText('  pill: { minHeight: tokens.sizePill },')).toEqual([]);
    expect(fixedAroundText('<Svg width={tokens.sizeMark} height={tokens.sizeMark} />')).toEqual([]);
  });
});

describe('a way back that names an outcome is off while its request runs (sc-12511)', () => {
  it('in Ownership and leaving, on Keep ownership, Stay and Keep ‹organisation›', () => {
    const text = readFileSync(join('src', 'components', 'OwnershipCard.tsx'), 'utf8');
    const off = selfClosing('QuietButton', text)
      .filter(({ markup }) => /\boff=\{busy\}/u.test(markup))
      .map(({ markup }) => propValue(markup, 'testID'));

    expect(off).toEqual([
      '"ownership.transfer.keep"',
      '"ownership.leave.stay"',
      '"ownership.delete.keep"',
    ]);
  });

  it('where QuietButton taken off cannot be pressed, and is read as off', () => {
    const text = readFileSync(join('src', 'components', 'Buttons.tsx'), 'utf8');
    const body = text.slice(text.indexOf('export function QuietButton('));
    const start = body.indexOf('<Pressable');
    const pressable = body.slice(start, tagEnd(body, start));

    expect(propValue(pressable, 'disabled')).toBe('{off}');
    expect(propValue(pressable, 'accessibilityState')).toBe('{{ disabled: off }}');
  });

  it.each(['PrimaryButton', 'DestructiveButton'])(
    'where %s busy still takes the tap, so the keys stay up, and does nothing with it',
    (button) => {
      const text = readFileSync(join('src', 'components', 'Buttons.tsx'), 'utf8');
      const body = text.slice(text.indexOf(`export function ${button}(`));
      const start = body.indexOf('<PressFade');
      const pressable = body.slice(start, tagEnd(body, start));

      expect(propValue(pressable, 'disabled')).toBe('{off || undefined}');
      expect(propValue(pressable, 'onPress')).toBe('{busy ? undefined : onPress}');
      expect(propValue(pressable, 'accessibilityState')).toBe('{{ disabled: inactive, busy }}');
      expect(propValue(pressable, 'accessibilityLabel')).toBe('{accessibilityLabel ?? label}');
    },
  );

  it.each(['PrimaryButton', 'DestructiveButton'])(
    'where %s busy or taken off is read as off once Pressable has merged its props',
    (button) => {
      const pressableSource = readFileSync(
        require.resolve('react-native/Libraries/Components/Pressable/Pressable.js'),
        'utf8',
      );
      expect(pressableSource).toMatch(
        /disabled != null \? \{\.\.\._accessibilityState, disabled\}/u,
      );

      const text = readFileSync(join('src', 'components', 'Buttons.tsx'), 'utf8');
      const body = text.slice(text.indexOf(`export function ${button}(`));
      const start = body.indexOf('<PressFade');
      const pressable = body.slice(start, tagEnd(body, start));
      const evaluate = (prop: string) =>
        new Function(
          'busy',
          'off',
          `const inactive = busy || off; return ${propValue(pressable, prop)?.slice(1, -1)};`,
        ) as (busy: boolean, off: boolean) => unknown;
      const disabled = evaluate('disabled');
      const state = evaluate('accessibilityState');
      const readAsOff = (busy: boolean, off: boolean) => {
        const merged = disabled(busy, off);
        return merged != null ? merged : (state(busy, off) as { disabled: boolean }).disabled;
      };

      expect([readAsOff(true, false), readAsOff(false, true), readAsOff(false, false)]).toEqual([
        true,
        true,
        false,
      ]);
    },
  );
});

interface Source {
  path: string;
  text: string;
}

function sources(roots: readonly string[]): Source[] {
  return roots.flatMap((root) => walk(join(__dirname, '..', root)));
}

function walk(directory: string): Source[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory())
      return entry.name.startsWith('.') || entry.name === 'node_modules' ? [] : walk(path);
    if (!/\.tsx?$/u.test(entry.name) || entry.name.includes('.test.')) return [];

    return [{ path, text: readFileSync(path, 'utf8') }];
  });
}

/** A TextInput or CodeField is always self-closing here, so its markup runs to the next `/>`. */
function selfClosing(name: string, text: string): { line: number; markup: string }[] {
  // Not after an identifier, so a type argument such as useRef<TextInputInstance> is not markup.
  return [...text.matchAll(new RegExp(`(?<![\\w.])<${name}\\b`, 'gu'))].map((match) => {
    const start = match.index;
    const end = text.indexOf('/>', start);

    return { line: text.slice(0, start).split('\n').length, markup: text.slice(start, end) };
  });
}

function modalTags(text: string): RegExpExecArray[] {
  return [...text.matchAll(/(?<![\w.])<Modal\b/gu)];
}

function modalsOpened(text: string): number {
  return modalTags(text).length;
}

/** How many Modals take their visible from somewhere other than useModalOpen, or have none. */
function modalsLeftOpen(text: string): number {
  const held = [...text.matchAll(/\bconst (\w+) = useModalOpen\([^()]*\);/gu)].map(
    (match) => `{${match[1]}}`,
  );
  // A window's turn comes after the gate (sc-23267), so what it shows is held too.
  for (const turn of text.matchAll(
    /\bconst \{ shown(?:, \w+)* \} = useWindowTurn\((\w+|useModalOpen\([^()]*\))\);/gu,
  )) {
    const gated = turn[1] ?? '';
    if (gated.startsWith('useModalOpen(') || held.includes(`{${gated}}`)) held.push('{shown}');
  }

  return modalTags(text)
    .map((match) => propValue(text.slice(match.index, tagEnd(text, match.index)), 'visible') ?? '')
    .filter((visible) => !(/^\{useModalOpen\([^()]*\)\}$/u.test(visible) || held.includes(visible)))
    .length;
}

/** How many tags answer the escape on a view that iOS keeps mounted. */
function escapesAnswered(text: string): number {
  return [...text.matchAll(/(?<![\w.])<[A-Z][\w.]*/gu)]
    .map((match) => text.slice(match.index, tagEnd(text, match.index)))
    .filter(
      (markup) =>
        /\bonAccessibilityEscape=\{/u.test(markup) &&
        (propValue(markup, 'collapsable') === '{false}' ||
          /\baccessibilityViewIsModal(?!=\{false\})\b/u.test(markup)),
    ).length;
}

function drawsStepCircle(text: string): boolean {
  return /useMarkSide\(tokens\.space3xl\)/u.test(text);
}

/** A width or height fixed at the side of a mark or a pill, which the glyph or word inside outgrows. */
function fixedAroundText(text: string): number[] {
  return [...text.matchAll(/(?<![\w])(?:width|height): tokens\.size(?:Mark|Pill)\b/gu)].map(
    (match) => text.slice(0, match.index).split('\n').length,
  );
}

function caretSet(markup: string): boolean {
  return (
    /\{\.\.\.(FIELD_DEFAULTS|codeProps\(|passwordProps\()/u.test(markup) ||
    /\bcursorColor=/u.test(markup)
  );
}

function takesRecoveryCode(markup: string): boolean {
  return /\btakesRecoveryCode(?!=\{false\})\b/u.test(markup);
}

function named(markup: string): boolean {
  return /\baccessibilityLabel=/u.test(markup);
}

function movesFocus(text: string): boolean {
  return /\b(setAccessibilityFocus|sendAccessibilityEvent)\(/u.test(text);
}

function readsOut(text: string): boolean {
  return /\baccessibilityLiveRegion\b|\baria-live\b|\bannounceForAccessibility(WithOptions)?\(/u.test(
    text,
  );
}

/** importantForAccessibility="no" leaves an Android tile's letters to be read; only its descendants hidden skips them. */
function hiddenTile(markup: string): boolean {
  return (
    /\baccessibilityElementsHidden\b/u.test(markup) &&
    /\bimportantForAccessibility="no-hide-descendants"/u.test(markup)
  );
}

/** The line of every Pressable that opens inside another one, read tag by tag. */
function nestedPressables(text: string): number[] {
  const nested: number[] = [];
  let depth = 0;

  for (const match of text.matchAll(/(?<![\w.])<(\/?)Pressable\b/gu)) {
    if (match[1] === '/') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) nested.push(text.slice(0, match.index).split('\n').length);
    if (!selfCloses(text, match.index)) depth += 1;
  }

  return nested;
}

/** The line of every View or ScrollView that carries a label without being accessible. */
function labelsNobodyLandsOn(text: string): number[] {
  return [...text.matchAll(/(?<![\w.])<(?:Animated\.)?(?:View|ScrollView)\b/gu)].flatMap(
    (match) => {
      const markup = text.slice(match.index, tagEnd(text, match.index));
      const labelled = /\b(accessibilityLabel|aria-label)=/u.test(markup);
      const accessible = /\baccessible(?!=\{false\})\b/u.test(markup);

      return labelled && !accessible ? [text.slice(0, match.index).split('\n').length] : [];
    },
  );
}

/** The line of every Pressable inside a View that iOS reads as one item. */
function pressablesInAccessibleViews(text: string): number[] {
  const inside: number[] = [];
  const views: boolean[] = [];

  for (const match of text.matchAll(/(?<![\w.])<(\/?)(View|Pressable)\b/gu)) {
    if (match[2] === 'Pressable') {
      if (match[1] === '' && views.includes(true)) {
        inside.push(text.slice(0, match.index).split('\n').length);
      }
      continue;
    }
    if (match[1] === '/') {
      views.pop();
      continue;
    }
    if (selfCloses(text, match.index)) continue;

    const markup = text.slice(match.index, tagEnd(text, match.index));
    views.push(
      /\baccessible(?=[\s>])/u.test(markup) ||
        ![null, '{false}'].includes(propValue(markup, 'accessible')),
    );
  }

  return inside;
}

/** The line of every Field whose control carries an accessibilityLabel other than the Field's label. */
function fieldsReadByAnotherName(text: string): number[] {
  return [...text.matchAll(/(?<![\w.])<Field\b/gu)].flatMap((match) => {
    const body = text.slice(match.index, text.indexOf('</Field>', match.index));
    const label = propValue(body.slice(0, tagEnd(body, 0)), 'label');
    const read = propValue(body.slice(tagEnd(body, 0)), 'accessibilityLabel');

    return read == null || read.replace(/\s+/gu, '') === label?.replace(/\s+/gu, '')
      ? []
      : [text.slice(0, match.index).split('\n').length];
  });
}

/** The lines of each TextInput that does not take its name from fieldName, or overrides it after. */
function inputsNamedAnotherWay(text: string): number[] {
  return [...text.matchAll(/(?<![\w.])<TextInput\b/gu)].flatMap((match) => {
    const tag = text.slice(match.index, tagEnd(text, match.index));
    const named = tag.search(/\{\.\.\.fieldName\(/u);
    const after = named < 0 ? '' : tag.slice(named);
    const quiet =
      named >= 0 &&
      !/\baccessibility(Label|LabelledBy|Value)=/u.test(after.slice(after.indexOf(')}')));

    return quiet ? [] : [text.slice(0, match.index).split('\n').length];
  });
}

/** A prop's value as written, its braces balanced, or null when the markup does not set it. */
/** Whether the Text showing a Field's label and the FieldLabel around its children name different ids. */
function labelLinkBroken(text: string): boolean {
  const label = [...text.matchAll(/(?<![\w.])<Text\b/gu)]
    .map((match) => text.slice(match.index, tagEnd(text, match.index)))
    .find((markup) =>
      text
        .slice(text.indexOf(markup) + markup.length)
        .trimStart()
        .startsWith('{label}'),
    );
  const shown = label == null ? null : propValue(label, 'nativeID');
  const handed = /<FieldLabel\s+value=(\{[^}]+\})/u.exec(text)?.[1] ?? null;

  return shown == null || handed == null || shown !== handed;
}

function propValue(markup: string, name: string): string | null {
  const start = markup.search(new RegExp(`\\b${name}=`, 'u'));
  if (start === -1) return null;

  const from = start + name.length + 1;
  if (markup[from] !== '{') return markup.slice(from).split(/[\s>]/u)[0] ?? '';

  let braces = 0;
  for (let at = from; at < markup.length; at += 1) {
    if (markup[at] === '{') braces += 1;
    else if (markup[at] === '}' && --braces === 0) return markup.slice(from, at + 1);
  }

  return markup.slice(from);
}

/** Where the tag opening at `start` ends, skipping any `>` inside a prop's braces. */
function tagEnd(text: string, start: number): number {
  let braces = 0;

  for (let at = start + 1; at < text.length; at += 1) {
    if (text[at] === '{') braces += 1;
    else if (text[at] === '}') braces -= 1;
    else if (text[at] === '>' && braces === 0) return at + 1;
  }

  return text.length;
}

/** Whether the tag opening at `start` ends in `/>`, skipping any `>` inside a prop's braces. */
function selfCloses(text: string, start: number): boolean {
  return text.slice(start, tagEnd(text, start)).endsWith('/>');
}

function textTags(text: string): { line: number; markup: string }[] {
  return [...text.matchAll(/(?<![\w.])<Text\b/gu)].map((match) => ({
    line: text.slice(0, match.index).split('\n').length,
    markup: text.slice(match.index, tagEnd(text, match.index)),
  }));
}

/** Every Text marked hidden itself, or opening inside a View marked hidden, read tag by tag. */
function hiddenTexts(text: string): { line: number; markup: string; when: string }[] {
  const hidden: { line: number; markup: string; when: string }[] = [];
  const openViews: (string | null)[] = [];

  for (const match of text.matchAll(/(?<![\w.])<(\/?)(View|Text)\b/gu)) {
    const markup = text.slice(match.index, tagEnd(text, match.index));
    const hiddenHere = hidingCondition(markup);

    if (match[2] === 'View') {
      if (match[1] === '/') openViews.pop();
      else if (!selfCloses(text, match.index)) openViews.push(hiddenHere);
    } else if (match[1] === '') {
      const when = hiddenHere ?? openViews.findLast((view) => view !== null);

      if (when != null) {
        hidden.push({ line: text.slice(0, match.index).split('\n').length, markup, when });
      }
    }
  }

  return hidden;
}

/** The condition in `accessibilityElementsHidden={x}`, empty when it always hides, null when it is absent; a spread `StepHidden` such as `{...savedHidden}` hides while its step's `savedClosing` is set, `{...fieldHidden}` only within a close, so while `closing` is, and `{...stepHidden(x)}` while `x` is. */
function hidingCondition(markup: string): string | null {
  const at = /\baccessibilityElementsHidden\b(?:=\{(\w+)\})?/u.exec(markup);
  if (at !== null) return at[1] ?? '';

  const called = /\{\.\.\.stepHidden\((\w+)\)\}/u.exec(markup);
  if (called !== null) return called[1] ?? '';

  const spread = /\{\.\.\.(\w*?)([hH])idden\}/u.exec(markup);
  if (spread === null) return null;

  return spread[2] === 'h' || spread[1] === 'field' ? 'closing' : `${spread[1]}Closing`;
}

/** Both hiding props, after any spread, so the Text stays hidden wherever its View's hiding misses it. */
function hidesItself(markup: string): boolean {
  const after = markup.slice(markup.lastIndexOf('{...') + 1);

  return (
    /\baccessibilityElementsHidden\b/u.test(after) && /importantForAccessibility="no"/u.test(after)
  );
}

/** A spread after `accessible={false}` can carry `accessible: true` and turn it back off; `accessible={x ? false : undefined}` hides it only while x is what hides it, and leaves Android's default, which is not focusable, the rest of the time. */
function unreportable(markup: string, when = ''): boolean {
  const last = [...markup.matchAll(/\baccessible=\{(?:false|(\w+) \? false : undefined)\}/gu)].at(
    -1,
  );

  return (
    last !== undefined &&
    (last[1] === undefined || last[1] === when) &&
    !markup.slice(last.index).includes('{...')
  );
}

describe('the code step fails in the words of the flow it is in (sc-22740)', () => {
  it.each([
    ['app/sign-in-code.tsx', 'signIn'],
    ['app/reset-password.tsx', 'recovery'],
  ])('%s passes %s failure words', (file, flow) => {
    const text = readFileSync(join(...file.split('/')), 'utf8');

    expect(text).toContain(`failedTitle={t('${flow}.failedTitle')}`);
    expect(text).toContain(`failedBody={t('${flow}.failedBody')}`);
  });

  it('SecondFactorStep names no flow’s failure words itself', () => {
    expect(readFileSync(join('src', 'components', 'SecondFactorStep.tsx'), 'utf8')).not.toMatch(
      /\.failed(?:Title|Body)'/u,
    );
  });
});

describe('a notice answering a send comes into view (sc-24496)', () => {
  it.each([
    ['src/components/OrganisationDetails.tsx', ['words={saved}', 'words={failed}']],
    ['src/components/OwnershipCard.tsx', ['words={refused.message}', 'words={failed}']],
    ['app/join/[token].tsx', ['words={`${failedTitle}']],
  ])('%s brings each in through AnswerInView', (file, words) => {
    const text = readFileSync(join(...file.split('/')), 'utf8');

    for (const said of words) expect(answersInView(text, said), said).toBe(true);
  });

  it('notices a notice left where it shows', () => {
    expect(answersInView('<ReadOut words={failed} interrupts>', 'words={failed}')).toBe(false);
    expect(
      answersInView('<AnswerInView>\n  <ReadOut words={failed} interrupts>', 'words={failed}'),
    ).toBe(true);
  });
});

/** Whether the ReadOut saying `said` opens straight inside an AnswerInView. */
function answersInView(text: string, said: string): boolean {
  const at = text.indexOf(said);
  if (at < 0) return false;
  const opened = text.lastIndexOf('<ReadOut', at);

  return /<AnswerInView\b[^>]*>\s*$/u.test(text.slice(0, opened));
}

describe('a screen still reading says so in words (sc-23279)', () => {
  it.each([
    ['app/lost-two-factor.tsx', "view.kind === 'loading'"],
    ['app/reset-password.tsx', "status.kind === 'checking'"],
  ])('%s shows Pending while %s', (file, reading) => {
    expect(showsPending(readFileSync(join(...file.split('/')), 'utf8'), reading)).toBe(true);
  });

  it('notices a read that shows an empty card or nothing', () => {
    expect(showsPending('if (a) return <AuthFrame>{null}</AuthFrame>;', 'a')).toBe(false);
    expect(showsPending('if (a) return null;\n  if (b) return <Pending />;', 'a')).toBe(false);
    expect(showsPending('if (a)\n    return (\n      <AuthFrame>\n        <Pending />', 'a')).toBe(
      true,
    );
  });
});

/** Whether the branch that `reading` opens renders Pending before the next branch starts. */
function showsPending(text: string, reading: string): boolean {
  const at = text.indexOf(`if (${reading})`);
  if (at < 0) return false;

  const rest = text.slice(at + 1);
  const next = /\n\s*if \(/u.exec(rest);

  return rest.slice(0, next?.index).includes('<Pending />');
}
