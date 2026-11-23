<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Menu\DishRules;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Enum\ErrorCode;
use App\Enum\MealAnswerKind;
use App\Enum\MenuChangeWhy;
use App\Http\Exception\ApiException;
use App\Repository\MealAnswerRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * A menu change asks again only the people it affects, only for the course it touches (sc-3913). Until it is sent with `askAgain`, a change that asks anyone is refused 409 `menu_change_asks` naming how many and the course, so the host confirms first.
 *
 * @phpstan-type Asked array{answers: list<MealAnswer>, why: MenuChangeWhy, ways?: int, allergens?: list<string>, recorded?: array<string, list<string>>}
 */
final readonly class MenuReasks
{
    public function __construct(
        private MealAnswerRepository $mealAnswerRepository,
        private HeadcountCalculator $headcountCalculator,
        private GuestNeedsRecord $guestNeedsRecord,
        private ClockInterface $clock,
    ) {
    }

    public function refusePast(Event $event): void
    {
        if ($event->getEndsAt() < $this->clock->now()) {
            throw new ApiException(ErrorCode::MenuEventOver, 'menu.event_over');
        }
    }

    /** @return list<MealAnswer> the answers naming the dish, its variants or its options, from people coming */
    public function naming(MenuDish $dish): array
    {
        return Vec\filter($this->mealAnswerRepository->findNaming($dish), static fn (MealAnswer $answer): bool => HeadcountCalculator::isComing($answer->getPerson()));
    }

    /**
     * @param list<MealAnswer> $answers
     * @param list<string>     $added
     *
     * @return Asked those with an added allergen recorded
     */
    public function withAllergens(array $answers, array $added): array
    {
        if ([] === $answers || [] === $added) {
            return ['answers' => [], 'why' => MenuChangeWhy::Allergen];
        }

        $needs = $this->guestNeedsRecord->of(Vec\map($answers, static fn (MealAnswer $answer): Guest => $answer->getPerson()));
        $recorded = static fn (MealAnswer $answer): array => Vec\filter(
            MealAllergens::of($needs[$answer->getPerson()->getId()->toRfc4122()]),
            static fn (string $code): bool => Iter\contains($added, $code),
        );
        $counted = Vec\filter($answers, static fn (MealAnswer $answer): bool => [] !== $recorded($answer));
        $codes = Vec\flat_map($counted, $recorded);

        return [
            'answers' => $counted,
            'why' => MenuChangeWhy::Allergen,
            'allergens' => Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($codes, $code)),
            'recorded' => Dict\from_entries(Vec\map($counted, static fn (MealAnswer $answer): array => [$answer->getPerson()->getId()->toRfc4122(), $recorded($answer)])),
        ];
    }

    /** @param list<Asked> $asked a person once; someone already Menu changed is not counted again */
    public function ask(MenuCourse $course, array $asked, bool $askAgain): void
    {
        $byPerson = [];

        foreach ($asked as $one) {
            foreach ($one['answers'] as $answer) {
                $byPerson[$answer->getPerson()->getId()->toRfc4122()] ??= [$answer, $one];
            }
        }

        $fresh = Dict\filter($byPerson, static fn (array $pair): bool => MealAnswerKind::MenuChanged !== $pair[0]->getKind());

        if ([] !== $fresh && !$askAgain) {
            $allergens = Vec\flat_map(Vec\values($fresh), static fn (array $pair): array => $pair[1]['allergens'] ?? []);

            throw new ApiException(ErrorCode::MenuChangeAsks, 'menu.change_asks', members: [
                'people' => Iter\count($fresh),
                'course' => ['id' => $course->getId()->toRfc4122(), 'name' => $course->getName()],
                'whom' => Iter\all($fresh, static fn (array $pair): bool => MenuChangeWhy::Allergen === $pair[1]['why']) ? 'allergen' : 'picked',
                'allergens' => Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($allergens, $code)),
            ]);
        }

        foreach ($byPerson as $id => [$answer, $one]) {
            $answer->askAgain($one['why'], $one['ways'] ?? null, $one['recorded'][$id] ?? []);
        }
    }

    /** A course that starts asking guests asks everyone coming, once anyone has picked anything; nobody has an answer to mark. */
    public function askEveryone(Event $event, MenuCourse $course, bool $askAgain): void
    {
        if ($askAgain) {
            return;
        }

        $room = Vec\filter($this->headcountCalculator->coming($event), static fn (Guest $person): bool => null !== $person->getFullName());
        $picked = Iter\any($this->mealAnswerRepository->findOnEvent($event), static fn (MealAnswer $answer): bool => HeadcountCalculator::isComing($answer->getPerson()));

        if ([] === $room || !$picked) {
            return;
        }

        throw new ApiException(ErrorCode::MenuChangeAsks, 'menu.change_asks', members: [
            'people' => Iter\count($room),
            'course' => ['id' => $course->getId()->toRfc4122(), 'name' => $course->getName()],
            'whom' => 'everyone',
            'allergens' => [],
        ]);
    }

    /** @return list<array{person: array{id: string, name: string}, party: string, course: string, picked: string, why: string, ways: ?int}> the people a menu change asked again who have not answered yet, for Messaging to tell (epic 36) */
    public function toTell(Event $event): array
    {
        $changed = Vec\filter(
            $this->mealAnswerRepository->findOnEvent($event),
            static fn (MealAnswer $answer): bool => MealAnswerKind::MenuChanged === $answer->getKind() && HeadcountCalculator::isComing($answer->getPerson()),
        );

        return Vec\map($changed, static fn (MealAnswer $answer): array => [
            'person' => ['id' => $answer->getPerson()->getId()->toRfc4122(), 'name' => $answer->getPerson()->getFullName() ?? ''],
            'party' => ($answer->getPerson()->getHost() ?? $answer->getPerson())->getId()->toRfc4122(),
            'course' => $answer->getCourse()->getId()->toRfc4122(),
            'picked' => $answer->getChangedFrom() ?? '',
            'why' => ($answer->getChangedWhy() ?? MenuChangeWhy::Removed)->value,
            'ways' => $answer->getChangedWays(),
        ]);
    }
}
