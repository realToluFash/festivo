<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\QuantityFacts;
use App\Domain\Budget\Model\WhatIfChanges;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Psl\Iter;
use Psl\Math;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A what-if's changes (sc-86): an unmatched one is refused with the change named, never clamped to zero nor ignored.
 *
 * @phpstan-type Sent array{changes?: list<array{change: mixed, by: mixed}>}
 */
final readonly class WhatIfRules
{
    public const array CHANGES = ['guests', 'tables', 'staff_hours', 'days'];

    public const int MOST = 100_000;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @return Type\TypeInterface<Sent> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'changes' => Type\optional(Type\vec(Type\shape([
                'change' => Type\mixed(),
                'by' => Type\mixed(),
            ]))),
        ]);
    }

    /** @param Sent $sent */
    public function changes(array $sent, QuantityFacts $facts): WhatIfChanges
    {
        $violations = [];
        $totals = ['guests' => 0, 'tables' => 0, 'staff_hours' => 0, 'days' => 0];
        $firstAt = [];

        foreach ($sent['changes'] ?? [] as $at => ['change' => $change, 'by' => $by]) {
            $path = 'changes.' . $at;

            if (!\is_string($change) || !Iter\contains(self::CHANGES, $change)) {
                $violations[] = $this->violation($path . '.change', 'validation.what_if_change_unknown', ['change' => \is_scalar($change) ? (string) $change : '']);

                continue;
            }

            $whole = self::whole($by);

            if (null === $whole) {
                $violations[] = $this->violation($path . '.by', 'validation.what_if_not_whole', ['change' => $change]);
            } elseif (Math\abs($whole) > self::MOST) {
                $violations[] = $this->violation($path . '.by', 'validation.what_if_too_large', ['change' => $change, 'most' => self::MOST]);
            } elseif ('guests' === $change && $whole < 1) {
                $violations[] = $this->violation($path . '.by', 'validation.what_if_guests_below_one');
            } else {
                $totals[$change] += $whole;
                $firstAt[$change] ??= $path;
            }
        }

        $now = ['guests' => $facts->onList, 'tables' => $facts->seatingTables ?? 0, 'staff_hours' => $facts->staffHours ?? 0, 'days' => $facts->eventDays];

        foreach ($totals as $change => $by) {
            if ($now[$change] + $by < 0) {
                $violations[] = $this->violation(($firstAt[$change] ?? 'changes') . '.by', 'validation.what_if_below_zero', ['change' => $change, 'count' => $now[$change]]);
            }
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new WhatIfChanges($totals['guests'], $totals['tables'], $totals['staff_hours'], $totals['days']);
    }

    private static function whole(mixed $by): ?int
    {
        return match (true) {
            \is_int($by) => $by,
            \is_float($by) && \is_finite($by) && Math\abs($by) <= (float) self::MOST && Math\floor($by) === $by => (int) $by,
            \is_float($by) && \is_finite($by) && Math\floor($by) === $by => self::MOST + 1,
            default => null,
        };
    }

    /**
     * @param array<string, int|string> $parameters
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
