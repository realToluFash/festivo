<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Access;

use Symfony\Component\Uid\Uuid;

final readonly class FixtureTable
{
    public function __construct(
        public Uuid $id,
        public Uuid $eventId,
    ) {
    }
}
