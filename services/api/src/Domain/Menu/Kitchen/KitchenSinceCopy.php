<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\KitchenCopy;
use App\Repository\GuestRepository;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/**
 * The changes between a copy and the sheet as it is now (sc-30692).
 *
 * @phpstan-import-type Sheet from KitchenSheet
 * @phpstan-import-type Line from KitchenChanges
 * @phpstan-import-type Person from KitchenChanges
 *
 * @phpstan-type Since array{since: string, lines: list<Line>}
 */
final readonly class KitchenSinceCopy
{
    public function __construct(
        private KitchenSheet $kitchenSheet,
        private GuestRepository $guestRepository,
    ) {
    }

    /**
     * @param ?Sheet $now the sheet with its names, as it is now, when the caller has it
     *
     * @return Since every line with each name it can give; `since` is the copy's moment in the event's zone
     */
    public function of(Event $event, KitchenCopy $copy, ?array $now = null): array
    {
        $now ??= $this->kitchenSheet->of($event, true);
        $room = $this->kitchenSheet->roomNeeds($event);
        $held = $copy->getSheet();
        $counts = Type\vec(Type\shape(['code' => Type\string(), 'count' => Type\int()]));
        $before = [
            'coming' => Type\int()->coerce($held['coming'] ?? null),
            'people' => self::peopleOf($copy),
            'allergyCounts' => $counts->coerce($held['allergyCounts'] ?? []),
            'dietCounts' => $counts->coerce($held['dietCounts'] ?? []),
            'courses' => FinalNumbers::coursesType()->coerce($held['courses'] ?? []),
        ];
        $unnamed = Vec\map(
            Vec\filter($before['people'], static fn (array $one): bool => null === $one['name'] && !Iter\contains_key($room, $one['id'])),
            static fn (array $one): string => $one['id'],
        );
        $gone = [] === $unnamed ? [] : Dict\from_entries(Vec\map(
            Vec\filter($this->guestRepository->findBy(['event' => $event, 'id' => $unnamed]), static fn (Guest $one): bool => null !== $one->getFullName()),
            static fn (Guest $one): array => [$one->getId()->toRfc4122(), $one->getFullName() ?? ''],
        ));
        $after = [
            'coming' => $now['coming'],
            'people' => Vec\filter_nulls(Vec\map($now['allergic'] ?? [], static fn (array $one): ?array => $room[$one['id']] ?? null)),
            'allergyCounts' => $now['allergyCounts'],
            'dietCounts' => $now['dietCounts'],
            'courses' => $now['courses'],
        ];

        return [
            'since' => $copy->getRecordedAt()->setTimezone(new DateTimeZone($event->getTimeZone()))->format(\DATE_ATOM),
            'lines' => KitchenChanges::between($before, $after, $room, $gone),
        ];
    }

    /** @return list<Person> each person the copy holds: its named rows, or the same rows without their names when its recorder could not read them */
    private static function peopleOf(KitchenCopy $copy): array
    {
        $held = $copy->getSheet();
        $codes = Type\vec(Type\string());

        return Vec\map(
            Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($held[$copy->heldNames() ? 'allergic' : 'people'] ?? []),
            static fn (array $one): array => [
                'id' => Type\string()->coerce($one['id'] ?? null),
                'name' => Type\nullable(Type\string())->coerce($one['name'] ?? null),
                'allergens' => $codes->coerce($one['allergens'] ?? []),
                'otherAllergy' => Type\nullable(Type\string())->coerce($one['otherAllergy'] ?? null),
                'diets' => $codes->coerce($one['diets'] ?? []),
                'otherDiet' => Type\nullable(Type\string())->coerce($one['otherDiet'] ?? null),
            ],
        );
    }
}
