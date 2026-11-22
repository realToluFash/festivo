<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use Psl\SecureRandom;
use Psl\Str;

/** Crockford's base32, so I, L and O typed by hand read as 1, 1 and 0. */
final readonly class DoorCodeText
{
    public const string ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public const int LENGTH = 8;

    public static function generate(): string
    {
        return SecureRandom\string(self::LENGTH, self::ALPHABET);
    }

    /** Null when what was typed cannot be a code, so it is refused before any lookup. */
    public static function normalise(string $typed): ?string
    {
        $code = Str\replace_every(Str\uppercase($typed), [' ' => '', '-' => '', 'I' => '1', 'L' => '1', 'O' => '0']);

        if (self::LENGTH !== Str\length($code)) {
            return null;
        }

        foreach (Str\chunk($code) as $character) {
            if (null === Str\search(self::ALPHABET, $character)) {
                return null;
            }
        }

        return $code;
    }
}
