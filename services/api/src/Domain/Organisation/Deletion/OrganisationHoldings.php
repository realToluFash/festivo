<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Entity\Organisation;
use App\Repository\EventRepository;
use App\Repository\MembershipRepository;

/** What a deletion destroys, counted for the confirmation (sc-68). */
final readonly class OrganisationHoldings
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EventRepository $eventRepository,
    ) {
    }

    /** @return array{events: int, guests: int, members: int} guests are none until the guest list (sc-1468) stores them */
    public function of(Organisation $organisation): array
    {
        return [
            'events' => $this->eventRepository->countInOrganisation($organisation),
            'guests' => 0,
            'members' => $this->membershipRepository->countActiveIn($organisation),
        ];
    }
}
