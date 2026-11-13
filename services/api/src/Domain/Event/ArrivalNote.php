<?php

declare(strict_types=1);

namespace App\Domain\Event;

use Normalizer;
use Psl\Str;

/** The host's arrival note as it is saved and counted; packages/domain's arrivalNote counts the same way (sc-24385). */
final class ArrivalNote
{
    /** Trimmed and in NFC; one of only spaces or blank lines is no note. */
    public static function saved(?string $typed): ?string
    {
        $trimmed = Str\trim($typed ?? '');

        if ('' === $trimmed) {
            return null;
        }

        $normalised = \normalizer_normalize($trimmed, Normalizer::FORM_C);

        return false === $normalised ? $trimmed : $normalised;
    }

    /** In code points, so é, ñ, ç and 🚗 count one each. */
    public static function length(string $saved): int
    {
        return Str\length($saved);
    }
}
