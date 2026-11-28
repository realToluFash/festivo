<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use Psl\Iter;
use Psl\Regex;
use Psl\Str;

/** The token registry (sc-3960), kept with packages/domain's messageTokens: a token is its name between two private-use marks, so typed braces stay text. */
final class MessageTokens
{
    public const string OPEN = "\u{E000}";

    public const string CLOSE = "\u{E001}";

    /** What Insert offers; another epic adds its token here and to packages/domain's list. */
    public const array INSERTABLE = ['greeting', 'event', 'date', 'hosts'];

    /** True when every mark opens and closes one token Insert offers, and no mark stands alone. */
    public static function wellFormed(string $message): bool
    {
        $left = Regex\replace_with($message, '/\x{E000}([a-z]+)\x{E001}/u', static fn (array $match): string => Iter\contains(self::INSERTABLE, $match[1]) ? '' : self::OPEN);

        return !Str\contains($left, self::OPEN) && !Str\contains($left, self::CLOSE);
    }

    public static function token(string $name): string
    {
        return self::OPEN . $name . self::CLOSE;
    }
}
