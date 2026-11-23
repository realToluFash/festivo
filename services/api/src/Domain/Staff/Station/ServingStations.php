<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Entity\Event;
use App\Entity\StaffStation;
use App\Enum\StationKind;
use App\Repository\StaffStationRepository;
use Psl\Iter;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class ServingStations implements ServingStationsInterface
{
    public function __construct(
        private DishedItemsReader $dishedItemsReader,
        private StaffStationRepository $staffStationRepository,
        private TranslatorInterface $translator,
    ) {
    }

    public function of(Event $event): array
    {
        $courses = $this->dishedItemsReader->read($event);
        $places = $this->staffStationRepository->findPlaces($event);
        $pass = Iter\search($places, static fn (StaffStation $one): bool => StationKind::Pass === $one->getKind());
        $passId = $pass?->getId()->toRfc4122() ?? 'pass';

        return [
            'stops' => [
                ['id' => $passId, 'name' => $pass?->getName() ?? $this->translator->trans('stations.pass')],
                ...Vec\map(
                    DishedItemsReader::walk($places, DishedItemsReader::counts($courses)),
                    static fn (StaffStation $one): array => ['id' => $one->getId()->toRfc4122(), 'name' => $one->getName()],
                ),
            ],
            'courses' => Vec\map($courses, static fn (array $course): array => [
                'course' => $course['course'],
                'items' => Vec\map($course['items'], static fn (array $item): array => [
                    'name' => $item['name'],
                    'key' => $item['key'],
                    'stop' => $item['station']?->getId()->toRfc4122() ?? $passId,
                ]),
            ]),
        ];
    }
}
