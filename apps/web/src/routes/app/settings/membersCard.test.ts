import type { MembersList, OrganisationMember, RecoveryRequest } from '@soirely/api-client';
import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { membersCard } from './membersCard.ts';

function member(
  id: string,
  name: string,
  status: OrganisationMember['status'],
): OrganisationMember {
  return {
    id,
    user: { id: `u_${id}`, name, email: `${id}@ire.events` },
    role: { id: 'role_5', seededAs: 'member', name: null },
    status,
    former: status === 'left_or_removed' ? 'removed' : null,
    channel: 'request',
    message: null,
    since: '2026-11-02T09:00:00+00:00',
    removesAt: null,
    invitedBy: null,
    invitedAt: null,
    self: false,
    history: [],
    suspension: null,
  };
}

const LIST: MembersList = {
  members: [
    member('folake', 'Folake Adeyemi', 'active'),
    member('bisi', 'Bisi Ade', 'suspended'),
    member('lucia', 'Lucía Gómez', 'pending_approval'),
    member('chidi', 'Chidi Okoro', 'left_or_removed'),
  ],
  invitations: [],
};

const card = (manages: boolean, notice: Parameters<typeof membersCard>[0]['notice'] = null) =>
  membersCard({ list: LIST, manages, notice, organisation: 'Ìrè Events', t: i18next.t });

describe('Members’ summary card', () => {
  beforeAll(async () => {
    await i18next.changeLanguage('en');
  });

  it('counts the people and who waits, and its step answers the oldest request', () => {
    const shown = card(true);

    expect(shown.says).toBe('2 people · 1 waiting');
    expect(shown.step).toEqual({ label: 'Answer Lucía Gómez', does: 'answer', member: 'lucia' });
    expect(shown.faces.map((one) => one.id)).toEqual(['folake', 'bisi']);
  });

  it('has no step, and no waiting, for somebody who cannot answer requests', () => {
    const shown = card(false);

    expect(shown.says).toBe('2 people');
    expect(shown.step).toBeNull();
  });

  it('says what an answer came to, with its next step', () => {
    expect(card(true, { kind: 'sent', email: 'chidi@ire.events' })).toMatchObject({
      says: 'Invitation sent to chidi@ire.events',
      lines: ['Nobody has an account here until they accept.'],
      step: null,
    });
    expect(card(true, { kind: 'turnedDown', name: 'Lucía Gómez' })).toMatchObject({
      says: 'You turned down Lucía Gómez',
      step: { does: 'former', label: 'See Former' },
    });
    expect(card(true, { kind: 'removed', name: 'Chidi Okoro' }).step).toMatchObject({
      does: 'answer',
      member: 'lucia',
    });
  });

  describe('with requests to get back in (sc-30189)', () => {
    const recovery = (id: string, name: string, own = false): RecoveryRequest => ({
      id,
      userId: `u_${id}`,
      name,
      email: `${id}@ire.events`,
      provedPhone: true,
      own,
      organisations: ['Ìrè Events'],
      organisationIds: ['org_1'],
      askedAt: '2026-11-03T17:05:00+00:00',
      asked: null,
      expiresAt: '2026-11-10T17:05:00+00:00',
      expires: null,
    });
    const KOFI = recovery('kofi', 'Kofi Mensah');
    const PRIYA = recovery('priya', 'Priya Shah');
    const withRecoveries = (
      recoveries: RecoveryRequest[],
      notice: Parameters<typeof membersCard>[0]['notice'] = null,
      list: MembersList = LIST,
    ) =>
      membersCard({
        list,
        recoveries,
        manages: true,
        notice,
        organisation: 'Ìrè Events',
        t: i18next.t,
      });

    it('counts them with the requests to join, says both kinds, and answers the oldest request to get back in first', () => {
      const shown = withRecoveries([KOFI, PRIYA]);

      expect(shown.says).toBe('2 people · 3 waiting');
      expect(shown.lines).toEqual(['2 to get back in · 1 to join']);
      expect(shown.step).toEqual({ label: 'Answer Kofi Mensah', does: 'recover', request: 'kofi' });
    });

    it('has no second line while only one kind waits', () => {
      const noJoin = { ...LIST, members: LIST.members.filter((one) => one.id !== 'lucia') };

      expect(withRecoveries([KOFI], null, noJoin)).toMatchObject({
        says: '2 people · 1 waiting',
        lines: [],
      });
      expect(withRecoveries([]).lines).toEqual([]);
    });

    it('never counts or answers the viewer’s own request', () => {
      const shown = withRecoveries([recovery('julien', 'Julien Moreau', true)]);

      expect(shown.says).toBe('2 people · 1 waiting');
      expect(shown.step).toMatchObject({ does: 'answer', member: 'lucia' });
    });

    it('says what an answer came to, and steps on to the next request', () => {
      expect(
        withRecoveries([PRIYA], { kind: 'recovered', name: 'Kofi Mensah', answer: 'approve' }),
      ).toMatchObject({
        says: 'Kofi Mensah’s two-factor is off.',
        lines: ['They’re emailed now, and every session they had has ended.'],
        step: { label: 'Answer Priya Shah', does: 'recover', request: 'priya' },
      });
      expect(
        withRecoveries([], { kind: 'recovered', name: 'Priya Shah', answer: 'turnDown' }),
      ).toMatchObject({
        says: 'Priya Shah’s request is turned down.',
        lines: ['Two-factor stays on for them, and they’re emailed.'],
        step: { label: 'Answer Lucía Gómez', does: 'answer', member: 'lucia' },
      });
    });

    it('answers the next request to get back in after a removal', () => {
      expect(withRecoveries([PRIYA], { kind: 'removed', name: 'Kofi Mensah' }).step).toMatchObject({
        does: 'recover',
        request: 'priya',
      });
    });
  });
});
