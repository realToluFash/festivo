<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Entity\Organisation;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use App\Repository\MembershipRepository;

/** What a deletion destroys, counted for the confirmation (sc-68). */
final readonly class OrganisationHoldings
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EventRepository $eventRepository,
        private GuestRepository $guestRepository,
    ) {
    }

    /** @return array{events: int, guests: int, members: int} guests counts companions too, as each event's Guests header does */
    public function of(Organisation $organisation): array
    {
        return [
            'events' => $this->eventRepository->countInOrganisation($organisation),
            'guests' => $this->guestRepository->countInOrganisation($organisation),
            'members' => $this->membershipRepository->countActiveIn($organisation),
        ];
    }
}
