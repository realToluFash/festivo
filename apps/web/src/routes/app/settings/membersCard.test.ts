import type { MembersList, OrganisationMember } from '@soirely/api-client';
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
});
