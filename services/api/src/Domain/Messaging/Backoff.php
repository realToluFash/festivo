<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use Psl\Math;

/** Five attempts over about an hour (epic 36, §2): 4, 8, 16 and 32 minutes between them, each moved by up to a quarter either way. */
final readonly class Backoff
{
    public const int ATTEMPTS = 5;

    private const int FIRST_SECONDS = 240;

    /** @param float $jitter between -1 and 1 */
    public static function secondsAfter(int $attempt, float $jitter): int
    {
        $base = self::FIRST_SECONDS * (2 ** Math\maxva(0, $attempt - 1));

        return (int) Math\round($base * (1 + 0.25 * Math\clamp($jitter, -1.0, 1.0)));
    }
}
