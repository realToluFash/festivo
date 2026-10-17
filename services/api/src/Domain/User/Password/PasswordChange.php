<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\TokenIssuer;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasswordFailure;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

/** A signed-in person who knows their password choosing a new one. Every other session ends; theirs stays. */
final readonly class PasswordChange
{
    public function __construct(
        private PasswordResolver $passwordResolver,
        private NewPasswordRules $newPasswordRules,
        private TokenIssuer $tokenIssuer,
        private PasswordChangeMailer $passwordChangeMailer,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $passwordChangeAccountLimiter,
    ) {
    }

    /** @return int how many other sessions were ended */
    public function change(
        User $user,
        #[SensitiveParameter]
        string $current,
        #[SensitiveParameter]
        string $new,
        ?Uuid $keepSession = null,
        ?Request $request = null,
    ): int {
        // The account's row lock spans the peek, the check and the spend, so parallel guesses queue
        // rather than all passing the peek before any of them pays (as SecondFactorCheck::guarded()).
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $this->guardCurrent($user, $current);
            $this->refuseUnfit($user, $new);

            $user->setPassword($this->passwordResolver->hash($new));
            $this->entityManager->flush();
            $signedOut = $this->tokenIssuer->revokeAllExcept($user, $keepSession);
            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }

        $at = $this->clock->now();
        $userAgent = $request?->headers->get('User-Agent');
        $ipAddress = $request?->getClientIp();
        $asked = $request?->getLocale();
        $this->afterResponse->defer(fn () => $this->passwordChangeMailer->sendChanged($user, $at, $userAgent, $ipAddress, $asked));

        return $signedOut;
    }

    /** A peek, then a spend only for a wrong current password, as sign-in counts its tries. */
    private function guardCurrent(User $user, #[SensitiveParameter] string $current): void
    {
        $limit = $this->passwordChangeAccountLimiter->create($user->getId()->toRfc4122());
        $peek = $limit->consume(0);

        if (0 === $peek->getRemainingTokens()) {
            throw ApiException::tooManyAttempts('Too many tries.', $peek->getRetryAfter());
        }

        if (!$this->passwordResolver->verify($user, $current)) {
            $limit->consume();

            throw new ApiException(ErrorCode::InvalidCredentials, 'That is not your current password.');
        }
    }

    private function refuseUnfit(User $user, #[SensitiveParameter] string $new): void
    {
        // Checked before the breach corpus: nothing to ask the network about a password already in use.
        if ($this->passwordResolver->verify($user, $new)) {
            throw ApiException::validation([[
                'propertyPath' => 'newPassword',
                'message' => $this->translator->trans('validation.' . PasswordFailure::Unchanged->value),
                'code' => PasswordFailure::Unchanged->value,
            ]]);
        }

        $violations = $this->newPasswordRules->violations($new, 'newPassword');

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }
    }
}
