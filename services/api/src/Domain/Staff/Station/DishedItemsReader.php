<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Domain\Menu\CourseItemLister;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\StaffItemStation;
use App\Entity\StaffStation;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use App\Repository\StaffItemStationRepository;
use Psl\Vec;

/** Each course's items as the menu has them now, with the place that dishes each, null for the Pass (sc-3910). A row for an item no longer on its course is never read. */
final readonly class DishedItemsReader
{
    public function __construct(
        private CourseItemLister $courseItemLister,
        private StaffItemStationRepository $staffItemStationRepository,
    ) {
    }

    /** @return list<array{course: MenuCourse, items: list<array{name: string, key: string, station: ?StaffStation}>}> */
    public function read(Event $event): array
    {
        $set = [];

        foreach ($this->staffItemStationRepository->findOnEvent($event) as $row) {
            $set[$row->getCourse()->getId()->toRfc4122() . '|' . $row->getItemKey()] = $row;
        }

        return Vec\map($this->courseItemLister->onEvent($event), static fn (array $course): array => [
            'course' => $course['course'],
            'items' => Vec\map($course['items'], static function (string $name) use ($course, $set): array {
                $key = NameNormaliser::key($name);
                $row = $set[$course['course']->getId()->toRfc4122() . '|' . $key] ?? null;

                return ['name' => $name, 'key' => $key, 'station' => $row instanceof StaffItemStation ? $row->getStation() : null];
            }),
        ]);
    }

    /**
     * @param list<array{course: MenuCourse, items: list<array{name: string, key: string, station: ?StaffStation}>}> $courses
     *
     * @return array<string, int>
     */
    public static function counts(array $courses): array
    {
        $counts = [];

        foreach ($courses as $course) {
            foreach ($course['items'] as $item) {
                if (null !== $item['station']) {
                    $id = $item['station']->getId()->toRfc4122();
                    $counts[$id] = ($counts[$id] ?? 0) + 1;
                }
            }
        }

        return $counts;
    }

    /** @param list<array{course: MenuCourse, items: list<array{name: string, key: string, station: ?StaffStation}>}> $courses */
    public static function atThePass(array $courses): int
    {
        $count = 0;

        foreach ($courses as $course) {
            foreach ($course['items'] as $item) {
                if (null === $item['station']) {
                    ++$count;
                }
            }
        }

        return $count;
    }

    /**
     * @param list<StaffStation> $places
     * @param array<string, int> $counts
     *
     * @return list<StaffStation>
     */
    public static function walk(array $places, array $counts): array
    {
        $kitchens = Vec\filter($places, static fn (StaffStation $place): bool => ($counts[$place->getId()->toRfc4122()] ?? 0) > 0 && StationKind::Place === $place->getKind());

        return Vec\sort($kitchens, static fn (StaffStation $a, StaffStation $b): int => [$a->getWalkPosition() ?? \PHP_INT_MAX, $a->getPosition()] <=> [$b->getWalkPosition() ?? \PHP_INT_MAX, $b->getPosition()]);
    }
}
