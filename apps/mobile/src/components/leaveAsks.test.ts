import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const HERE = join(import.meta.dirname);
const read = (path: string) => readFileSync(join(HERE, path), 'utf8');

const FORMS = [
  'NewEvent.tsx',
  'EventEdits.tsx',
  'PeopleParts.tsx',
  'GuestForm.tsx',
  'ThankYou.tsx',
  'OrganisationDetails.tsx',
  'MemberRole.tsx',
  'MemberRequest.tsx',
  'AccountName.tsx',
  'AccountAdd.tsx',
  'AccountZone.tsx',
  'SecurityPassword.tsx',
  'CreateWalkWindow.tsx',
];

describe('a form whose Cancel asks before discarding asks on every way out (sc-82245)', () => {
  it.each(FORMS)('%s holds its ask for every way out, Cancel included', (file) => {
    const text = read(file);

    expect(text).toMatch(/useLeaveAsk\(/u);
    expect(text).toMatch(/useLeaveAsk\([\s\S]*?,\s*(?:onClose|close|onCancel),?\s*\)/u);
    expect(text).toMatch(/leaves\.leave\(\)/u);
    expect(text).toMatch(/leaves\.keep\(\)/u);
    expect(text).toMatch(/leaves\.discard\(\)/u);
  });

  it('leaves no Cancel that opens a discard ask by itself', () => {
    const offenders = readdirSync(HERE)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) =>
        /discardAsk\(|title: t\('(?:[A-Za-z]+\.discardTitle|eventEdit\.leaveTitle)'/u.test(
          read(file),
        ),
      )
      .filter((file) => /onKeep|keep:/u.test(read(file)))
      .filter((file) => !read(file).includes('useLeaveAsk('));

    expect(offenders).toEqual([]);
  });
});

describe('each way out goes through the hold (sc-82245)', () => {
  it('a tab or sidebar destination', () => {
    expect(read('AppFrame.tsx')).toMatch(/function goTo[\s\S]{0,200}leaveThen\(/u);
  });

  it('another organisation chosen in the switcher', () => {
    expect(read('../signedIn.ts')).toMatch(
      /export function switchOrganisation[\s\S]{0,500}leaveThen\(go\)/u,
    );
  });

  it('Sign out, while a session ended elsewhere does not ask', () => {
    const signedIn = read('../signedIn.ts');

    expect(signedIn).toMatch(/export function signOutHere\(\): void \{\s*leaveThen\(/u);
    expect(signedIn).toMatch(/export function endedHere\(\): void \{\s*leaveWithoutAsking\(\);/u);
    expect(read('../api.ts')).toMatch(/signedOutHold\(\(why\) => \{\s*leaveWithoutAsking\(\);/u);
  });

  it('a notification tapped', () => {
    expect(read('../appPush.ts')).toMatch(/openFromOutside\(String\(place\), \(discarding\) =>/u);
  });

  it('an open sheet registers to close, and a link goes through the same ask', () => {
    expect(read('Sheet.tsx')).toMatch(/noteOpenSheet\(\s*\(\) => closeRef\.current()/u);
    expect(read('../../app/+native-intent.tsx')).toMatch(/openFromOutside\(\s*linkedPath\(path\)/u);
  });

  it('the header’s Back, the swipe back and Android’s back', () => {
    expect(read('useLeaveAsk.ts')).toMatch(
      /usePreventRemove\(changed, \(\{ repeat \}\) =>\s*leaveThen\(repeat, undefined, true\),?\s*\)/u,
    );
  });
});
