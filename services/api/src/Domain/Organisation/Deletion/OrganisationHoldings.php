<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Entity\Organisation;
use App\Repository\MembershipRepository;
use Psl\Iter;

/** What a deletion destroys, counted for the confirmation (sc-68). */
final readonly class OrganisationHoldings
{
    public function __construct(
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** @return array{events: int, guests: int, members: int} events and guests are none until the Events epic stores them, as NoEvents answers */
    public function of(Organisation $organisation): array
    {
        return [
            'events' => 0,
            'guests' => 0,
            'members' => Iter\count($this->membershipRepository->findActiveIn($organisation)),
        ];
    }
}
