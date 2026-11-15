import type { TFunction } from 'i18next';
import type { OrganisationMember, OrganisationRole } from '@soirely/api-client';
import { memberStatusWord, roleName } from '@soirely/domain';

import type { MarkKind } from '../../../components/SettingsParts.tsx';

type Word = TFunction;

const KINDS: Record<OrganisationMember['status'], MarkKind> = {
  active: 'yes',
  pending_approval: 'waiting',
  suspended: 'paused',
  left_or_removed: 'ended',
};

/** A member's state as a tag: its mark and its word. */
export function memberTag(t: Word, member: OrganisationMember): { kind: MarkKind; word: string } {
  return { kind: KINDS[member.status], word: memberStatusWord((key) => t(key), member) };
}

/** The roles as choices: each by its name, what it means, and Now on the one held. */
export function roleChoices(t: Word, roles: readonly OrganisationRole[], now?: string) {
  return roles.map((one) => ({
    name: roleName(t, one),
    line: one.seededAs == null ? null : t(`membersScreen.roleMeans.${one.seededAs}`),
    now: one.id === now,
  }));
}
