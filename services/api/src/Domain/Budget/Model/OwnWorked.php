<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

/** The hours one person on their own rate clocked on their job, at that rate. */
final readonly class OwnWorked
{
    public function __construct(
        public string $person,
        public string $job,
        public int $minutes,
        public int $costMinor,
    ) {
    }
}
