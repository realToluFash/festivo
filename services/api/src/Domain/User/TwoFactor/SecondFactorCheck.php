<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Entity\TwoFactorFactor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Regex;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Throwable;

/** One attempt budget per account, shared by sign-in, setup and turning off, so guessing cannot move between them. */
final readonly class SecondFactorCheck
{
    public function __construct(
        private SecretBox $secretBox,
        private AuthenticatorCodes $authenticatorCodes,
        private RecoveryCodes $recoveryCodes,
        private RateLimiterFactoryInterface $twoFactorAccountLimiter,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function passCode(TwoFactorFactor $factor, #[SensitiveParameter] string $code): void
    {
        $this->guarded($factor, function () use ($factor, $code): void {
            $secret = $this->secretBox->open($factor->getEncryptedSecret());
            $step = $this->authenticatorCodes->matchingStep($secret, $code, $this->clock->now()->getTimestamp());
            $last = $factor->getLastAcceptedStep();

            // A code already accepted, or one older than it, is a replay and reads as a wrong one.
            if (null === $step || (null !== $last && $step <= $last)) {
                throw $this->spend($factor, ErrorCode::TwoFactorCodeInvalid, 'That code did not work.');
            }

            $factor->accepted($step);
        });
    }

    public function passRecoveryCode(TwoFactorFactor $factor, #[SensitiveParameter] string $typed): void
    {
        $this->guarded($factor, function () use ($factor, $typed): void {
            $code = $this->recoveryCodes->find($factor->getUser(), $typed);

            if (null === $code) {
                throw $this->spend($factor, ErrorCode::TwoFactorCodeInvalid, 'That code did not work.');
            }

            if ($code->isUsed()) {
                throw $this->spend($factor, ErrorCode::RecoveryCodeUsed, 'That recovery code has already been used.');
            }

            $code->markUsed($this->clock->now());
        });
    }

    /** Turning it off takes either kind in one field: six digits is an app code. */
    public function passEither(TwoFactorFactor $factor, #[SensitiveParameter] string $typed): void
    {
        $trimmed = Regex\replace($typed, '/\s+/', '');

        Regex\matches($trimmed, '/^\d{6}$/')
            ? $this->passCode($factor, $trimmed)
            : $this->passRecoveryCode($factor, $trimmed);
    }

    /** Locked from peek to charge, so parallel guesses queue instead of all passing the peek. */
    private function guarded(TwoFactorFactor $factor, callable $check): void
    {
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($factor, LockMode::PESSIMISTIC_WRITE);
            $this->refuseIfLocked($factor);
            $check();
            $this->entityManager->flush();
            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }
    }

    private function refuseIfLocked(TwoFactorFactor $factor): void
    {
        $peek = $this->limiter($factor)->consume(0);

        if ($peek->getRemainingTokens() <= 0) {
            throw ApiException::tooManyAttempts('Too many wrong codes.', $peek->getRetryAfter());
        }
    }

    private function spend(TwoFactorFactor $factor, ErrorCode $errorCode, string $refusal): ApiException
    {
        $limit = $this->limiter($factor)->consume();

        return $limit->getRemainingTokens() <= 0
            ? ApiException::tooManyAttempts('Too many wrong codes.', $limit->getRetryAfter())
            : new ApiException($errorCode, $refusal);
    }

    private function limiter(TwoFactorFactor $factor): LimiterInterface
    {
        return $this->twoFactorAccountLimiter->create($factor->getUser()->getId()->toRfc4122());
    }
}
