import type { InvitationRefusalCode } from '@soirely/domain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RefusalAnswer } from './OrgMenu.tsx';

function refuse(refusal: InvitationRefusalCode, inviter: string | null) {
  render(
    <RefusalAnswer
      refusal={refusal}
      inviter={inviter}
      organisation="Ire Events"
      email="ada@example.com"
      signedInAs="ada@example.com"
    />,
  );
}

describe('the answer to a refused invitation (sc-30412)', () => {
  it('asks the named inviter for a new one when it has expired, as an alert', () => {
    refuse('invitation_expired', 'Tunde');

    expect(screen.getByRole('alert').textContent).toBe(
      'Expired This invitation has expired. Ask Tunde to send a new one.',
    );
  });

  it('asks whoever invited you when the expired invitation names nobody', () => {
    refuse('invitation_expired', null);

    expect(screen.getByRole('alert').textContent).toBe(
      'Expired This invitation has expired. Ask whoever invited you to send a new one.',
    );
  });

  it('says quietly that the organisation withdrew it', () => {
    refuse('invitation_revoked', 'Tunde');

    expect(screen.getByRole('status').textContent).toBe(
      'Withdrawn This invitation was withdrawn by Ire Events. If you think this is a mistake, ask the person who invited you.',
    );
  });

  it('says the same of a withdrawn invitation that names nobody', () => {
    refuse('invitation_revoked', null);

    expect(screen.getByRole('status').textContent).toBe(
      'Withdrawn This invitation was withdrawn by Ire Events. If you think this is a mistake, ask the person who invited you.',
    );
  });
});
