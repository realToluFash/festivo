<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Locale\NameNormaliser;
use Psl\Vec;

/** The roster's order (sc-3906): by the start of each person's earliest shift, then by name ignoring case and accents; anyone on no shift after them. */
final readonly class RosterOrder
{
    /**
     * @param list<StaffMember>               $entries
     * @param array<string, list<StaffShift>> $shifts  each person's shifts by start, keyed by their id
     *
     * @return list<StaffMember>
     */
    public static function sort(array $entries, array $shifts = []): array
    {
        return Vec\sort_by($entries, static function (StaffMember $entry) use ($shifts): string {
            $first = $shifts[$entry->getId()->toRfc4122()][0] ?? null;

            return (null === $first ? '1|' : '0|' . $first->getStartsAt()->format('Y-m-d H:i')) . '|' . NameNormaliser::key($entry->getFullName());
        });
    }
}
