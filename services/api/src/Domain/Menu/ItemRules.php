<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\DishItems;
use App\Domain\Menu\Model\OwnItems;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use Psl\Dict;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** @phpstan-type SentItem array{kind: 'fixed'|'choice'|'variants', name?: string, choiceId?: string} */
final readonly class ItemRules
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @return Type\TypeInterface<list<SentItem>> */
    public static function sent(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'kind' => Type\union(Type\literal_scalar('fixed'), Type\literal_scalar('choice'), Type\literal_scalar('variants')),
            'name' => Type\optional(Type\string()),
            'choiceId' => Type\optional(Type\string()),
        ]));
    }

    /**
     * @param list<SentItem> $sent     a choice already an item stays one without its question
     * @param list<string>   $variants the dish's variant names, in order
     */
    public function dishItems(array $sent, MenuDish $dish, array $variants, MenuDishChoice ...$choices): DishItems
    {
        $variantsName = self::orListPattern($variants);
        $violations = [];
        $byId = Dict\reindex($choices, static fn (MenuDishChoice $one): string => $one->getId()->toRfc4122());
        $already = [];

        foreach ($dish->getItems() as $one) {
            if ('choice' === $one['kind']) {
                $already[] = $one['choiceId'];
            }
        }

        $items = [];
        $taken = [];

        foreach ($sent as $at => $one) {
            $path = Str\format('items.%d.', $at);

            if ('variants' === $one['kind']) {
                if ([] === $variants) {
                    throw ApiException::notFound('access.not_found');
                }

                if (Iter\contains($taken, 'variants')) {
                    $violations[] = $this->violation($path . 'kind', 'validation.item_name_taken');
                }

                $taken[] = 'variants';
                $items[] = ['kind' => 'variants'];

                continue;
            }

            if ('choice' === $one['kind']) {
                $id = $one['choiceId'] ?? '';
                $choice = $byId[$id] ?? throw ApiException::notFound('access.not_found');
                $named = '' === $choice->getQuestion() ? [] : [NameNormaliser::key($choice->getQuestion())];

                if ([] === $named && !Iter\contains($already, $id)) {
                    $violations[] = $this->violation($path . 'choiceId', 'validation.item_choice_draft');
                } elseif (Iter\any([$id, ...$named], static fn (string $key): bool => Iter\contains($taken, $key))) {
                    $violations[] = $this->violation($path . 'choiceId', 'validation.item_name_taken');
                }

                $taken = [...$taken, $id, ...$named];

                $items[] = ['kind' => 'choice', 'choiceId' => $id];

                continue;
            }

            $name = NameNormaliser::name($one['name'] ?? '');
            $key = null !== $variantsName && Regex\matches(NameNormaliser::key($name), $variantsName) ? 'variants' : NameNormaliser::key($name);
            $problem = $this->nameProblem($name, Iter\contains($taken, $key));

            if (null !== $problem) {
                $violations[] = $this->violation($path . 'name', $problem);
            }

            $taken[] = $key;
            $items[] = ['kind' => 'fixed', 'name' => $name];
        }

        if (Iter\count($sent) > MenuDish::ITEMS_MAXIMUM) {
            $violations[] = $this->violation('items', 'validation.items_limit');
        } elseif (1 === Iter\count($sent)) {
            $violations[] = $this->violation('items', 'validation.items_only_one');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new DishItems($items);
    }

    /** @param list<string> $sent */
    public function ownItems(array $sent): OwnItems
    {
        $violations = [];
        $items = [];
        $taken = [];

        foreach ($sent as $at => $one) {
            $name = NameNormaliser::name($one);
            $problem = $this->nameProblem($name, Iter\contains($taken, NameNormaliser::key($name)));

            if (null !== $problem) {
                $violations[] = $this->violation(Str\format('ownItems.%d', $at), $problem);
            }

            $taken[] = NameNormaliser::key($name);
            $items[] = $name;
        }

        if (Iter\count($sent) > MenuCourse::OWN_ITEMS_MAXIMUM) {
            $violations[] = $this->violation('ownItems', 'validation.own_items_limit');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new OwnItems($items);
    }

    /**
     * The variant item's name is its variants as an "or" list in the reader's language, so any of the four locales' lists counts.
     *
     * @param list<string> $variants
     *
     * @return ?non-empty-string
     */
    private static function orListPattern(array $variants): ?string
    {
        if ([] === $variants) {
            return null;
        }

        $names = Vec\map($variants, static fn (string $name): string => \preg_quote(NameNormaliser::key($name), '/'));

        return '/^' . Str\join($names, '(?:\s*,\s*(?:(?:or|ou|o|u)\s+)?|\s+(?:or|ou|o|u)\s+)') . '$/u';
    }

    private function nameProblem(string $name, bool $taken): ?string
    {
        return match (true) {
            '' === $name => 'validation.item_name_required',
            VisibleText::tooLong($name, MenuDish::ITEM_NAME_MAXIMUM) => 'validation.item_name_too_long',
            $taken => 'validation.item_name_taken',
            default => null,
        };
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{max}' => (string) match ($key) {
                'validation.item_name_too_long' => MenuDish::ITEM_NAME_MAXIMUM,
                'validation.own_items_limit' => MenuCourse::OWN_ITEMS_MAXIMUM,
                default => MenuDish::ITEMS_MAXIMUM,
            }]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
