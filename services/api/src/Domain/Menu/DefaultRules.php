<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\CourseDefaultDetails;
use App\Domain\Menu\Model\PicksClose;
use App\Domain\Menu\Pick\PicksMenu;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** @phpstan-type SentDefault array{dish: ?string, variant?: ?string, options?: list<string>, chooseBy: ?string} */
final readonly class DefaultRules
{
    public function __construct(
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** @return Type\TypeInterface<SentDefault> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'dish' => Type\nullable(Type\string()),
            'variant' => Type\optional(Type\nullable(Type\string())),
            'options' => Type\optional(Type\vec(Type\string())),
            'chooseBy' => Type\nullable(Type\string()),
        ]);
    }

    /**
     * @param SentDefault          $sent
     * @param array<string, mixed> $served the course as MenuSerialiser serves it
     *
     * @return ?CourseDefaultDetails null when both are cleared
     */
    public function details(Event $event, MenuCourse $course, array $served, array $sent): ?CourseDefaultDetails
    {
        $stored = $course->getChooseBy()?->format('Y-m-d');
        $locked = null !== $stored && PicksClose::of($event, $course)->passedAt($this->clock->now());
        $date = null === $sent['chooseBy'] ? '' : Str\trim($sent['chooseBy']);

        if (null === $sent['dish'] && '' === $date) {
            if ($locked) {
                throw ApiException::validation([$this->violation('default.chooseBy', 'validation.course_choose_by_locked')]);
            }

            return null;
        }

        if (null === $served['picksClose']) {
            throw ApiException::validation([$this->violation('default.dish', 'validation.course_default_not_asked')]);
        }

        $violations = [];
        $dish = null === $sent['dish'] ? null : $this->offered($served, $sent['dish']);

        if (null === $sent['dish']) {
            $violations[] = $this->violation('default.dish', 'validation.course_default_dish_needed');
        } elseif (null === $dish) {
            $violations[] = $this->violation('default.dish', 'validation.meal_pick_stale');
        }

        $variant = null;
        $options = [];

        if (null !== $dish) {
            $everyone = Vec\filter($dish['variants'], static fn (array $one): bool => 'everyone' === $one['for']);

            if ([] !== $dish['variants']) {
                $variant = Iter\search($everyone, static fn (array $one): bool => $one['id'] === ($sent['variant'] ?? null));

                if (null === $variant) {
                    $violations[] = $this->violation('default.variant', 'validation.course_default_variant');
                }
            }

            $sentOptions = $sent['options'] ?? [];

            foreach (Vec\filter(PicksMenu::choices($dish), static fn (array $choice): bool => $choice['required'] && !$choice['draft']) as $choice) {
                $picked = Vec\filter($choice['options'], static fn (array $option): bool => Iter\contains($sentOptions, $option['id']));

                if (Iter\count($picked) !== $choice['pick']) {
                    $violations[] = 1 === $choice['pick']
                        ? $this->violation('default.options.' . $choice['id'], 'validation.course_default_answer', $choice['question'])
                        : $this->violation('default.options.' . $choice['id'], 'validation.course_default_choose', $choice['question'], $choice['pick']);
                }

                foreach ($picked as $option) {
                    $options[] = $option['id'];
                }
            }

            if (Iter\count($options) !== Iter\count(Vec\unique($sentOptions))) {
                $violations[] = $this->violation('default.options', 'validation.meal_pick_stale');
            }
        }

        $zone = new DateTimeZone($event->getTimeZone());
        $chooseBy = self::day($date, $zone);

        if ('' === $date) {
            $violations[] = $this->violation('default.chooseBy', 'validation.course_choose_by_needed');
        } elseif (null === $chooseBy) {
            $violations[] = $this->violation('default.chooseBy', 'validation.course_choose_by_invalid');
        } elseif ($locked && $date !== $stored) {
            $violations[] = $this->violation('default.chooseBy', 'validation.course_choose_by_locked');
        } elseif ($date >= $event->getStartsAt()->setTimezone($zone)->format('Y-m-d')) {
            $violations[] = $this->violation('default.chooseBy', 'validation.course_choose_by_after_event');
        } elseif ($date !== $stored && $date < $this->clock->now()->setTimezone($zone)->format('Y-m-d')) {
            $violations[] = $this->violation('default.chooseBy', 'validation.course_choose_by_past');
        }

        if ([] !== $violations || null === $dish || null === $chooseBy) {
            throw ApiException::validation($violations);
        }

        $variantId = $variant['id'] ?? null;

        return new CourseDefaultDetails(
            $this->menuDishRepository->find($dish['id']) ?? throw ApiException::notFound('access.not_found'),
            null === $variantId ? null : $this->menuDishVariantRepository->find($variantId),
            $options,
            $chooseBy,
        );
    }

    private static function day(string $date, DateTimeZone $zone): ?DateTimeImmutable
    {
        if (null === Regex\first_match($date, '/^\d{4}-\d{2}-\d{2}$/')) {
            return null;
        }

        $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone);

        return false === $day || $day->format('Y-m-d') !== $date ? null : $day;
    }

    /**
     * @param array<string, mixed> $served
     *
     * @return ?array{id: string, variants: list<array{id: string, for: string, ...}>, choices: list<array<array-key, mixed>>, ...} one of the course's dishes guests can see
     */
    private function offered(array $served, string $id): ?array
    {
        $dishes = Type\vec(Type\shape([
            'id' => Type\string(),
            'offered' => Type\bool(),
            'variants' => Type\vec(Type\shape(['id' => Type\string(), 'for' => Type\string()], true)),
            'choices' => Type\vec(Type\mixed_dict()),
        ], true))->coerce($served['dishes'] ?? []);

        return Iter\search($dishes, static fn (array $dish): bool => $dish['id'] === $id && $dish['offered']);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key, string $question = '', int $pick = 0): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{question}' => $question, '{pick}' => (string) $pick]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
