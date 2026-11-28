<?php

declare(strict_types=1);

namespace App\Domain\Service\Model;

use App\Entity\Guest;
use App\Entity\SeatingSection;

/** What a tray serves (sc-4005): a table, a row, or a block of ten of a section's single seats, with its guests in seat order. */
final readonly class ServingTable
{
    /**
     * @param 'table'|'row'|'block'                   $kind
     * @param list<string>                            $seats  a block's seat names, in label order
     * @param list<array{guest: Guest, seat: string}> $guests in seat order
     */
    public function __construct(
        public string $key,
        public string $kind,
        public ?string $name,
        public array $seats,
        public ?SeatingSection $section,
        public array $guests,
    ) {
    }
}
