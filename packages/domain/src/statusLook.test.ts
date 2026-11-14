import { describe, expect, it } from 'vitest';

import { EVENT_PHASES } from './eventStates.ts';
import { INVITATION_LOOK, PHASE_LOOK, memberStatusLook } from './statusLook.ts';

describe('status looks', () => {
  it('gives every event phase a shape of its own', () => {
    const shapes = EVENT_PHASES.map((phase) => PHASE_LOOK[phase].shape);

    expect(new Set(shapes).size).toBe(EVENT_PHASES.length);
  });

  it('tells a member’s states apart by shape, not only by colour (sc-23172)', () => {
    const looks = (['active', 'pending_approval', 'suspended', 'left_or_removed'] as const).map(
      (status) => memberStatusLook({ status }),
    );

    expect(new Set(looks.map((look) => look.shape)).size).toBe(4);
    expect(memberStatusLook({ status: 'active' })).toEqual({ tone: 'accent', shape: 'dot' });
    expect(memberStatusLook({ status: 'pending_approval' }).tone).toBe('attention');
  });

  it('marks a pending invitation as waiting and an accepted one as done', () => {
    expect(INVITATION_LOOK.pending).toEqual({ tone: 'attention', shape: 'half' });
    expect(INVITATION_LOOK.accepted).toEqual({ tone: 'accent', shape: 'tick' });
    expect(INVITATION_LOOK.expired.tone).toBe('neutral');
  });
});
