import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { answer, sending, sessionFor, withoutPlaces } from '../OrgSwitcherModel.ts';
import {
  boardFrom,
  fromNoneOf,
  noOrgBoardOf,
  noOrgHome,
  noOrgSettings,
} from '../settings/fromNone.ts';
import { invitationRowOf, NO_ORG_IDS, wayOnShows } from './NoOrgInvitationsModel.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const ALAMEDA = 'org-celebraciones-alameda';
const invited = withoutPlaces(sessionFor('one'), true);

describe('no organisation, with invitations waiting (sc-75471)', () => {
  it('lists them in place of the way-on line', () => {
    expect(wayOnShows(invited.invitations)).toBe(false);
    expect(wayOnShows(withoutPlaces(sessionFor('one')).invitations)).toBe(true);
    const page = read('src', 'demo', 'createOrg', 'NoOrganisation.tsx');
    expect(page).toMatch(
      /wayOn \?[\s\S]*noOrganisation\.wayOn[\s\S]*: \(\s*<NoOrgInvitations \/>/u,
    );
  });

  it('offers both answers by name, then Joining… with both off while one is sent', () => {
    const waiting = invitationRowOf(invited.outcomes[ALAMEDA]);
    expect(waiting.kind).toBe('answers');
    if (waiting.kind !== 'answers') return;
    expect(i18n.t(waiting.accept.accessibilityLabel, { organisation: 'Alameda' })).toBe(
      'Accept and join Alameda',
    );
    expect([waiting.accept.off, waiting.decline.off]).toEqual([false, false]);

    const joining = invitationRowOf(sending(invited, ALAMEDA, true).outcomes[ALAMEDA]);
    if (joining.kind !== 'answers') throw new Error(joining.kind);
    expect(i18n.t(joining.accept.label)).toBe('Joining…');
    expect(joining.accept).toMatchObject({ off: true, busy: true });
    expect(joining.decline).toMatchObject({ off: true, busy: false });
  });

  it('keeps a declined one in the list with its notice, and shows Open once joined', () => {
    const declined = answer(invited, ALAMEDA, false);
    expect(declined.invitations.map((invite) => invite.id)).toContain(ALAMEDA);
    expect(invitationRowOf(declined.outcomes[ALAMEDA])).toEqual({ kind: 'declined' });
    expect(invitationRowOf(answer(invited, ALAMEDA, true).outcomes[ALAMEDA])).toEqual({
      kind: 'joined',
    });
  });

  it('renders each row and answer under the testIDs QA drives', () => {
    expect(NO_ORG_IDS.row(ALAMEDA)).toBe(`noOrganisation.invitation.${ALAMEDA}`);
    expect(NO_ORG_IDS.accept(ALAMEDA)).toBe(`noOrganisation.invitation.${ALAMEDA}.accept`);
    expect(NO_ORG_IDS.decline(ALAMEDA)).toBe(`noOrganisation.invitation.${ALAMEDA}.decline`);
    expect(NO_ORG_IDS.open(ALAMEDA)).toBe(`noOrganisation.invitation.${ALAMEDA}.open`);
    const rows = read('src', 'demo', 'createOrg', 'NoOrgInvitations.tsx');
    for (const part of [
      'list',
      'row(invite.id)',
      'accept(invite.id)',
      'decline(invite.id)',
      'open(invite.id)',
    ]) {
      expect(rows).toContain(`testID={NO_ORG_IDS.${part}}`);
    }
    expect(rows).toContain('invitationRowOf(outcomes[invite.id])');
  });
});

describe('Your account from no organisation, and the way back (sc-75471)', () => {
  it.each([null, 'managed', 'invitations'] as const)(
    'returns to the %s board it came from',
    (board) => {
      const href = noOrgSettings(board);
      const from = new URLSearchParams(href.split('?')[1]).get('from') ?? undefined;
      expect(boardFrom(from)).toBe(board);
      expect(fromNoneOf(board)).toBe(from);
      const home = new URLSearchParams(noOrgHome(board).split('?')[1]);
      expect(home.get('orgs')).toBe('none');
      expect(noOrgBoardOf(home.get('state') ?? undefined)).toBe(board);
    },
  );

  it('is not from no organisation without from=none', () => {
    expect(boardFrom(undefined)).toBeUndefined();
    expect(boardFrom('events')).toBeUndefined();
  });
});
