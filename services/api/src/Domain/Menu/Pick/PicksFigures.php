<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Entity\Event;
use App\Entity\Guest;
use Closure;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * See picks (sc-3909): everyone coming is in exactly one state per course, so a course's dish rows and states always add up to the room.
 *
 * @phpstan-import-type GuestDish from GuestMenu
 * @phpstan-import-type Course from PicksMenu
 * @phpstan-import-type Spot from PicksMenu
 */
final readonly class PicksFigures
{
    public function __construct(
        private PicksMenu $picksMenu,
        private PickSpots $pickSpots,
        private HeadcountCalculator $headcountCalculator,
        private GuestNeedsRecord $guestNeedsRecord,
        private ClockInterface $clock,
    ) {
    }

    /** @return list<Guest> the room: sc-99's coming set, named */
    public function room(Event $event): array
    {
        return Vec\filter($this->headcountCalculator->coming($event), static fn (Guest $person): bool => null !== $person->getFullName());
    }

    /** @return array<string, mixed> `names` is false without guests.read: Needs the host, Who hasn't picked and Given the default are left out, and each course keeps its counts */
    public function of(Event $event, bool $names): array
    {
        $coming = $this->headcountCalculator->coming($event);
        $room = Vec\filter($coming, static fn (Guest $person): bool => null !== $person->getFullName());
        $courses = $this->picksMenu->courses($event);
        $spots = $this->pickSpots->of($event, $room, $courses);
        $allergens = Dict\map($this->guestNeedsRecord->of($room), MealAllergens::of(...));
        $parties = Vec\values(Dict\from_entries(Vec\map($room, static function (Guest $person): array {
            $party = self::partyOf($person);

            return [$party->getId()->toRfc4122(), ['id' => $party->getId()->toRfc4122(), 'replier' => $party->getFullName() ?? '']];
        })));
        $roomSize = Iter\count($room);
        $asking = Vec\filter($courses, static fn (array $course): bool => !PicksMenu::asksNothing($course));
        $in = static fn (array $spot): bool => Iter\contains(['dish', 'defaulted', 'kitchen', 'skipped'], $spot['state']);
        $answered = Iter\count(Vec\filter($room, static fn (Guest $person): bool => Iter\all(
            $asking,
            static fn (array $course): bool => $in($spots[$course['id']][$person->getId()->toRfc4122()]),
        )));
        $needsHost = [];
        $waiting = [];
        $given = [];

        foreach ($room as $person) {
            $id = $person->getId()->toRfc4122();
            $open = [];
            $excluded = [];
            $defaulted = [];

            foreach ($courses as $course) {
                $spot = $spots[$course['id']][$id];

                if ('host' === $spot['state']) {
                    $needsHost[] = [
                        'person' => $names ? self::person($person) : null,
                        'course' => $course['id'],
                        'reason' => $spot['reason'] ?? 'nothing',
                        'pick' => $spot['pick'] ?? null,
                        'allergens' => $spot['allergens'] ?? [],
                        'notStated' => $spot['notStated'] ?? false,
                    ];
                }

                if ('none' === $spot['state']) {
                    $open[] = $course['id'];

                    if (isset($spot['excluded'])) {
                        $excluded[] = ['course' => $course['id'], 'reason' => $spot['excluded']];
                    }
                }

                if ('defaulted' === $spot['state']) {
                    $defaulted[] = ['course' => $course['id'], 'dish' => $spot['dish'] ?? '', 'variant' => $spot['variant'] ?? null, 'options' => $spot['options'] ?? []];
                }
            }

            $party = self::partyOf($person)->getId()->toRfc4122();

            if ([] !== $open) {
                $waiting[$party][] = [...self::person($person), 'courses' => $open, 'excluded' => $excluded];
            }

            if ([] !== $defaulted) {
                $given[$party][] = [...self::person($person), 'courses' => $defaulted];
            }
        }

        $byParty = static fn (array $people): array => Vec\map(
            Vec\filter($parties, static fn (array $party): bool => isset($people[$party['id']])),
            static fn (array $party): array => [...$party, 'people' => $people[$party['id']]],
        );

        return [
            'updatedAt' => $this->clock->now()->setTimezone(new DateTimeZone($event->getTimeZone()))->format(\DATE_ATOM),
            'room' => $roomSize,
            'held' => Iter\count($coming) - $roomSize,
            'answered' => $answered,
            'percent' => 0 === $roomSize ? 0 : Math\div($answered * 100, $roomSize),
            'allIn' => [] === $needsHost && $answered === $roomSize,
            'courses' => Vec\map($courses, fn (array $course): array => $this->course($course, $spots[$course['id']], $roomSize, $names)),
            'needsHost' => $names ? $needsHost : null,
            'waiting' => $names ? $byParty($waiting) : null,
            'given' => $names ? $byParty($given) : null,
            'people' => $names ? Vec\map($room, static fn (Guest $person): array => [
                ...self::person($person),
                'party' => self::partyOf($person)->getId()->toRfc4122(),
                'allergens' => $allergens[$person->getId()->toRfc4122()] ?? [],
            ]) : null,
            'parties' => $names ? $parties : null,
        ];
    }

    /**
     * @param Course              $course
     * @param array<string, Spot> $spots
     *
     * @return array<string, mixed>
     */
    private function course(array $course, array $spots, int $room, bool $names): array
    {
        /** @param Closure(Spot): bool $test */
        $count = static function (Closure $test) use ($spots): int {
            $n = 0;

            foreach ($spots as $spot) {
                $n += $test($spot) ? 1 : 0;
            }

            return $n;
        };
        /** @param Closure(Spot): bool $test */
        $onDish = static fn (string $dish, string $state, Closure $test): int => $count(static fn (array $spot): bool => $state === $spot['state'] && ($spot['dish'] ?? null) === $dish && $test($spot));
        $holders = static fn (string $variant): array => Vec\keys(Dict\filter($spots, static fn (array $spot): bool => ($spot['variant'] ?? null) === $variant && Iter\contains(['dish', 'host'], $spot['state'])));
        $rows = [];

        foreach ($course['dishes'] as $dish) {
            $rows[] = ['id' => $dish['id'], 'kind' => 'dish', 'name' => $dish['name'], 'allergens' => [] === $dish['variants'] ? $dish['allergens'] : $dish['allergens'] ?? [], 'chosen' => $onDish($dish['id'], 'dish', static fn (): bool => true), 'defaulted' => $onDish($dish['id'], 'defaulted', static fn (): bool => true)];

            foreach ($dish['variants'] as $variant) {
                $on = static fn (array $spot): bool => ($spot['variant'] ?? null) === $variant['id'];
                $rows[] = [
                    'id' => $variant['id'],
                    'kind' => 'variant',
                    'dish' => $dish['id'],
                    'name' => $variant['name'],
                    'for' => $variant['for'],
                    'allergens' => $variant['allergens'],
                    'chosen' => $onDish($dish['id'], 'dish', $on),
                    'defaulted' => $onDish($dish['id'], 'defaulted', $on),
                    ...('children' === $variant['for'] && $names ? ['holders' => $holders($variant['id'])] : []),
                ];
            }

            foreach (PicksMenu::choices($dish) as $choice) {
                foreach ($choice['options'] as $option) {
                    $on = static fn (array $spot): bool => Iter\contains($spot['options'] ?? [], $option['id']);
                    $rows[] = ['id' => $option['id'], 'kind' => 'option', 'dish' => $dish['id'], 'name' => $option['name'], 'chosen' => $onDish($dish['id'], 'dish', $on), 'defaulted' => $onDish($dish['id'], 'defaulted', $on)];
                }
            }
        }

        $host = $count(static fn (array $spot): bool => 'host' === $spot['state']);
        $none = $count(static fn (array $spot): bool => 'none' === $spot['state']);

        return [
            'id' => $course['id'],
            'name' => $course['name'],
            'asksNothing' => PicksMenu::asksNothing($course),
            'skippable' => $course['skippable'],
            'closed' => $course['picksClose']['closed'] ?? false,
            'default' => $course['default'],
            'rows' => $rows,
            'kitchen' => $count(static fn (array $spot): bool => 'kitchen' === $spot['state']),
            'skipped' => $count(static fn (array $spot): bool => 'skipped' === $spot['state']),
            'needsHost' => $host,
            'notChosen' => $none,
            'room' => $room,
            'answered' => $room - $host - $none,
        ];
    }

    private static function partyOf(Guest $person): Guest
    {
        return $person->getHost() ?? $person;
    }

    /** @return array{id: string, name: string} */
    private static function person(Guest $person): array
    {
        return ['id' => $person->getId()->toRfc4122(), 'name' => $person->getFullName() ?? ''];
    }
}
