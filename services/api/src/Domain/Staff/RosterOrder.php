<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Entity\StaffMember;
use App\Locale\NameNormaliser;
use Psl\Vec;

/** The roster's order: by shift start, then name (sc-3906). Until sc-3908 gives anyone a shift, by name alone, ignoring case and accents. */
final readonly class RosterOrder
{
    /**
     * @param list<StaffMember> $entries
     *
     * @return list<StaffMember>
     */
    public static function sort(array $entries): array
    {
        return Vec\sort_by($entries, static fn (StaffMember $entry): string => NameNormaliser::key($entry->getFullName()));
    }
}
