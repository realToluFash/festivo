<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\PaymentDetails;
use App\Domain\Budget\Model\QuoteTerms;
use App\Domain\Budget\Model\QuoteWording;
use App\Entity\Event;
use App\Entity\Quote;
use App\Entity\ScheduledPayment;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\Money;
use App\Locale\SupportedLocales;
use App\Locale\VisibleText;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-type Violation array{propertyPath: string, message: string, code: string}
 * @phpstan-type SentQuote array{vendorId?: ?string, covers?: ?string, amount?: ?string, currency?: ?string, quotedOn?: ?string, reference?: ?string, lineIds?: ?list<string>}
 * @phpstan-type SentTerms array{amount?: ?string, currency?: ?string, quotedOn?: ?string}
 * @phpstan-type SentWording array{covers?: ?string, reference?: ?string, lineIds?: ?list<string>}
 * @phpstan-type SentPayment array{description?: ?string, amount?: ?string, currency?: ?string, dueOn?: ?string}
 */
final readonly class QuoteRules
{
    public const string DATE_IN_FUTURE = 'quote_date_in_future';

    public const string BEFORE_QUOTE = 'payment_before_quote';

    public const string LINE_AGREED = 'budget_line_agreed';

    public const string CURRENCY_MISMATCH = 'currency_mismatch';

    public const string VENDOR_GONE = 'vendor_gone';

    public function __construct(
        private TranslatorInterface $translator,
        private Money $money,
        private ClockInterface $clock,
    ) {
    }

    /** @return Type\TypeInterface<SentQuote> */
    public static function sentQuote(): Type\TypeInterface
    {
        return Type\shape([
            'vendorId' => Type\optional(Type\nullable(Type\string())),
            'covers' => Type\optional(Type\nullable(Type\string())),
            'amount' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
            'quotedOn' => Type\optional(Type\nullable(Type\string())),
            'reference' => Type\optional(Type\nullable(Type\string())),
            'lineIds' => Type\optional(Type\nullable(Type\vec(Type\string()))),
        ]);
    }

    /** @return Type\TypeInterface<SentTerms> */
    public static function sentTerms(): Type\TypeInterface
    {
        return Type\shape([
            'amount' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
            'quotedOn' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @return Type\TypeInterface<SentWording> */
    public static function sentWording(): Type\TypeInterface
    {
        return Type\shape([
            'covers' => Type\optional(Type\nullable(Type\string())),
            'reference' => Type\optional(Type\nullable(Type\string())),
            'lineIds' => Type\optional(Type\nullable(Type\vec(Type\string()))),
        ]);
    }

    /** @return Type\TypeInterface<SentPayment> */
    public static function sentPayment(): Type\TypeInterface
    {
        return Type\shape([
            'description' => Type\optional(Type\nullable(Type\string())),
            'amount' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
            'dueOn' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /**
     * @param SentQuote $sent
     *
     * @return array{QuoteTerms, QuoteWording}
     */
    public function quote(array $sent, Event $event): array
    {
        $violations = [];

        if ('' === Str\trim($sent['vendorId'] ?? '')) {
            $violations[] = $this->violation('vendorId', 'validation.quote_vendor_required');
        }

        $wording = $this->wordingChecked($sent['covers'] ?? '', $sent['reference'] ?? '', $sent['lineIds'] ?? [], $violations);
        $terms = $this->termsChecked($sent['amount'] ?? '', $sent['currency'] ?? '', $sent['quotedOn'] ?? '', $event, $violations);

        if ([] !== $violations || null === $terms) {
            throw ApiException::validation($violations);
        }

        return [$terms, $wording];
    }

    /** @param SentTerms $sent */
    public function terms(array $sent, Event $event): QuoteTerms
    {
        $violations = [];
        $terms = $this->termsChecked($sent['amount'] ?? '', $sent['currency'] ?? '', $sent['quotedOn'] ?? '', $event, $violations);

        if ([] !== $violations || null === $terms) {
            throw ApiException::validation($violations);
        }

        return $terms;
    }

    /** @param SentWording $sent */
    public function wording(array $sent): QuoteWording
    {
        $violations = [];
        $wording = $this->wordingChecked($sent['covers'] ?? '', $sent['reference'] ?? '', $sent['lineIds'] ?? [], $violations);

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $wording;
    }

    /** @param SentPayment $sent */
    public function payment(array $sent, Event $event, Quote $current): PaymentDetails
    {
        $violations = [];
        $description = Str\trim($sent['description'] ?? '');

        if ('' === $description) {
            $violations[] = $this->violation('description', 'validation.payment_description_required');
        } elseif (VisibleText::tooLong($description, ScheduledPayment::DESCRIPTION_MAXIMUM)) {
            $violations[] = $this->violation('description', 'validation.payment_description_too_long', ['{max}' => (string) ScheduledPayment::DESCRIPTION_MAXIMUM]);
        }

        $amountMinor = $this->amountChecked($sent['amount'] ?? '', $sent['currency'] ?? '', $event, $violations);
        $dueOn = self::day($sent['dueOn'] ?? '');

        if (null === $dueOn) {
            $violations[] = $this->violation('dueOn', 'validation.payment_due_required');
        } elseif ($dueOn < $current->getQuotedOn()) {
            $violations[] = $this->violation('dueOn', 'validation.payment_before_quote', [
                '{vendor}' => $current->getEngagement()->getVendor()->getName(),
                '{date}' => $this->written($current->getQuotedOn()),
            ], self::BEFORE_QUOTE);
        }

        if ([] !== $violations || null === $amountMinor || null === $dueOn) {
            throw ApiException::validation($violations);
        }

        return new PaymentDetails($description, $amountMinor, $dueOn);
    }

    /** @return Violation */
    public function vendorGone(): array
    {
        return $this->violation('vendorId', 'validation.quote_vendor_gone', code: self::VENDOR_GONE);
    }

    /** @return Violation */
    public function lineAgreed(string $line, string $vendor): array
    {
        return $this->violation('lineIds', 'validation.quote_line_agreed', ['{line}' => $line, '{vendor}' => $vendor], self::LINE_AGREED);
    }

    /**
     * @param list<string>    $lineIds
     * @param list<Violation> $violations
     */
    private function wordingChecked(string $covers, string $reference, array $lineIds, array &$violations): QuoteWording
    {
        $covers = Str\trim($covers);

        if ('' === $covers) {
            $violations[] = $this->violation('covers', 'validation.quote_covers_required');
        } elseif (VisibleText::tooLong($covers, Quote::COVERS_MAXIMUM)) {
            $violations[] = $this->violation('covers', 'validation.quote_covers_too_long', ['{max}' => (string) Quote::COVERS_MAXIMUM]);
        }

        $reference = Str\trim($reference);

        if (VisibleText::tooLong($reference, Quote::REFERENCE_MAXIMUM)) {
            $violations[] = $this->violation('reference', 'validation.quote_reference_too_long', ['{max}' => (string) Quote::REFERENCE_MAXIMUM]);
        }

        return new QuoteWording($covers, '' === $reference ? null : $reference, $lineIds);
    }

    /** @param list<Violation> $violations */
    private function termsChecked(string $amount, string $currency, string $typedOn, Event $event, array &$violations): ?QuoteTerms
    {
        $amountMinor = $this->amountChecked($amount, $currency, $event, $violations);
        $quotedOn = self::day($typedOn);

        if (null === $quotedOn) {
            $violations[] = $this->violation('quotedOn', 'validation.quote_date_required');
        } elseif ($quotedOn > $this->today($event)) {
            $violations[] = $this->violation('quotedOn', 'validation.quote_date_in_future', code: self::DATE_IN_FUTURE);
        }

        return null === $amountMinor || null === $quotedOn ? null : new QuoteTerms($amountMinor, $quotedOn);
    }

    /** @param list<Violation> $violations */
    private function amountChecked(string $typed, string $sentCurrency, Event $event, array &$violations): ?int
    {
        $currency = $event->getCurrency();
        $amount = Str\trim($typed);
        $minor = '' === $amount ? null : Money::minorOf($amount, $currency);

        if (null === $minor || $minor <= 0) {
            $violations[] = $this->violation('amount', 'validation.money_amount_invalid', ['{example}' => $this->money->example($currency)]);
        }

        $sentCurrency = Str\uppercase(Str\trim($sentCurrency));

        if ($sentCurrency !== $currency) {
            $violations[] = $this->violation('currency', 'validation.money_currency_mismatch', ['{currency}' => $currency], self::CURRENCY_MISMATCH);
        }

        return null === $minor || $minor <= 0 ? null : $minor;
    }

    private function today(Event $event): DateTimeImmutable
    {
        return new DateTimeImmutable($this->clock->now()->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d'));
    }

    private static function day(string $typed): ?DateTimeImmutable
    {
        if (!Regex\matches($typed, '/^\d{4}-\d{2}-\d{2}$/')) {
            return null;
        }

        $day = DateTimeImmutable::createFromFormat('!Y-m-d', $typed);

        return false !== $day && $day->format('Y-m-d') === $typed ? $day : null;
    }

    private function written(DateTimeImmutable $day): string
    {
        $dates = SupportedLocales::dates($this->translator->getLocale());
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('EEEdMMM') ?: 'EEE d MMM';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, $pattern);

        return $formatter?->format(new DateTimeImmutable($day->format('Y-m-d') . 'T00:00:00Z')) ?: $day->format('D j M');
    }

    /** @return Violation */
    private function violation(string $path, string $key, array $parameters = [], string $code = ''): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => '' === $code ? ErrorCode::ValidationFailed->value : $code,
        ];
    }
}
