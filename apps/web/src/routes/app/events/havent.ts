import { type Counts } from '@soirely/domain';
import { type TFunction } from 'i18next';

/** "25 haven’t replied (21 guests and 4 companions).", the bracket only with a companion among them, and "Everyone has replied." at 0. */
export function haventLine(t: TFunction, counts: Counts): string {
  if (counts.havent === 0) return t('guestList.everyoneReplied');
  const havent = t('guestList.havent', { count: counts.havent });

  return counts.haventCompanions === 0
    ? t('guestList.haventLine', { havent })
    : t('guestList.haventWho', {
        havent,
        guests: t('guestList.countGuests', { count: counts.haventGuests }),
        companions: t('guestList.countCompanions', { count: counts.haventCompanions }),
      });
}
