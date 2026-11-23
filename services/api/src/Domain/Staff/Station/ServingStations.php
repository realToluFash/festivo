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
        $servedFrom = [];

        foreach ($courses as $course) {
            foreach ($course['items'] as $item) {
                if (null !== $item['station']) {
                    $servedFrom[$course['course']->getId()->toRfc4122()][$item['key']] = $item['station']->getId()->toRfc4122();
                }
            }
        }

        return [
            'stops' => [
                ['id' => $pass?->getId()->toRfc4122() ?? 'pass', 'name' => $pass?->getName() ?? $this->translator->trans('stations.pass')],
                ...Vec\map(
                    DishedItemsReader::walk($places, DishedItemsReader::counts($courses)),
                    static fn (StaffStation $one): array => ['id' => $one->getId()->toRfc4122(), 'name' => $one->getName()],
                ),
            ],
            'servedFrom' => $servedFrom,
        ];
    }
}
