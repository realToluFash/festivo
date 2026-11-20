<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\ChosenSplit;
use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\Model\SplitDraft;
use App\Entity\Event;
use App\Entity\Payer;
use App\Enum\ErrorCode;
use App\Enum\PayerSplit;
use App\Http\Exception\ApiException;
use App\Locale\Money;
use App\Repository\BudgetLineRepository;
use App\Repository\PayerRepository;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * What Choose who pays refuses, the API refuses (sc-91): each case a 422 violation on its field.
 *
 * @phpstan-type SentPart array{payerId?: ?string, percent?: ?string, amount?: ?string}
 * @phpstan-type SentSplit array{lineIds?: ?list<string>, split?: ?array{mode?: ?string, payerId?: ?string, shares?: ?list<SentPart>, amounts?: ?list<SentPart>, restId?: ?string}, currency?: ?string}
 */
final readonly class SplitRules
{
    public const string LINE_REMOVED = 'budget_line_removed';

    public const string PAYER_REMOVED = 'payer_removed';

    public function __construct(
        private TranslatorInterface $translator,
        private Money $money,
        private PayerRepository $payerRepository,
        private BudgetLineRepository $budgetLineRepository,
    ) {
    }

    /** @return Type\TypeInterface<SentSplit> */
    public static function sent(): Type\TypeInterface
    {
        $part = Type\shape([
            'payerId' => Type\optional(Type\nullable(Type\string())),
            'percent' => Type\optional(Type\nullable(Type\string())),
            'amount' => Type\optional(Type\nullable(Type\string())),
        ]);

        return Type\shape([
            'lineIds' => Type\optional(Type\nullable(Type\vec(Type\string()))),
            'split' => Type\optional(Type\nullable(Type\shape([
                'mode' => Type\optional(Type\nullable(Type\string())),
                'payerId' => Type\optional(Type\nullable(Type\string())),
                'shares' => Type\optional(Type\nullable(Type\vec($part))),
                'amounts' => Type\optional(Type\nullable(Type\vec($part))),
                'restId' => Type\optional(Type\nullable(Type\string())),
            ]))),
            'currency' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param SentSplit $sent */
    public function split(Event $event, array $sent, QuantityFacts $facts): ChosenSplit
    {
        $draft = new SplitDraft();
        $lines = [];
        $lineIds = $sent['lineIds'] ?? [];

        if ([] === $lineIds) {
            $this->refuse($draft, 'lineIds', 'validation.payer_split_costs_required');
        }

        foreach (Vec\unique($lineIds) as $lineId) {
            $line = Uuid::isValid($lineId) ? $this->budgetLineRepository->findOneBy(['event' => $event, 'id' => Uuid::fromString($lineId)]) : null;

            if (null === $line || $line->isCurrencyChanged()) {
                $this->refuse($draft, 'lineIds', 'validation.payer_split_cost_unknown');
            } elseif ($line->isRemoved()) {
                $this->refuse($draft, 'lineIds', 'validation.payer_split_cost_removed', ['{cost}' => $line->getLabel()], self::LINE_REMOVED);
            } else {
                $lines[] = $line;
            }
        }

        $chosen = $sent['split'] ?? null;
        $split = null === $chosen ? null : PayerSplit::tryFrom($chosen['mode'] ?? '');
        $rest = null;

        if (null !== $chosen && null === $split) {
            $this->refuse($draft, 'split.mode', 'validation.payer_split_mode_unknown');
        } elseif (PayerSplit::One === $split) {
            $payer = $this->payer($event, $draft, 'split.payerId', $chosen['payerId'] ?? null, 'validation.payer_split_payer_required');

            if (null !== $payer) {
                $draft->parts[] = ['payer' => $payer, 'value' => PayerShares::WHOLE];
            }
        } elseif (PayerSplit::Percent === $split) {
            $this->percentages($event, $draft, $chosen['shares'] ?? []);
        } elseif (PayerSplit::Fixed === $split) {
            if (Iter\count($lineIds) > 1) {
                $this->refuse($draft, 'split.mode', 'validation.payer_split_fixed_one_cost');
            }

            $rest = $this->payer($event, $draft, 'split.restId', $chosen['restId'] ?? null, 'validation.payer_split_rest_required');
            $this->amounts($event, $draft, $chosen['amounts'] ?? [], $sent['currency'] ?? null, $rest);
            $line = $lines[0] ?? null;
            $together = Iter\reduce($draft->parts, static fn (int $all, array $part): int => $all + $part['value'], 0);
            $least = null === $line ? 0 : (int) (string) BudgetRange::of([$line], $facts)->confirmedMinor;

            if (null !== $line && [] === $draft->violations && $together > $least) {
                $currency = $event->getCurrency();
                $this->refuse($draft, 'split.amounts', 'validation.payer_split_amounts_over', ['{sum}' => $this->money->shown($together, $currency), '{least}' => $this->money->shown($least, $currency)]);
            }
        }

        if ([] !== $draft->violations) {
            throw ApiException::validation($draft->violations);
        }

        return new ChosenSplit($lines, $split, $draft->parts, $rest);
    }

    /** @param list<SentPart> $sent */
    private function percentages(Event $event, SplitDraft $draft, array $sent): void
    {
        $refused = Iter\count($draft->violations);

        foreach ($sent as $part) {
            $id = $part['payerId'] ?? '';
            $path = Str\format('split.shares.%s', $id);
            $typed = Str\trim($part['percent'] ?? '');
            [$whole, $fraction] = [...Str\split($typed, '.'), ''];

            if ('' === $typed) {
                continue;
            }

            if (!Regex\matches($typed, '/^\d{1,6}(\.\d+)?$/') || (int) $whole > 100 || (100 === (int) $whole && Regex\matches($fraction, '/[1-9]/'))) {
                $this->refuse($draft, $path, 'validation.payer_split_percent_range');

                continue;
            }

            if (Str\length($fraction) > 2) {
                $this->refuse($draft, $path, 'validation.payer_split_percent_decimals');

                continue;
            }

            $hundredths = (int) $whole * 100 + (int) Str\pad_right($fraction, 2, '0');

            if (0 !== $hundredths) {
                $this->add($event, $draft, $path, $id, $hundredths, null);
            }
        }

        $total = Iter\reduce($draft->parts, static fn (int $all, array $part): int => $all + $part['value'], 0);

        if (Iter\count($draft->violations) === $refused && PayerShares::WHOLE !== $total) {
            $this->refuse($draft, 'split.shares', 'validation.payer_split_percent_total', ['percent' => $total / 100]);
        }
    }

    /** @param list<SentPart> $sent */
    private function amounts(Event $event, SplitDraft $draft, array $sent, ?string $currencySent, ?Payer $rest): void
    {
        $currency = $event->getCurrency();
        $example = ['{currency}' => $currency, '{example}' => $this->money->example($currency)];
        $typedAny = false;

        foreach ($sent as $part) {
            $id = $part['payerId'] ?? '';
            $typed = Str\trim($part['amount'] ?? '');

            if ('' === $typed) {
                continue;
            }

            $typedAny = true;
            $minor = Money::minorOf($typed, $currency);

            if (null === $minor || $minor <= 0) {
                $this->refuse($draft, Str\format('split.amounts.%s', $id), 'validation.payer_split_amount_invalid', $example);
            } else {
                $this->add($event, $draft, Str\format('split.amounts.%s', $id), $id, $minor, $rest);
            }
        }

        if (!$typedAny) {
            $this->refuse($draft, 'split.amounts', 'validation.payer_split_amount_invalid', $example);
        }

        $currencySent = Str\uppercase(Str\trim($currencySent ?? ''));

        if ('' === $currencySent) {
            $this->refuse($draft, 'currency', 'validation.budget_currency_required', ['{currency}' => $currency]);
        } elseif ($currencySent !== $currency) {
            $this->refuse($draft, 'currency', 'validation.budget_currency_mismatch', ['{currency}' => $currency]);
        }
    }

    private function add(Event $event, SplitDraft $draft, string $path, string $id, int $value, ?Payer $rest): void
    {
        $payer = $this->payer($event, $draft, $path, $id, 'validation.payer_split_payer_required');

        if (null === $payer) {
            return;
        }

        if (null !== $rest && $payer === $rest) {
            $this->refuse($draft, $path, 'validation.payer_split_rest_has_amount');
        } elseif (Iter\any($draft->parts, static fn (array $one): bool => $one['payer'] === $payer)) {
            $this->refuse($draft, $path, 'validation.payer_split_payer_twice');
        } else {
            $draft->parts[] = ['payer' => $payer, 'value' => $value];
        }
    }

    private function payer(Event $event, SplitDraft $draft, string $path, ?string $id, string $required): ?Payer
    {
        $id = Str\trim($id ?? '');
        $payer = '' === $id ? null : $this->payerRepository->findAnyInEvent($event, $id);

        if ('' === $id) {
            $this->refuse($draft, $path, $required);
        } elseif (null === $payer) {
            $this->refuse($draft, $path, 'validation.payer_split_payer_unknown');
        } elseif ($payer->isRemoved()) {
            $this->refuse($draft, $path, 'validation.payer_split_payer_removed', ['{name}' => $payer->getName()], self::PAYER_REMOVED);

            return null;
        }

        return $payer;
    }

    /** @param array<string, string|float> $parameters */
    private function refuse(SplitDraft $draft, string $path, string $key, array $parameters = [], string $code = ''): void
    {
        $draft->violations[] = [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => '' === $code ? ErrorCode::ValidationFailed->value : $code,
        ];
    }
}
