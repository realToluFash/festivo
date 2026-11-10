import { roleHolds } from '@soirely/domain';

/** Edit is offered by the event's own permissions, read with each load, never by the organisation's role (sc-29914). */
export function offersEdit(event: { permissions: readonly string[] } | null): boolean {
  return event != null && roleHolds(event, 'events.manage');
}
