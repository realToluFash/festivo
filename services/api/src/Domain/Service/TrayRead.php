<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\MenuCourse;
use App\Entity\ServicePlate;
use App\Entity\ServiceTray;
use App\Enum\PlateStage;
use App\Repository\ServiceTrayRepository;
use Psl\Iter;
use Psl\Vec;

final readonly class TrayRead
{
    public function __construct(
        private ServiceTrayRepository $serviceTrayRepository,
    ) {
    }

    /**
     * @param list<array{course: MenuCourse, items: list<array{name: string, key: string, stop: string}>}> $courses
     *
     * @return array<string, string> the stop id by course id and item key
     */
    public static function stopsByItem(array $courses, string $passId): array
    {
        $stopOf = [];

        foreach ($courses as $one) {
            foreach ($one['items'] as $item) {
                $stopOf[$one['course']->getId()->toRfc4122() . '|' . $item['key']] = $item['stop'];
            }
        }

        return $stopOf;
    }

    /**
     * @param list<ServicePlate> $plates
     *
     * @return list<ServiceTray> every tray with a plate of the course
     */
    public function trays(array $plates): array
    {
        return $this->serviceTrayRepository->findIn(Vec\unique(Vec\filter_nulls(Vec\map($plates, static fn (ServicePlate $plate): ?string => $plate->getTray()?->getId()->toRfc4122()))));
    }

    /**
     * @param list<ServicePlate>                              $onTrays
     * @param non-empty-list<array{id: string, name: string}> $stops
     * @param array<string, string>                           $stopOf
     */
    public function tray(ServiceTray $tray, array $onTrays, array $stops, array $stopOf, string $passId): array
    {
        $plates = Vec\filter($onTrays, static fn (ServicePlate $plate): bool => $plate->getTray() === $tray);
        $marks = [];

        foreach ($plates as $plate) {
            foreach ($plate->onThePlate() as $item) {
                $stop = $stopOf[$plate->getCourse()->getId()->toRfc4122() . '|' . $item['key']] ?? $passId;
                $marks[$stop][] = ['plateId' => $plate->getId()->toRfc4122(), 'item' => $item['key'], 'mark' => ($plate->getMarks()[$item['key']] ?? null)?->value, 'at' => $plate->getMarkedAt()[$item['key']] ?? null];
            }
        }

        return [
            'id' => $tray->getId()->toRfc4122(),
            'courseId' => $tray->getCourse()->getId()->toRfc4122(),
            'table' => $tray->getTableKey(),
            'waiter' => ['id' => $tray->getWaiter()->getId()->toRfc4122(), 'name' => $tray->getWaiter()->getName()],
            'plates' => Vec\map($plates, static fn (ServicePlate $plate): string => $plate->getId()->toRfc4122()),
            'stops' => Vec\map(
                Vec\filter($stops, static fn (array $stop): bool => $stop['id'] === $passId || isset($marks[$stop['id']])),
                static fn (array $stop): array => [...$stop, 'marks' => $marks[$stop['id']] ?? []],
            ),
            'steps' => $tray->getSteps(),
            'done' => Iter\all($plates, static fn (ServicePlate $plate): bool => PlateStage::Served === $plate->getStage()),
        ];
    }
}
