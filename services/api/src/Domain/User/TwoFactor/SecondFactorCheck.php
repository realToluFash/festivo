<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Domain\User\Model\SecondFactorAnswer;
use App\Domain\User\TwoFactor\Passkey\Passkeys;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Exception\ApiException;
use App\Repository\TwoFactorFactorRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Regex;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/** One attempt budget per account, shared by every step and every factor, so guessing cannot move between them. */
final readonly class SecondFactorCheck
{
    public function __construct(
        private SecretBox $secretBox,
        private AuthenticatorCodes $authenticatorCodes,
        private RecoveryCodes $recoveryCodes,
        private Passkeys $passkeys,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private RateLimiterFactoryInterface $twoFactorAccountLimiter,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private GuardedAttempt $guardedAttempt,
    ) {
    }

    /** Whichever factor the answer carries. The app's code with no app reads as a wrong code. */
    public function pass(User $user, SecondFactorAnswer $answer, PasskeyStep $step): void
    {
        match (true) {
            null !== $answer->passkey => $this->passPasskey($user, $answer->passkey, $step),
            null !== $answer->code => $this->passAppCode($user, $answer->code),
            null !== $answer->recoveryCode => $this->passRecoveryCode($user, $answer->recoveryCode),
            null !== $answer->either => $this->passEither($user, $answer->either),
            default => throw new ApiException(ErrorCode::BadRequest, 'two_factor.code_or_recovery_code'),
        };
    }

    /** The app's code, for a factor that may not be on yet: setting it up checks the first code. */
    public function passCode(TwoFactorFactor $factor, #[SensitiveParameter] string $code): void
    {
        $this->guarded($factor->getUser(), function () use ($factor, $code): ?WrongSecret {
            $this->entityManager->refresh($factor);
            $secret = $this->secretBox->open($factor->getEncryptedSecret());
            $step = $this->authenticatorCodes->matchingStep($secret, $code, $this->clock->now()->getTimestamp());
            $last = $factor->getLastAcceptedStep();

            // A code already accepted, or one older than it, is a replay and reads as a wrong one.
            if (null === $step || (null !== $last && $step <= $last)) {
                return self::wrongCode();
            }

            $factor->accepted($step);

            return null;
        });
    }

    public function passRecoveryCode(User $user, #[SensitiveParameter] string $typed): void
    {
        $this->guarded($user, function () use ($user, $typed): ?WrongSecret {
            $code = $this->recoveryCodes->find($user, $typed);

            if (null === $code) {
                return self::wrongCode();
            }

            if ($code->isUsed()) {
                return new WrongSecret(new ApiException(ErrorCode::RecoveryCodeUsed, 'two_factor.recovery_code_used'));
            }

            $code->markUsed($this->clock->now());

            return null;
        });
    }

    /** One field taking either kind: six digits is an app code. */
    public function passEither(User $user, #[SensitiveParameter] string $typed): void
    {
        $trimmed = Regex\replace($typed, '/\s+/', '');

        Regex\matches($trimmed, '/^\d{6}$/')
            ? $this->passAppCode($user, $trimmed)
            : $this->passRecoveryCode($user, $trimmed);
    }

    private function passAppCode(User $user, #[SensitiveParameter] string $code): void
    {
        $factor = $this->twoFactorFactorRepository->findActiveFor($user);

        if (null === $factor) {
            $this->guarded($user, self::wrongCode(...));

            return;
        }

        $this->passCode($factor, $code);
    }

    /** @param array<string, mixed> $credential */
    private function passPasskey(User $user, array $credential, PasskeyStep $step): void
    {
        $this->guarded($user, fn (): ?WrongSecret => $this->passkeys->passes($user, $step, $credential)
            ? null
            : new WrongSecret(new ApiException(ErrorCode::PasskeyRefused, 'passkey.did_not_work')));
    }

    /** @param callable(): ?WrongSecret $check */
    private function guarded(User $user, callable $check): void
    {
        $this->guardedAttempt->attempt(
            fn () => $this->entityManager->getConnection()->executeStatement('SELECT 1 FROM users WHERE id = ? FOR UPDATE', [$user->getId()->toRfc4122()]),
            fn (): array => [$this->twoFactorAccountLimiter->create($user->getId()->toRfc4122())],
            $check,
            'limits.wrong_codes',
        );
    }

    private static function wrongCode(): WrongSecret
    {
        return new WrongSecret(new ApiException(ErrorCode::TwoFactorCodeInvalid, 'code.did_not_work'));
    }
}
