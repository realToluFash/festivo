<?php

declare(strict_types=1);

namespace App\Enum;

/** The three groups of a guest's needs (sc-3777), each a closed list of codes the clients turn into words, Other among them. */
enum NeedKind: string
{
    case Allergen = 'allergen';
    case Diet = 'diet';
    case Access = 'access';

    public const string OTHER = 'other';

    /** @return non-empty-list<non-empty-string> allergens in the order of EU 1169/2011 Annex II */
    public function codes(): array
    {
        return match ($this) {
            self::Allergen => ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs', self::OTHER],
            self::Diet => ['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'no_pork', 'no_beef', 'no_alcohol', self::OTHER],
            self::Access => ['step_free', 'near_exit', 'hearing_loop', 'sign_language', 'wheelchair_space', self::OTHER],
        };
    }

    /** The request's and the response's key for this group's codes. */
    public function field(): string
    {
        return match ($this) {
            self::Allergen => 'allergies',
            self::Diet => 'diet',
            self::Access => 'access',
        };
    }

    /** The key for this group's Other words. */
    public function otherField(): string
    {
        return match ($this) {
            self::Allergen => 'otherAllergy',
            self::Diet => 'otherDiet',
            self::Access => 'otherAccess',
        };
    }
}
