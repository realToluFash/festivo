<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Entity\TwoFactorFactor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Regex;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

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
        private GuardedAttempt $guardedAttempt,
    ) {
    }

    public function passCode(TwoFactorFactor $factor, #[SensitiveParameter] string $code): void
    {
        $this->guarded($factor, function () use ($factor, $code): ?WrongSecret {
            $secret = $this->secretBox->open($factor->getEncryptedSecret());
            $step = $this->authenticatorCodes->matchingStep($secret, $code, $this->clock->now()->getTimestamp());
            $last = $factor->getLastAcceptedStep();

            // A code already accepted, or one older than it, is a replay and reads as a wrong one.
            if (null === $step || (null !== $last && $step <= $last)) {
                return new WrongSecret(new ApiException(ErrorCode::TwoFactorCodeInvalid, 'code.did_not_work'));
            }

            $factor->accepted($step);

            return null;
        });
    }

    public function passRecoveryCode(TwoFactorFactor $factor, #[SensitiveParameter] string $typed): void
    {
        $this->guarded($factor, function () use ($factor, $typed): ?WrongSecret {
            $code = $this->recoveryCodes->find($factor->getUser(), $typed);

            if (null === $code) {
                return new WrongSecret(new ApiException(ErrorCode::TwoFactorCodeInvalid, 'code.did_not_work'));
            }

            if ($code->isUsed()) {
                return new WrongSecret(new ApiException(ErrorCode::RecoveryCodeUsed, 'two_factor.recovery_code_used'));
            }

            $code->markUsed($this->clock->now());

            return null;
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

    /** @param callable(): ?WrongSecret $check */
    private function guarded(TwoFactorFactor $factor, callable $check): void
    {
        $this->guardedAttempt->attempt(
            fn () => $this->entityManager->refresh($factor, LockMode::PESSIMISTIC_WRITE),
            fn (): array => [$this->twoFactorAccountLimiter->create($factor->getUser()->getId()->toRfc4122())],
            $check,
            'limits.wrong_codes',
        );
    }
}
