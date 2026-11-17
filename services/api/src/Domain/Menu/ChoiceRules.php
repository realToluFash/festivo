<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\ChoiceAnswers;
use App\Domain\Menu\Model\ChoiceDetails;
use App\Domain\Menu\Model\OptionDetails;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDishChoice;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-type SentOption array{id?: string, name: string, allergens?: list<string>, containsNone?: bool}
 * @phpstan-type Sent array{question: string, options: list<SentOption>, pick: int, required: bool}
 */
final readonly class ChoiceRules
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @return Type\TypeInterface<Sent> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'question' => Type\string(),
            'options' => Type\vec(Type\shape([
                'id' => Type\optional(Type\string()),
                'name' => Type\string(),
                'allergens' => Type\optional(Type\vec(Type\string())),
                'containsNone' => Type\optional(Type\bool()),
            ])),
            'pick' => Type\positive_int(),
            'required' => Type\bool(),
        ]);
    }

    /** @return list<array{0: string, 1: array<string, string>}> translation keys with their parameters; none when finished */
    public static function draftReasons(string $question, int $options, int $pick): array
    {
        $reasons = [];

        if ('' === $question) {
            $reasons[] = ['menu.choice_draft_question', []];
        }

        if ($options < MenuDishChoice::OPTIONS_MINIMUM) {
            $reasons[] = ['menu.choice_draft_options', []];
        }

        if ($pick >= MenuDishChoice::OPTIONS_MINIMUM && $options < $pick + 1) {
            $reasons[] = ['menu.choice_draft_pick', ['{pick}' => (string) $pick, '{options}' => (string) ($pick + 1)]];
        }

        return $reasons;
    }

    public static function isDraft(MenuDishChoice $choice, int $options): bool
    {
        return [] !== self::draftReasons($choice->getQuestion(), $options, $choice->getPick());
    }

    /**
     * @param Sent                   $sent
     * @param list<MenuChoiceOption> $options what the choice has now; none for a new one
     * @param ?ChoiceAnswers         $answers what guests answered to the choice being changed; null for a new one
     */
    public function details(array $sent, ?MenuDishChoice $was, array $options, ?ChoiceAnswers $answers): ChoiceDetails
    {
        $violations = [];
        $question = NameNormaliser::name($sent['question']);

        if (VisibleText::tooLong($question, MenuDishChoice::QUESTION_MAXIMUM)) {
            $violations[] = $this->violation('question', 'validation.choice_question_too_long', ['{max}' => (string) MenuDishChoice::QUESTION_MAXIMUM]);
        }

        $known = Vec\map($options, static fn (MenuChoiceOption $one): string => $one->getId()->toRfc4122());
        $picked = $answers->pickedOptionIds ?? [];
        $kept = [];
        $taken = [];

        foreach ($sent['options'] as $at => $one) {
            $path = Str\format('options.%d.', $at);
            $id = $one['id'] ?? null;

            if (null !== $id && !Iter\contains($known, $id)) {
                throw ApiException::notFound('access.not_found');
            }

            $name = NameNormaliser::name($one['name']);
            $allergens = Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($one['allergens'] ?? [], $code));
            $none = $one['containsNone'] ?? false;
            $stated = [] !== $allergens || $none;

            if ('' === $name && !$stated) {
                if (null !== $id && Iter\contains($picked, $id)) {
                    $violations[] = $this->violation($path . 'name', 'menu.option_picked');
                }

                continue;
            }

            if ('' === $name) {
                $violations[] = $this->violation($path . 'name', 'validation.option_name_required');
            } elseif (VisibleText::tooLong($name, MenuChoiceOption::NAME_MAXIMUM)) {
                $violations[] = $this->violation($path . 'name', 'validation.option_name_too_long', ['{max}' => (string) MenuChoiceOption::NAME_MAXIMUM]);
            } elseif (Iter\contains($taken, NameNormaliser::key($name))) {
                $violations[] = $this->violation($path . 'name', 'validation.option_name_taken');
            }

            $taken[] = NameNormaliser::key($name);

            if ('' !== $name && ([] === $allergens) === !$none) {
                $violations[] = $this->violation($path . 'allergens', 'validation.dish_contains_required');
            }

            $kept[] = new OptionDetails($id, $name, $allergens);
        }

        if (Iter\count($kept) > MenuDishChoice::OPTIONS_MAXIMUM) {
            $violations[] = $this->violation('options', 'validation.choice_options_limit', ['{max}' => (string) MenuDishChoice::OPTIONS_MAXIMUM]);
        }

        if ($sent['pick'] >= MenuDishChoice::OPTIONS_MAXIMUM) {
            $violations[] = $this->violation('pick', 'validation.choice_options_limit', ['{max}' => (string) MenuDishChoice::OPTIONS_MAXIMUM]);
        }

        $sentIds = Vec\filter_nulls(Vec\map($sent['options'], static fn (array $one): ?string => $one['id'] ?? null));

        if (Iter\any($picked, static fn (string $id): bool => !Iter\contains($sentIds, $id))) {
            throw new ApiException(ErrorCode::ChoiceOptionPicked, 'menu.option_picked');
        }

        if (null !== $was && null !== $answers && $answers->answered()) {
            if ($sent['pick'] !== $was->getPick()) {
                $violations[] = $this->violation('pick', 'menu.choice_answered');
            }

            if ($sent['required'] && !$was->isRequired() && $answers->noneAnswers > 0) {
                $violations[] = $this->violation('required', 'menu.choice_answered');
            }

            $reasons = self::draftReasons($question, Iter\count($kept), $sent['pick']);

            if ([] !== $reasons) {
                $violations[] = $this->violation('draft', 'menu.choice_answered_draft');

                foreach ($reasons as [$key, $parameters]) {
                    $violations[] = $this->violation('draft', $key, $parameters);
                }
            }
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new ChoiceDetails($question, $kept, $sent['pick'], $sent['required']);
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
