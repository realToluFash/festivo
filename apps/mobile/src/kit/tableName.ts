import type { FloorTable } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** A table or row by its name; a block of single seats by its first and last seats, so Floor and a kitchen station say the same words. */
export function tableName(
  t: TFunction,
  { name, seats }: Pick<FloorTable, 'name' | 'seats'>,
): string {
  if (name != null) return name;

  return seats.length === 1
    ? t('service.floor.seat', { seat: seats[0] })
    : t('service.floor.seatRange', { first: seats[0], last: seats.at(-1) });
}
