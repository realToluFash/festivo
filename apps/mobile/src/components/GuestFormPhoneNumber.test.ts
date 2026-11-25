import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join('src', 'components', file), 'utf8');

const form = read('GuestForm.tsx');
const formEntry = form.slice(form.indexOf('<PhoneEntry'));
const phoneEntry = formEntry.slice(0, formEntry.indexOf('/>'));

const entry = read('PhoneEntry.tsx');
const field = entry.slice(entry.indexOf('<TextField'));
const textField = field.slice(0, field.indexOf('/>'));

describe('Edit guest opens with the guest mobile number (sc-3785)', () => {
  it('hands the number the form holds to PhoneEntry', () => {
    expect(phoneEntry).toContain('number={values.number}');
  });

  it('shows that number in the field', () => {
    expect(textField).toContain('value={number}');
  });
});
