<?php

declare(strict_types=1);

namespace App\Domain\Staff\Briefing;

use App\Domain\Staff\LeadFinder;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Repository\StaffShiftRepository;
use Psl\Hash;
use Psl\Json;
use Psl\Vec;

/** What a person's briefing tells them that can change under them: their station, their shifts and their lead (sc-3917). The rules are left out, since changing them sets no Changed since sent. */
final readonly class BriefingPrinter
{
    public function __construct(
        private LeadFinder $leadFinder,
        private StaffShiftRepository $staffShiftRepository,
    ) {
    }

    /**
     * @param ?list<StaffShift> $shifts the person's shifts, read when null
     */
    public function printOf(StaffMember $entry, ?array $shifts = null, ?StaffMember $floorLead = null): string
    {
        $shifts ??= $this->staffShiftRepository->findOfPerson($entry);
        $shown = Vec\sort(
            Vec\map($shifts, static fn (StaffShift $shift): string => Json\encode([
                $shift->getId()->toRfc4122(),
                $shift->getJob()->getId()->toRfc4122(),
                $shift->getStartsAt()->format('Y-m-d H:i'),
                $shift->getEndsAt()->format('Y-m-d H:i'),
            ])),
        );

        return Hash\hash(Json\encode([
            'station' => $entry->getStation()?->getId()->toRfc4122(),
            'shifts' => $shown,
            'lead' => $this->leadFinder->leadOf($entry, $floorLead)?->getId()->toRfc4122(),
        ]), Hash\Algorithm::Sha256);
    }
}
