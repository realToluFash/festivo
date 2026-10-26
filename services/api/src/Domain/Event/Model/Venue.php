<?php

declare(strict_types=1);

namespace App\Domain\Event\Model;

use App\Address\Model\Address;

/** Where an event is (sc-3589): a name, an address, or both. An address typed rather than picked carries its formatted line alone. */
final readonly class Venue
{
    public const int NAME_MAXIMUM = 120;

    public const int ADDRESS_MAXIMUM = 300;

    public function __construct(
        public ?string $name,
        public ?Address $address,
    ) {
    }
}
