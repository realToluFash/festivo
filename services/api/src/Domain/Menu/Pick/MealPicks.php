<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Enum\ErrorCode;
use App\Enum\GuestReply;
use App\Enum\MealAnswerKind;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-import-type Sent from GuestMenu
 * @phpstan-import-type GuestCourse from GuestMenu
 */
final readonly class MealPicks
{
    public function __construct(
        private GuestMenu $guestMenu,
        private MealAnswerRepository $mealAnswerRepository,
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return Type\TypeInterface<list<Sent>> */
    public static function sent(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'person' => Type\string(),
            'course' => Type\string(),
            'answer' => Type\string(),
            'dish' => Type\optional(Type\nullable(Type\string())),
            'variant' => Type\optional(Type\nullable(Type\string())),
            'options' => Type\optional(Type\vec(Type\string())),
        ]));
    }

    /** @param list<Sent> $sent checked against each person's allergens as recorded now, so the kitchen note is sent first */
    public function send(Guest $guest, array $sent): void
    {
        if (GuestReply::Coming !== $guest->getReply()) {
            throw ApiException::validation([$this->violation('picks', 'validation.meal_not_coming')]);
        }

        $event = $guest->getEvent();
        $people = Dict\from_entries(Vec\map(
            [$guest, ...Vec\filter($this->guestRepository->findCompanionsOf($guest), static fn (Guest $companion): bool => null !== $companion->getFullName() && !$companion->isNotComingByGuest())],
            static fn (Guest $person): array => [$person->getId()->toRfc4122(), $person],
        ));
        $needs = $this->guestNeedsRecord->of(Vec\values($people));
        $courses = Dict\from_entries(Vec\map($this->guestMenu->menu($event), static fn (array $course): array => [$course['id'], $course]));
        $stored = Dict\from_entries(Vec\map(
            $this->mealAnswerRepository->findFor(Vec\values($people)),
            static fn (MealAnswer $answer): array => [$answer->getPerson()->getId()->toRfc4122() . '/' . $answer->getCourse()->getId()->toRfc4122(), $answer],
        ));

        $violations = [];
        $accepted = [];
        $closed = [];

        foreach ($sent as $index => $pick) {
            $path = 'picks[' . $index . ']';
            $person = $people[$pick['person']] ?? null;
            $course = $courses[$pick['course']] ?? null;
            $kind = MealAnswerKind::tryFrom($pick['answer']);

            if (null === $person || null === $course || null === $kind || MealAnswerKind::Defaulted === $kind) {
                $violations[] = $this->violation($path, 'validation.meal_pick_stale');

                continue;
            }

            $before = $stored[$pick['person'] . '/' . $pick['course']] ?? null;

            if ($course['picksClose']['closed']) {
                if (null === $before || !self::same($before, self::asSent($pick, $kind))) {
                    $closed[] = $course['id'];
                }

                continue;
            }

            $allergens = MealAllergens::of($needs[$pick['person']]);
            $answer = $this->checked($pick, $kind, $course, $allergens, $person, $path, $violations);

            if (null === $answer) {
                continue;
            }

            $accepted[] = [$person, $course['id'], $answer, $allergens, $before];
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        foreach ($accepted as [$person, $courseId, $answer, $allergens, $before]) {
            $course = $this->menuCourseRepository->find($courseId) ?? throw ApiException::notFound('access.not_found');
            $dish = null === $answer['dish'] ? null : $this->menuDishRepository->find($answer['dish']);
            $variant = null === $answer['variant'] ? null : $this->menuDishVariantRepository->find($answer['variant']);

            if (null === $before) {
                $this->entityManager->persist(new MealAnswer($person, $course, $answer['kind'], $dish, $variant, $answer['options'], $allergens));
            } elseif (!self::same($before, $answer)) {
                $before->answer($answer['kind'], $dish, $variant, $answer['options'], $allergens);
            }
        }

        $this->entityManager->flush();

        if ([] !== $closed) {
            throw new ApiException(ErrorCode::MealPicksClosed, 'menu.picks_closed', members: ['courses' => Vec\unique($closed)]);
        }
    }

    /**
     * @param Sent                                                             $pick
     * @param GuestCourse                                                      $course
     * @param list<string>                                                     $allergens
     * @param list<array{propertyPath: string, message: string, code: string}> $violations
     *
     * @return ?array{kind: MealAnswerKind, dish: ?string, variant: ?string, options: list<string>}
     */
    private function checked(array $pick, MealAnswerKind $kind, array $course, array $allergens, Guest $person, string $path, array &$violations): ?array
    {
        $nothingSafe = Iter\all($course['dishes'], static fn (array $dish): bool => GuestMenu::ruledOut($dish, $allergens));
        $name = $person->getFullName() ?? '';

        if (MealAnswerKind::Chosen !== $kind) {
            $allowed = match ($kind) {
                MealAnswerKind::ChefsChoice => !$nothingSafe,
                MealAnswerKind::Skipped => $course['skippable'],
                default => $nothingSafe,
            };

            if (!$allowed) {
                $violations[] = $this->violation($path, 'validation.meal_answer_not_offered');

                return null;
            }

            return ['kind' => $kind, 'dish' => null, 'variant' => null, 'options' => []];
        }

        $dish = Iter\search($course['dishes'], static fn (array $dish): bool => $dish['id'] === ($pick['dish'] ?? null));

        if (null === $dish) {
            $violations[] = $this->violation($path, 'validation.meal_pick_stale');

            return null;
        }

        $variant = null;

        if ([] !== $dish['variants']) {
            $variant = Iter\search($dish['variants'], static fn (array $way): bool => $way['id'] === ($pick['variant'] ?? null));

            if (null === $variant) {
                $violations[] = $this->violation($path . '.variant', 'validation.meal_variant_needed');

                return null;
            }
        } elseif (null !== ($pick['variant'] ?? null)) {
            $violations[] = $this->violation($path, 'validation.meal_pick_stale');

            return null;
        }

        $sentOptions = $pick['options'] ?? [];
        $kept = [];
        $plateOptions = [];

        foreach ($dish['choices'] as $choice) {
            $picked = Vec\filter($choice['options'], static fn (array $option): bool => Iter\contains($sentOptions, $option['id']));
            $count = Iter\count($picked);

            if ($count !== $choice['pick'] && ($choice['required'] || 0 !== $count)) {
                $violations[] = $this->violation($path . '.options', 'validation.meal_options_count', ['{pick}' => (string) $choice['pick']]);

                return null;
            }

            foreach ($picked as $option) {
                $kept[] = $option['id'];
                $plateOptions[] = $option['allergens'];
            }
        }

        if (Iter\count($kept) !== Iter\count(Vec\unique($sentOptions))) {
            $violations[] = $this->violation($path, 'validation.meal_pick_stale');

            return null;
        }

        $plate = MealAllergens::onPlate(null === $variant ? $dish['allergens'] : $variant['allergens'], $plateOptions);

        if ([] !== MealAllergens::against($plate, $allergens)) {
            $violations[] = $this->violation($path, 'validation.meal_ruled_out', ['{name}' => $name]);

            return null;
        }

        return ['kind' => MealAnswerKind::Chosen, 'dish' => $dish['id'], 'variant' => $variant['id'] ?? null, 'options' => $kept];
    }

    /**
     * A pick as sent, unchecked: a closed course compares it with what was stored before, since a pick a later allergy rules out still repeats unchanged.
     *
     * @param Sent $pick
     *
     * @return array{kind: MealAnswerKind, dish: ?string, variant: ?string, options: list<string>}
     */
    private static function asSent(array $pick, MealAnswerKind $kind): array
    {
        $chosen = MealAnswerKind::Chosen === $kind;

        return [
            'kind' => $kind,
            'dish' => $chosen ? $pick['dish'] ?? null : null,
            'variant' => $chosen ? $pick['variant'] ?? null : null,
            'options' => $chosen ? $pick['options'] ?? [] : [],
        ];
    }

    /** @param array{kind: MealAnswerKind, dish: ?string, variant: ?string, options: list<string>} $answer */
    private static function same(MealAnswer $before, array $answer): bool
    {
        return $before->getKind() === $answer['kind']
            && $before->getDish()?->getId()->toRfc4122() === $answer['dish']
            && $before->getVariant()?->getId()->toRfc4122() === $answer['variant']
            && Vec\sort($before->getOptions()) === Vec\sort($answer['options']);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
