<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Entity\StaffMember;
use App\Repository\StaffMemberRepository;

/** Whom a person on the staff answers to (sc-3910): their station's lead, else the floor lead, and never themself. */
final readonly class LeadFinder
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
    ) {
    }

    /** @param ?StaffMember $floorLead the event's floor lead, when the caller has already read it for a whole roster */
    public function leadOf(StaffMember $entry, ?StaffMember $floorLead = null): ?StaffMember
    {
        $own = $entry->getStation()?->getLead();

        if (null !== $own && $own !== $entry) {
            return $own;
        }

        $floor = $floorLead ?? $this->staffMemberRepository->findOneBy(['event' => $entry->getEvent(), 'floorLead' => true]);

        return null === $floor || $floor === $entry ? null : $floor;
    }
}
