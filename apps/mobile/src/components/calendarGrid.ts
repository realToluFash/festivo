import { StyleSheet } from 'react-native';

import { tokens } from '../theme/tokens.ts';

/** The month grid's card, rows, heads and cells, shared by the grid and the skeleton that waits in its place. */
export const calendarGrid = StyleSheet.create({
  grid: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: tokens.radiusCardDesktop,
    backgroundColor: tokens.colorCard,
  },
  week: { flexDirection: 'row' },
  head: { flex: 1, paddingVertical: tokens.spaceSm, textAlign: 'center' },
  cell: {
    flex: 1,
    minHeight: 96,
    padding: tokens.spaceXxs,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: tokens.colorBorder,
  },
  cellPhone: { minHeight: 56, padding: 2 },
  number: {
    alignSelf: 'flex-start',
    minWidth: tokens.sizeMark,
    minHeight: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
  },
});
