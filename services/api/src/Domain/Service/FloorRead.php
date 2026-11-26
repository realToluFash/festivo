<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Domain\Staff\Station\ServiceTables;
use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\Permission;
use App\Enum\ServicePlace;
use App\Http\Access\Grants;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\StaffMemberRepository;
use Psl\Iter;
use Psl\Vec;

/** Floor (sc-4021): every course's read as the caller sees it, the sections they are on, and the floor lead who puts people on one. The client works each table's word out of the reads, as the room does (sc-4026). */
final readonly class FloorRead
{
    public function __construct(
        private ServingStationsInterface $servingStations,
        private ServiceRead $serviceRead,
        private ServiceTables $serviceTables,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private StaffMemberRepository $staffMemberRepository,
    ) {
    }

    public function of(Event $event, Grants $grants, User $user): array
    {
        $grants->requireServiceAt(ServicePlace::Floor);
        $viewer = ['grants' => $grants, 'user' => $user];
        $plan = $this->seatingPlanRepository->findOneForEvent($event);
        $sections = null === $plan ? [] : $this->seatingSectionRepository->findInPlan($plan);
        $lead = Iter\search($this->staffMemberRepository->findOnEvent($event), static fn (StaffMember $one): bool => $one->isFloorLead());

        return [
            // ponytail: one read per course, each built in full; a read of the fired courses alone if a long menu shows up in the timings.
            'courses' => Vec\map($this->servingStations->of($event)['courses'], fn (array $entry): array => $this->serviceRead->of($entry['course'], $viewer)),
            'yours' => Vec\map(
                Vec\filter($sections, fn (SeatingSection $section): bool => $this->serviceTables->isOn($section, $user)),
                static fn (SeatingSection $section): array => ['id' => $section->getId()->toRfc4122(), 'name' => $section->getName()],
            ),
            'floorLead' => $lead?->getFullName(),
            'manage' => $grants->holds(Permission::ServiceManage),
        ];
    }
}
