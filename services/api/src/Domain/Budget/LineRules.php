<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineDetails;
use App\Domain\Menu\DishRules;
use App\Entity\BudgetLine;
use App\Enum\CostBasis;
use App\Enum\CostCategory;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * An unmatched value is refused, never mapped to a default nor saved in the event's currency instead (sc-83).
 *
 * @phpstan-type Sent array{label?: ?string, category?: ?string, basis?: ?string, rate?: ?string, amount?: ?string, currency?: ?string, note?: ?string}
 */
final readonly class LineRules
{
    public const string BASIS_UNKNOWN = 'budget_basis_unknown';

    public const string PRICE_NEGATIVE = 'budget_price_negative';

    public function __construct(
        private TranslatorInterface $translator,
        private DishRules $dishRules,
    ) {
    }

    /** @return Type\TypeInterface<Sent> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'label' => Type\optional(Type\nullable(Type\string())),
            'category' => Type\optional(Type\nullable(Type\string())),
            'basis' => Type\optional(Type\nullable(Type\string())),
            'rate' => Type\optional(Type\nullable(Type\string())),
            'amount' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
            'note' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param Sent $sent */
    public function details(array $sent, string $eventCurrency): LineDetails
    {
        $violations = [];
        $label = Str\trim($sent['label'] ?? '');

        if ('' === $label) {
            $violations[] = $this->violation('label', 'validation.budget_label_required');
        } elseif (VisibleText::tooLong($label, BudgetLine::LABEL_MAXIMUM)) {
            $violations[] = $this->violation('label', 'validation.budget_label_too_long', ['{max}' => (string) BudgetLine::LABEL_MAXIMUM]);
        }

        $categorySent = Str\trim($sent['category'] ?? '');
        $category = CostCategory::tryFrom($categorySent);

        if ('' === $categorySent) {
            $violations[] = $this->violation('category', 'validation.budget_category_required');
        } elseif (null === $category) {
            $violations[] = $this->violation('category', 'validation.budget_category_unknown');
        }

        $basisSent = Str\trim($sent['basis'] ?? '');
        $basis = CostBasis::tryFrom($basisSent);

        if ('' === $basisSent) {
            $violations[] = $this->violation('basis', 'validation.budget_basis_required');
        } elseif (null === $basis) {
            $violations[] = $this->violation('basis', 'validation.budget_basis_unknown', code: self::BASIS_UNKNOWN);
        }

        $rate = Str\trim($sent['rate'] ?? '');
        $amount = Str\trim($sent['amount'] ?? '');
        $priceMinor = null;

        if (null !== $basis) {
            [$field, $price, $stray] = CostBasis::Fixed === $basis ? ['amount', $amount, 'rate'] : ['rate', $rate, 'amount'];

            if (!$basis->isPriced()) {
                foreach (['rate' => $rate, 'amount' => $amount] as $path => $value) {
                    if ('' !== $value) {
                        $violations[] = $this->violation($path, 'validation.budget_staff_line_unpriced');
                    }
                }
            } else {
                if ('' !== ('rate' === $stray ? $rate : $amount)) {
                    $violations[] = $this->violation($stray, CostBasis::Fixed === $basis ? 'validation.budget_rate_on_fixed' : 'validation.budget_amount_not_fixed');
                }

                if ('' === $price) {
                    $violations[] = $this->violation($field, 'rate' === $field ? 'validation.budget_rate_required' : 'validation.budget_amount_required');
                } else {
                    $priceMinor = DishRules::minorOf($price, $eventCurrency);

                    if (null === $priceMinor) {
                        $violations[] = $this->priceRefusal($field, $price, $eventCurrency);
                    }
                }
            }
        }

        $currency = Str\uppercase(Str\trim($sent['currency'] ?? ''));

        if ('' !== $rate || '' !== $amount) {
            if ('' === $currency) {
                $violations[] = $this->violation('currency', 'validation.budget_currency_required', ['{currency}' => $eventCurrency]);
            } elseif ($currency !== $eventCurrency) {
                $violations[] = $this->violation('currency', 'validation.budget_currency_mismatch', ['{currency}' => $eventCurrency]);
            }
        } elseif ('' !== $currency && $currency !== $eventCurrency) {
            $violations[] = $this->violation('currency', 'validation.budget_currency_mismatch', ['{currency}' => $eventCurrency]);
        }

        $note = Str\trim($sent['note'] ?? '');

        if (VisibleText::tooLong($note, BudgetLine::NOTE_MAXIMUM)) {
            $violations[] = $this->violation('note', 'validation.budget_note_too_long', ['{max}' => (string) BudgetLine::NOTE_MAXIMUM]);
        }

        if ([] !== $violations || null === $category || null === $basis) {
            throw ApiException::validation($violations);
        }

        return new LineDetails($label, $category, $basis, $priceMinor, '' === $note ? null : $note);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    public function staffLineTaken(): array
    {
        return $this->violation('basis', 'validation.budget_staff_line_taken');
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function priceRefusal(string $field, string $price, string $currency): array
    {
        if (Regex\matches($price, '/^-\d+(\.\d+)?$/')) {
            return $this->violation($field, 'rate' === $field ? 'validation.budget_rate_negative' : 'validation.budget_amount_negative', code: self::PRICE_NEGATIVE);
        }

        $example = ['{example}' => $this->dishRules->example($currency)];

        if (Regex\matches($price, '/^\d{1,15}\.\d+$/')) {
            return $this->violation($field, 'rate' === $field ? 'validation.budget_rate_too_many_decimals' : 'validation.budget_amount_too_many_decimals', $example);
        }

        return $this->violation($field, 'rate' === $field ? 'validation.budget_rate_invalid' : 'validation.budget_amount_invalid', $example);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = [], string $code = ''): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => '' === $code ? ErrorCode::ValidationFailed->value : $code,
        ];
    }
}
