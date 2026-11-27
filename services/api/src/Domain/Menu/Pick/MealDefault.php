<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\Model\GuestNeeds;
use App\Enum\NeedKind;
use Psl\Iter;

/** @phpstan-type CourseDefault array{dish: string, variant: ?string, options: list<string>, chooseBy: string} */
final readonly class MealDefault
{
    /**
     * @param array{default: ?CourseDefault, dishes: list<array{id: string, diets: list<string>, variants: list<array{id: string, diets: list<string>, ...}>, ...}>, ...} $course
     *
     * @return list<string> the variant's Suitable for, else the dish's; options carry no diets
     */
    public static function suitableFor(array $course): array
    {
        $default = $course['default'];
        $dish = null === $default ? null : Iter\search($course['dishes'], static fn (array $one): bool => $one['id'] === $default['dish']);

        if (null === $dish || null === $default) {
            return [];
        }

        $variant = Iter\search($dish['variants'], static fn (array $one): bool => $one['id'] === $default['variant']);

        return null === $variant ? $dish['diets'] : $variant['diets'];
    }

    /**
     * @param list<string> $suitable
     *
     * @return ?string why the person is never given the default: `allergy` (Other included), or an unmet diet's code (Other is never met); null when they are
     */
    public static function exclusion(GuestNeeds $needs, array $suitable): ?string
    {
        if ([] !== $needs->codesOf(NeedKind::Allergen)) {
            return 'allergy';
        }

        foreach ($needs->codesOf(NeedKind::Diet) as $diet) {
            if (NeedKind::OTHER === $diet || !Iter\contains($suitable, $diet)) {
                return $diet;
            }
        }

        return null;
    }
}
