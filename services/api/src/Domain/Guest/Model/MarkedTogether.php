<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** What one Mark as invited on many guests did (sc-46880): `already` were invited before, by a mark or a reply, `gone` were not on the list to mark, removed by someone else included. */
final readonly class MarkedTogether
{
    public function __construct(
        public int $marked,
        public int $already,
        public int $gone,
    ) {
    }
}
