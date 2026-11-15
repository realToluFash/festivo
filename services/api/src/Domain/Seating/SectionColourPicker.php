<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Enum\SectionColour;
use Psl\Iter;
use Psl\Vec;

/** A new section's colour when none is chosen (sc-3998, 21 Oct). */
final class SectionColourPicker
{
    /**
     * The least used, the first in palette order on a tie.
     *
     * @param list<SectionColour> $taken one entry per section
     */
    public static function leastUsed(array $taken): SectionColour
    {
        $best = SectionColour::Blue;
        $fewest = null;

        foreach (SectionColour::cases() as $colour) {
            $uses = Iter\count(Vec\filter($taken, static fn (SectionColour $used): bool => $used === $colour));

            if (null === $fewest || $uses < $fewest) {
                $best = $colour;
                $fewest = $uses;
            }
        }

        return $best;
    }
}
