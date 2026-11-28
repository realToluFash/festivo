import type { TFunction } from 'i18next';

export function blockName(
  t: TFunction,
  { name, seats }: { name: string | null; seats: readonly string[] },
): string {
  if (name != null) return name;

  return seats.length === 1
    ? t('service.floor.seat', { seat: seats[0] })
    : t('service.floor.seatRange', { first: seats[0], last: seats.at(-1) });
}
