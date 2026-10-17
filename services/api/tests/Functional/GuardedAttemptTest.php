<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Tests\FunctionalTestCase;
use ArrayObject;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

/** sc-943: the one guarded check, tested once for every caller. */
final class GuardedAttemptTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function theLockIsTakenBeforeTheBudgetIsReadAndTheSecretChecked(): void
    {
        $log = new ArrayObject();

        $this->attempt(
            static fn () => $log->append('locked'),
            static function () use ($log): array {
                $log->append('budgets');

                return [self::budget(5)];
            },
            static function () use ($log): string {
                $log->append('checked');

                return 'right';
            },
        );

        self::assertSame(['locked', 'budgets', 'checked'], $log->getArrayCopy());
    }

    #[Test]
    public function aRightSecretSpendsNothingAndAWrongOneEveryBudgetOnce(): void
    {
        $account = self::budget(5);
        $network = self::budget(30);

        self::assertSame('right', $this->attempt(static fn () => null, static fn (): array => [$account, $network], static fn (): string => 'right'));
        self::assertSame(5, $account->consume(0)->getRemainingTokens());

        $refusal = $this->refusal(static fn (): array => [$account, $network], self::wrong());

        self::assertSame(ErrorCode::InvalidCredentials, $refusal->errorCode, 'the check\'s own refusal');
        self::assertSame(4, $account->consume(0)->getRemainingTokens());
        self::assertSame(29, $network->consume(0)->getRemainingTokens());
    }

    #[Test]
    public function aSpentBudgetRefusesBeforeTheSecretIsChecked(): void
    {
        $spent = self::budget(1);
        $spent->consume();
        $checked = false;

        $refusal = $this->refusal(static fn (): array => [$spent], static function () use (&$checked): string {
            $checked = true;

            return 'right';
        });

        self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);
        self::assertFalse($checked, 'nothing to learn from a guess once the budget is gone');
    }

    /** Only where the caller asks for it, as two-factor does: the wrong try that spends the budget is the pause. */
    #[Test]
    public function theLastWrongTryIsThePauseOnlyWhenAsked(): void
    {
        $plain = self::budget(1);
        self::assertSame(ErrorCode::InvalidCredentials, $this->refusal(static fn (): array => [$plain], self::wrong())->errorCode);

        $pausing = self::budget(1);
        self::assertSame(ErrorCode::TooManyAttempts, $this->refusal(static fn (): array => [$pausing], self::wrong(), lastWrongPauses: true)->errorCode);
    }

    /** A wrong try's own changes (a code's count) are committed before it is refused; a failure rolls back. */
    #[Test]
    public function aWrongTryIsKeptAndAFailureIsNot(): void
    {
        $user = self::service(UserRegistrar::class)->register('kept@example.com', 'Before', self::PASSWORD)->user;

        $this->refusal(static fn (): array => [self::budget(5)], static function () use ($user): WrongSecret {
            $user->setName('Counted');

            return new WrongSecret(new ApiException(ErrorCode::InvalidCredentials, 'Wrong.'));
        });
        self::em()->clear();
        self::assertSame('Counted', self::em()->find(User::class, $user->getId())?->getName());

        try {
            $this->attempt(static fn () => null, static fn (): array => [self::budget(5)], static function () use ($user): never {
                self::em()->find(User::class, $user->getId())?->setName('Lost');
                self::em()->flush();

                throw new RuntimeException('The database went away.');
            });
        } catch (RuntimeException) {
        }

        self::em()->clear();
        self::assertSame('Counted', self::em()->find(User::class, $user->getId())?->getName(), 'what the failed attempt wrote is gone');
    }

    /**
     * @param callable(): void                   $lock
     * @param callable(): list<LimiterInterface> $budgets
     * @param callable(): mixed                  $check
     */
    private function attempt(callable $lock, callable $budgets, callable $check, bool $lastWrongPauses = false): mixed
    {
        return new GuardedAttempt(self::em())->attempt($lock, $budgets, $check, 'Too many tries.', $lastWrongPauses);
    }

    /**
     * @param callable(): list<LimiterInterface> $budgets
     * @param callable(): mixed                  $check
     */
    private function refusal(callable $budgets, callable $check, bool $lastWrongPauses = false): ApiException
    {
        try {
            $this->attempt(static fn () => null, $budgets, $check, $lastWrongPauses);
        } catch (ApiException $e) {
            return $e;
        }

        self::fail('the attempt was accepted');
    }

    private static function wrong(): callable
    {
        return static fn (): WrongSecret => new WrongSecret(new ApiException(ErrorCode::InvalidCredentials, 'Wrong.'));
    }

    private static function budget(int $limit): LimiterInterface
    {
        return new RateLimiterFactory(['id' => 'test', 'policy' => 'fixed_window', 'limit' => $limit, 'interval' => '15 minutes'], new InMemoryStorage())->create('key');
    }
}
