<?php

declare(strict_types=1);

namespace App\Domain\User\Attempts;

use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Component\RateLimiter\LimiterInterface;
use Throwable;

/** The one way a secret meets its attempt budgets (sc-943): peek, check, charge a wrong one, under the caller's lock. */
final readonly class GuardedAttempt
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @template T
     *
     * @param callable(): void                   $lock            the account's (or address's) lock, never the IP's
     * @param callable(): list<LimiterInterface> $budgets         read once the lock is held, each charged once if wrong
     * @param callable(): (T|WrongSecret)        $check           the check, and whatever a right secret goes on to do
     * @param bool                               $lastWrongPauses the wrong try that spends a budget is refused as the pause
     *
     * @return T
     */
    public function attempt(callable $lock, callable $budgets, callable $check, string $paused, bool $lastWrongPauses = false): mixed
    {
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $lock();
            $limits = $budgets();
            $refusal = self::spentAlready($limits, $paused);
            $result = null === $refusal ? $check() : null;

            if ($result instanceof WrongSecret) {
                $refusal = self::charged($limits, $result, $paused, $lastWrongPauses);
            }

            $this->entityManager->flush();
            $connection->commit();
        } catch (Throwable $e) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            throw $e;
        }

        // Thrown after the commit, so what the wrong try changed (a code's own count) is kept.
        if (null !== $refusal) {
            throw $refusal;
        }

        return $result;
    }

    /** @param list<LimiterInterface> $budgets */
    private static function spentAlready(array $budgets, string $paused): ?ApiException
    {
        foreach ($budgets as $budget) {
            $peek = $budget->consume(0);

            if ($peek->getRemainingTokens() <= 0) {
                return ApiException::tooManyAttempts($paused, $peek->getRetryAfter());
            }
        }

        return null;
    }

    /** @param list<LimiterInterface> $budgets */
    private static function charged(array $budgets, WrongSecret $wrong, string $paused, bool $lastWrongPauses): ApiException
    {
        $spends = Vec\map($budgets, static fn (LimiterInterface $budget) => $budget->consume());

        foreach ($spends as $spend) {
            if ($lastWrongPauses && $spend->getRemainingTokens() <= 0) {
                return ApiException::tooManyAttempts($paused, $spend->getRetryAfter());
            }
        }

        return $wrong->refusal;
    }
}
