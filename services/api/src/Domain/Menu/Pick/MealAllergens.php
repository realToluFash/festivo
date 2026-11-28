<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\Model\GuestNeeds;
use App\Enum\NeedKind;
use Psl\Iter;
use Psl\Vec;

/** The one allergen rule for a meal (sc-3907): a plate that never stated its allergens holds any of the 14, and Other rules nothing out. */
final readonly class MealAllergens
{
    /** @return list<string> the person's allergens among the 14, in Annex II order */
    public static function of(GuestNeeds $needs): array
    {
        return Vec\filter($needs->codesOf(NeedKind::Allergen), static fn (string $code): bool => NeedKind::OTHER !== $code);
    }

    /**
     * @param ?list<string>      $base    the variant's when one is picked, else the dish's
     * @param list<list<string>> $options each picked option's
     *
     * @return ?list<string>
     */
    public static function onPlate(?array $base, array $options): ?array
    {
        return null === $base ? null : Vec\unique([...$base, ...Vec\flatten($options)]);
    }

    /**
     * @param ?list<string> $plate
     * @param list<string>  $allergens
     *
     * @return list<string>
     */
    public static function against(?array $plate, array $allergens): array
    {
        return null === $plate ? $allergens : Vec\filter($allergens, static fn (string $code): bool => Iter\contains($plate, $code));
    }
}
