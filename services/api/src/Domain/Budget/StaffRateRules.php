<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\PayRate;
use App\Enum\ErrorCode;
use App\Enum\StaffPay;
use App\Http\Exception\ApiException;
use App\Locale\Money;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A rate or a fee, in the event's currency and nothing else (sc-101); 0 is a rate.
 *
 * @phpstan-type Sent array{kind?: ?string, amount?: ?string, currency?: ?string}
 */
final readonly class StaffRateRules
{
    public function __construct(
        private TranslatorInterface $translator,
        private Money $money,
    ) {
    }

    /** @return Type\TypeInterface<Sent> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'kind' => Type\optional(Type\nullable(Type\string())),
            'amount' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param Sent $sent */
    public function rate(array $sent, string $eventCurrency): PayRate
    {
        $violations = [];
        $kindSent = Str\trim($sent['kind'] ?? '');
        $pay = StaffPay::tryFrom($kindSent);

        if (null === $pay) {
            $violations[] = $this->violation('kind', '' === $kindSent ? 'validation.staff_pay_required' : 'validation.staff_pay_unknown');
        }

        $fee = StaffPay::Flat === $pay;
        $amount = Str\trim($sent['amount'] ?? '');
        $minor = null;

        if ('' === $amount) {
            $violations[] = $this->violation('amount', $fee ? 'validation.staff_fee_required' : 'validation.staff_rate_required');
        } else {
            $minor = Money::minorOf($amount, $eventCurrency);

            if (null === $minor) {
                $violations[] = $this->refusal($amount, $fee, $eventCurrency);
            }
        }

        $currency = Str\uppercase(Str\trim($sent['currency'] ?? ''));

        if ('' === $currency) {
            $violations[] = $this->violation('currency', 'validation.budget_currency_required', ['{currency}' => $eventCurrency]);
        } elseif ($currency !== $eventCurrency) {
            $violations[] = $this->violation('currency', 'validation.budget_currency_mismatch', ['{currency}' => $eventCurrency]);
        }

        if ([] !== $violations || null === $pay || null === $minor) {
            throw ApiException::validation($violations);
        }

        return new PayRate($pay, $minor);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    public function noJob(): array
    {
        return $this->violation('member', 'validation.staff_rate_no_job');
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function refusal(string $amount, bool $fee, string $currency): array
    {
        if (Regex\matches($amount, '/^-\d+(\.\d+)?$/')) {
            return $this->violation('amount', $fee ? 'validation.staff_fee_negative' : 'validation.staff_rate_negative', code: LineRules::PRICE_NEGATIVE);
        }

        $example = ['{example}' => $this->money->example($currency)];

        if (Regex\matches($amount, '/^\d{1,15}\.\d+$/')) {
            return $this->violation('amount', $fee ? 'validation.staff_fee_too_many_decimals' : 'validation.staff_rate_too_many_decimals', $example);
        }

        return $this->violation('amount', $fee ? 'validation.staff_fee_invalid' : 'validation.staff_rate_invalid');
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
