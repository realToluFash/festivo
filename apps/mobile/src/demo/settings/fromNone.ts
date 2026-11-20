import { NO_ORG_HOME } from '../outsideEvents/OutsideModel.ts';

/** Which no-organisation board opened Settings: ?state=managed or ?state=invitations, or the plain one (sc-75471). */
export type NoOrgBoard = 'managed' | 'invitations';

export function noOrgBoardOf(state: string | undefined): NoOrgBoard | null {
  return state === 'managed' || state === 'invitations' ? state : null;
}

export function fromNoneOf(board: NoOrgBoard | null): string {
  return board == null ? 'none' : `none.${board}`;
}

/** Undefined when Settings was not opened from no organisation. */
export function boardFrom(from: string | undefined): NoOrgBoard | null | undefined {
  if (from === 'none') return null;
  if (from?.startsWith('none.') !== true) return undefined;

  return noOrgBoardOf(from.slice('none.'.length));
}

/** Settings' own list for no organisation, as You are not in an organisation's Your account opens it (sc-75471). */
export function noOrgSettings(board: NoOrgBoard | null): string {
  return `/demo/settings?as=noOrg&from=${fromNoneOf(board)}`;
}

export function noOrgHome(board: NoOrgBoard | null): string {
  return board == null ? NO_ORG_HOME : `${NO_ORG_HOME}&state=${board}`;
}
