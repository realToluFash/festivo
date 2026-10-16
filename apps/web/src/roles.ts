import type { MemberRole } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** A seeded role is worded here, in the reader's language; a role an organisation made keeps its own name. */
export function roleName(t: TFunction, role: MemberRole): string {
  return role.seededAs != null ? t(`roles.${role.seededAs}`) : (role.name ?? '');
}
