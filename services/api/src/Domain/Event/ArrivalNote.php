<?php

declare(strict_types=1);

namespace App\Domain\Event;

use Normalizer;
use Psl\Str;

/** The host's arrival note as it is saved and counted; packages/domain's arrivalNote counts the same way (sc-24385). */
final class ArrivalNote
{
    /** What JavaScript's trim() strips, so the clients' count and this one agree at the edge. */
    private const string TRIMMED = " \t\n\v\f\r\u{A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}";

    /** Trimmed and in NFC; one of only spaces or blank lines is no note. */
    public static function saved(?string $typed): ?string
    {
        $trimmed = Str\trim($typed ?? '', self::TRIMMED);

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
