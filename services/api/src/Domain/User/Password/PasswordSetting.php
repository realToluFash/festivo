<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

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
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $stepUp = \bin2hex(SecureRandom\bytes(self::STEP_UP_BYTES));
            $refusal = $this->check($user, $code, TokenIssuer::hash($stepUp));
            $this->entityManager->flush();
            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }

        // Thrown after the commit, so a wrong try is counted before it is refused.
        if (null !== $refusal) {
            throw $refusal;
        }

        return $stepUp;
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

    private function check(User $user, #[SensitiveParameter] string $code, string $stepUpHash): ?ApiException
    {
        $limit = $this->passwordSetAccountLimiter->create($user->getId()->toRfc4122());
        $peek = $limit->consume(0);

        if (0 === $peek->getRemainingTokens()) {
            return ApiException::tooManyAttempts('Too many tries.', $peek->getRetryAfter());
        }

        $held = $this->passwordSetCodeRepository->findOneForUser($user);
        $now = $this->clock->now();

        if (null === $held) {
            return new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.');
        }

        if ($held->isCodeExpiredAt($now)) {
            return new ApiException(ErrorCode::VerificationCodeExpired, 'That code has expired.');
        }

        if ($held->isExhausted()) {
            return new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.');
        }

        if (!\hash_equals($held->getCodeHash(), VerificationCodeIssuer::hash(Str\trim($code)))) {
            $held->wrongAttempt();
            $limit->consume();

            return $held->isExhausted()
                ? new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.')
                : new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.');
        }

        $held->passed($stepUpHash, $now);

        return null;
    }

    private function refuseIfSet(User $user): void
    {
        if (null !== $user->getPassword()) {
            throw new ApiException(ErrorCode::Conflict, 'This account already has a password.');
        }
    }
}
