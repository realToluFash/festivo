<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Repository\ServiceFiringRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** The event's kitchen stations in the walking order, the Pass first, each with who is on it; the viewer's own; and the courses fired so far (sc-4015). */
final readonly class KitchenStationList
{
    public function __construct(
        private ServingStationsInterface $servingStations,
        private StaffStationRepository $staffStationRepository,
        private StaffMemberRepository $staffMemberRepository,
        private ServiceFiringRepository $serviceFiringRepository,
        private ServiceTables $serviceTables,
    ) {
    }

    public function of(Event $event, User $viewer): array
    {
        $served = $this->servingStations->of($event);
        $places = Dict\from_entries(Vec\map($this->staffStationRepository->findPlaces($event), static fn (StaffStation $one): array => [$one->getId()->toRfc4122(), $one]));
        $people = Dict\map($places, $this->staffMemberRepository->findOnStation(...));
        $yours = null;

        foreach ($served['stops'] as $stop) {
            if (Iter\any($people[$stop['id']] ?? [], fn (StaffMember $entry): bool => $this->serviceTables->isTheirs($entry, $viewer))) {
                $yours = $stop['id'];

                break;
            }
        }

        $firedAt = [];

        foreach ($this->serviceFiringRepository->findOnEvent($event) as $firing) {
            $firedAt[$firing->getCourse()->getId()->toRfc4122()] ??= $firing->getFiredAt();
        }

        return [
            'stations' => Vec\map($served['stops'], static fn (array $stop): array => [
                'id' => $stop['id'],
                'name' => $stop['name'],
                'people' => Vec\map($people[$stop['id']] ?? [], static fn (StaffMember $one): array => ['id' => $one->getId()->toRfc4122(), 'name' => $one->getFullName()]),
            ]),
            'yours' => $yours,
            'fired' => Vec\filter_nulls(Vec\map($served['courses'], static function (array $one) use ($firedAt): ?array {
                $id = $one['course']->getId()->toRfc4122();
                $at = $firedAt[$id] ?? null;

                return null === $at ? null : ['id' => $id, 'name' => $one['course']->getName(), 'firedAt' => $at->format(\DATE_RFC3339_EXTENDED)];
            })),
        ];
    }
}
