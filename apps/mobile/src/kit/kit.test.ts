import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { codeProps, FIELD_DEFAULTS, passwordProps } from './fields.ts';
import { keyboardLift } from './keyboard.ts';

describe('the keyboard lifts the card once', () => {
  it('on iOS, by the scroll view alone', () => {
    expect(keyboardLift('ios')).toEqual({ avoid: null, adjustScrollInsets: true });
  });

  it('on Android, by the avoiding view alone', () => {
    expect(keyboardLift('android')).toEqual({ avoid: 'padding', adjustScrollInsets: false });
  });

  it('never by both on one platform', () => {
    for (const os of ['ios', 'android', 'web']) {
      const lift = keyboardLift(os);

      expect(lift.avoid != null && lift.adjustScrollInsets, os).toBe(false);
    }
  });
});

describe('every field carries the caret colour', () => {
  it('in the defaults, the password field and the code field', () => {
    for (const props of [
      FIELD_DEFAULTS,
      passwordProps(false),
      passwordProps(true),
      codeProps(false),
      codeProps(true),
    ]) {
      expect(props.cursorColor).toBe(tokens.colorInk);
      expect(props.selectionColor).toBe(tokens.colorInk);
      expect(props.autoCorrect).toBe(false);
      expect(props.spellCheck).toBe(false);
    }
  });
});

describe('the password field reveals', () => {
  it('hides by default and shows on request', () => {
    expect(passwordProps(false).secureTextEntry).toBe(true);
    expect(passwordProps(true).secureTextEntry).toBe(false);
  });

  it('keeps autocorrect off while revealed, and never blocks a paste', () => {
    const revealed = passwordProps(true);

    expect(revealed.autoCorrect).toBe(false);
    expect(revealed.autoCapitalize).toBe('none');
    expect(revealed.contextMenuHidden).toBe(false);
  });
});

describe('a code field offers the keyboard its code needs', () => {
  it('digits only, for a code that can only be digits', () => {
    expect(codeProps(false).keyboardType).toBe('number-pad');
  });

  it('letters and the hyphen, for a field that also takes a recovery code', () => {
    expect(codeProps(true).keyboardType).toBe('default');
    expect(codeProps(true).autoCapitalize).toBe('none');
  });
});
