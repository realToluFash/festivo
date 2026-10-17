<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Domain\User\TokenIssuer;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Entity\PasswordSetCode;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\PasswordSetCodeRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Throwable;

/** A Google or Apple account adding a password (sc-391): a code to the primary address first, so a stolen session cannot. */
final readonly class PasswordSetting
{
    private const int STEP_UP_BYTES = 32;

    public function __construct(
        private PasswordSetCodeRepository $passwordSetCodeRepository,
        private PasswordResolver $passwordResolver,
        private NewPasswordRules $newPasswordRules,
        private PasswordChangeMailer $passwordChangeMailer,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $passwordSetAccountLimiter,
    ) {
    }

    /** @return int|null seconds still to wait, or null once a code is on its way */
    public function sendCode(User $user, ?string $asked = null): ?int
    {
        $this->refuseIfSet($user);
        $now = $this->clock->now();
        $held = $this->passwordSetCodeRepository->findOneForUser($user);
        $wait = $held?->secondsUntilResendAt($now) ?? 0;

        if ($wait > 0) {
            return $wait;
        }

        $code = VerificationCodeIssuer::generate();
        $hash = VerificationCodeIssuer::hash($code);

        if (null === $held) {
            $this->entityManager->persist(new PasswordSetCode($user, $hash, $now));
        } else {
            $held->newCode($hash, $now);
        }

        $this->entityManager->flush();
        $this->afterResponse->defer(fn () => $this->passwordChangeMailer->sendCode($user, $code, $asked));

        return null;
    }

    /** @return string the one-time step-up token `set()` needs, so the pass is this client's, not the account's */
    public function passCode(User $user, #[SensitiveParameter] string $code): string
    {
        return new GuardedAttempt($this->entityManager)->attempt(
            fn () => $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE),
            fn (): array => [$this->passwordSetAccountLimiter->create($user->getId()->toRfc4122())],
            fn (): string|WrongSecret => $this->check($user, $code),
            'Too many tries.',
        );
    }

    /** Only with the step-up token the code gave this client, under the account's lock; nothing is signed out. */
    public function set(
        User $user,
        #[SensitiveParameter]
        string $password,
        #[SensitiveParameter]
        string $stepUp,
        ?Request $request = null,
    ): void {
        $now = $this->clock->now();
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $this->refuseIfSet($user);
            $held = $this->passwordSetCodeRepository->findOneForUser($user);

            if (null === $held || !$held->takeStepUp(TokenIssuer::hash($stepUp), $now)) {
                throw new ApiException(ErrorCode::VerificationCodeExpired, 'Enter the code from the email again.');
            }

            $violations = $this->newPasswordRules->violations($password, 'newPassword');

            if ([] !== $violations) {
                throw ApiException::validation($violations);
            }

            $user->setPassword($this->passwordResolver->hash($password));
            $this->entityManager->remove($held);
            $this->entityManager->flush();
            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }

        $userAgent = $request?->headers->get('User-Agent');
        $ipAddress = $request?->getClientIp();
        $asked = $request?->getLocale();
        $this->afterResponse->defer(fn () => $this->passwordChangeMailer->sendAdded($user, $now, $userAgent, $ipAddress, $asked));
    }

    /** A wrong code counts against the code itself too, which the commit keeps before the refusal is thrown. */
    private function check(User $user, #[SensitiveParameter] string $code): string|WrongSecret
    {
        $held = $this->passwordSetCodeRepository->findOneForUser($user);
        $now = $this->clock->now();

        match (true) {
            null === $held => throw new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.'),
            $held->isCodeExpiredAt($now) => throw new ApiException(ErrorCode::VerificationCodeExpired, 'That code has expired.'),
            $held->isExhausted() => throw new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.'),
            default => null,
        };

        if (!\hash_equals($held->getCodeHash(), VerificationCodeIssuer::hash(Str\trim($code)))) {
            $held->wrongAttempt();

            return new WrongSecret($held->isExhausted()
                ? new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.')
                : new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.'));
        }

        $stepUp = \bin2hex(SecureRandom\bytes(self::STEP_UP_BYTES));
        $held->passed(TokenIssuer::hash($stepUp), $now);

        return $stepUp;
    }

    private function refuseIfSet(User $user): void
    {
        if (null !== $user->getPassword()) {
            throw new ApiException(ErrorCode::Conflict, 'This account already has a password.');
        }
    }
}
