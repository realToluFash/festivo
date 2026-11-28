<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MealAnswerKind;
use App\Http\Exception\ApiException;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** @phpstan-import-type Course from PicksMenu */
final readonly class HostPicks
{
    public function __construct(
        private PicksFigures $picksFigures,
        private PicksMenu $picksMenu,
        private GuestNeedsRecord $guestNeedsRecord,
        private MealAnswerRepository $mealAnswerRepository,
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** @return Type\TypeInterface<array{answer: string, dish?: ?string, variant?: ?string, options?: list<string>, anyway?: bool}> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'answer' => Type\string(),
            'dish' => Type\optional(Type\nullable(Type\string())),
            'variant' => Type\optional(Type\nullable(Type\string())),
            'options' => Type\optional(Type\vec(Type\string())),
            'anyway' => Type\optional(Type\bool()),
        ]);
    }

    /** @param array{answer: string, dish?: ?string, variant?: ?string, options?: list<string>, anyway?: bool} $sent */
    public function chooseFor(Event $event, string $personId, string $courseId, array $sent, User $host): void
    {
        $person = $this->inRoom($event, $personId);
        $course = Iter\search($this->picksMenu->courses($event), static fn (array $one): bool => $one['id'] === $courseId) ?? throw ApiException::notFound('access.not_found');
        $kind = MealAnswerKind::tryFrom($sent['answer']);
        $allergens = $this->allergensOf($person);

        $plate = match ($kind) {
            MealAnswerKind::ChefsChoice => ['dish' => null, 'variant' => null, 'options' => [], 'allergens' => []],
            MealAnswerKind::Skipped => $course['skippable'] ? ['dish' => null, 'variant' => null, 'options' => [], 'allergens' => []] : null,
            MealAnswerKind::Chosen => $this->plate($course, $sent),
            default => null,
        };

        if (null === $kind || null === $plate) {
            throw ApiException::validation([$this->violation('answer', 'validation.meal_pick_stale')]);
        }

        $against = null === $plate['dish'] ? [] : MealAllergens::against($plate['allergens'], $allergens);

        if ([] !== $against && true !== ($sent['anyway'] ?? false)) {
            throw new ApiException(ErrorCode::MealPickRuledOut, 'menu.pick_ruled_out', members: ['people' => [['id' => $personId, 'allergens' => $against]]]);
        }

        $this->answer($person, $courseId, $kind, $plate['dish'], $plate['variant'], $plate['options'], $allergens, $host, $against);
        $this->entityManager->flush();
    }

    /** @param list<string> $ticked the people who have the variant once saved */
    public function giveVariant(Event $event, string $variantId, array $ticked, bool $anyway, User $host): void
    {
        $courses = $this->picksMenu->courses($event);
        $found = null;

        foreach ($courses as $course) {
            foreach ($course['dishes'] as $dish) {
                foreach ($dish['variants'] as $variant) {
                    if ($variant['id'] === $variantId && 'children' === $variant['for']) {
                        $found = [$course, $dish, $variant];
                    }
                }
            }
        }

        if (null === $found) {
            throw ApiException::notFound('access.not_found');
        }

        [$course, $dish, $variant] = $found;
        $room = $this->picksFigures->room($event);
        $byId = Dict\from_entries(Vec\map($room, static fn (Guest $person): array => [$person->getId()->toRfc4122(), $person]));

        if (!Iter\all($ticked, static fn (string $id): bool => isset($byId[$id]))) {
            throw ApiException::validation([$this->violation('people', 'validation.meal_pick_stale')]);
        }

        $answers = Dict\from_entries(Vec\filter_nulls(Vec\map(
            $this->mealAnswerRepository->findFor($room),
            static fn (MealAnswer $answer): ?array => $answer->getCourse()->getId()->toRfc4122() === $course['id'] ? [$answer->getPerson()->getId()->toRfc4122(), $answer] : null,
        )));
        $allergens = Dict\map($this->guestNeedsRecord->of($room), MealAllergens::of(...));
        $has = static fn (string $id): bool => ($answers[$id] ?? null)?->getVariant()?->getId()->toRfc4122() === $variantId;
        $given = Vec\filter(Vec\unique($ticked), static fn (string $id): bool => !$has($id));
        $ruledOut = Vec\filter_nulls(Vec\map($given, static function (string $id) use ($allergens, $variant): ?array {
            $against = MealAllergens::against($variant['allergens'], $allergens[$id] ?? []);

            return [] === $against ? null : ['id' => $id, 'allergens' => $against];
        }));

        if ([] !== $ruledOut && !$anyway) {
            throw new ApiException(ErrorCode::MealPickRuledOut, 'menu.pick_ruled_out', members: ['people' => $ruledOut]);
        }

        foreach ($given as $id) {
            $against = MealAllergens::against($variant['allergens'], $allergens[$id] ?? []);
            $this->answer($byId[$id], $course['id'], MealAnswerKind::Chosen, $dish['id'], $variantId, [], $allergens[$id] ?? [], $host, $against);
        }

        foreach ($answers as $id => $answer) {
            if ($has($id) && !Iter\contains($ticked, $id)) {
                $this->entityManager->remove($answer);
            }
        }

        $this->entityManager->flush();
    }

    /**
     * @param list<string> $options
     * @param list<string> $allergens
     * @param list<string> $overridden
     */
    private function answer(Guest $person, string $courseId, MealAnswerKind $kind, ?string $dishId, ?string $variantId, array $options, array $allergens, User $host, array $overridden): void
    {
        $course = $this->menuCourseRepository->find($courseId) ?? throw ApiException::notFound('access.not_found');
        $dish = null === $dishId ? null : $this->menuDishRepository->find($dishId);
        $variant = null === $variantId ? null : $this->menuDishVariantRepository->find($variantId);
        $answer = Iter\search($this->mealAnswerRepository->findFor([$person]), static fn (MealAnswer $one): bool => $one->getCourse()->getId()->toRfc4122() === $courseId);

        if (null === $answer) {
            $answer = new MealAnswer($person, $course, $kind, $dish, $variant, $options, $allergens);
            $this->entityManager->persist($answer);
        }

        $answer->answerForThem($kind, $dish, $variant, $options, $allergens, $host, $this->clock->now(), $overridden);
    }

    /**
     * @param Course                                                                                          $course
     * @param array{answer: string, dish?: ?string, variant?: ?string, options?: list<string>, anyway?: bool} $sent
     *
     * @return ?array{dish: string, variant: ?string, options: list<string>, allergens: ?list<string>}
     */
    private function plate(array $course, array $sent): ?array
    {
        $dish = Iter\search($course['dishes'], static fn (array $one): bool => $one['id'] === ($sent['dish'] ?? null));

        if (null === $dish) {
            return null;
        }

        $variant = null;

        if ([] !== $dish['variants']) {
            $variant = Iter\search($dish['variants'], static fn (array $one): bool => $one['id'] === ($sent['variant'] ?? null));

            if (null === $variant) {
                throw ApiException::validation([$this->violation('variant', 'validation.meal_variant_needed')]);
            }
        } elseif (null !== ($sent['variant'] ?? null)) {
            return null;
        }

        $sentOptions = $sent['options'] ?? [];
        $kept = [];
        $plateOptions = [];

        foreach (Vec\filter(PicksMenu::choices($dish), static fn (array $choice): bool => !$choice['draft']) as $choice) {
            $picked = Vec\filter($choice['options'], static fn (array $option): bool => Iter\contains($sentOptions, $option['id']));
            $count = Iter\count($picked);

            if ($count !== $choice['pick'] && ($choice['required'] || 0 !== $count)) {
                throw ApiException::validation([$this->violation('options', 'validation.meal_options_count', $choice['pick'])]);
            }

            foreach ($picked as $option) {
                $kept[] = $option['id'];
                $plateOptions[] = $option['allergens'];
            }
        }

        if (Iter\count($kept) !== Iter\count(Vec\unique($sentOptions))) {
            return null;
        }

        return [
            'dish' => $dish['id'],
            'variant' => $variant['id'] ?? null,
            'options' => $kept,
            'allergens' => MealAllergens::onPlate(null === $variant ? $dish['allergens'] : $variant['allergens'], $plateOptions),
        ];
    }

    private function inRoom(Event $event, string $personId): Guest
    {
        return Iter\search($this->picksFigures->room($event), static fn (Guest $person): bool => $person->getId()->toRfc4122() === $personId)
            ?? throw ApiException::notFound('access.not_found');
    }

    /** @return list<string> */
    private function allergensOf(Guest $person): array
    {
        return MealAllergens::of($this->guestNeedsRecord->of([$person])[$person->getId()->toRfc4122()]);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key, ?int $pick = null): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, null === $pick ? [] : ['{pick}' => (string) $pick]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
