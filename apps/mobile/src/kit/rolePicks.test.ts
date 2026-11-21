import { describe, expect, it } from 'vitest';

import { RolePicks } from './rolePicks.ts';

describe('RolePicks', () => {
  it('saves a role as it is picked', () => {
    const picks = new RolePicks('can_view');
    const sent = picks.pick();

    expect(picks.saved(sent, 'can_edit')).toEqual({ kind: 'saved', role: 'can_edit' });
  });

  it('goes back to the role it had when a save fails', () => {
    const picks = new RolePicks('can_view');

    expect(picks.refused(picks.pick())).toEqual({ kind: 'failed', held: 'can_view' });
  });

  it('goes back to the last role saved, not the one it opened with', () => {
    const picks = new RolePicks('can_view');
    picks.saved(picks.pick(), 'can_edit');

    expect(picks.refused(picks.pick())).toEqual({ kind: 'failed', held: 'can_edit' });
  });

  it('lets only the latest pick speak while it is out', () => {
    const picks = new RolePicks('can_view');
    const first = picks.pick();
    const second = picks.pick();

    expect(picks.saved(first, 'can_edit')).toBeNull();
    expect(picks.refused(first)).toBeNull();
    expect(picks.saved(second, 'lead')).toEqual({ kind: 'saved', role: 'lead' });
  });

  it('shows an earlier pick that lands after the latest failed, since the API now holds it', () => {
    const picks = new RolePicks('can_view');
    const first = picks.pick();
    const second = picks.pick();

    expect(picks.refused(second)).toEqual({ kind: 'failed', held: 'can_view' });
    expect(picks.saved(first, 'can_edit')).toEqual({ kind: 'overtaken', role: 'can_edit' });
  });
});
