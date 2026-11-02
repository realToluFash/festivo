import { StyleSheet } from 'react-native';

import { tokens } from '../theme/tokens.ts';

/** A row of Ways to sign in: the password's and each provider's. */
export const wayRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  detail: { flex: 1, minWidth: 160, gap: tokens.spaceXxs },
});
