<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Domain\User\TokenIssuer;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasswordFailure;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

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
        private GuardedAttempt $guardedAttempt,
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
        $signedOut = $this->guardedAttempt->attempt(
            fn () => $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE),
            fn (): array => [$this->passwordChangeAccountLimiter->create($user->getId()->toRfc4122())],
            function () use ($user, $current, $new, $keepSession): int|WrongSecret {
                if (!$this->passwordResolver->verify($user, $current)) {
                    return new WrongSecret(new ApiException(ErrorCode::InvalidCredentials, 'password.current_wrong'));
                }

                $this->refuseUnfit($user, $new);
                $user->setPassword($this->passwordResolver->hash($new));
                $this->entityManager->flush();

                return Iter\count($this->tokenIssuer->revokeAllExcept($user, $keepSession));
            },
            'limits.tries',
        );

        $at = $this->clock->now();
        $userAgent = $request?->headers->get('User-Agent');
        $ipAddress = $request?->getClientIp();
        $asked = $request?->getLocale();
        $this->afterResponse->defer(fn () => $this->passwordChangeMailer->sendChanged($user, $at, $userAgent, $ipAddress, $asked));

        return $signedOut;
    }

    private function refuseUnfit(User $user, #[SensitiveParameter] string $new): void
    {
        // Checked before the breach corpus: nothing to ask the network about a password already in use.
        if ($this->passwordResolver->verify($user, $new)) {
            throw ApiException::validation([[
                'propertyPath' => 'newPassword',
                'message' => $this->translator->trans('validation.password_unchanged'),
                'code' => PasswordFailure::Unchanged->value,
            ]]);
        }

        $violations = $this->newPasswordRules->violations($new, 'newPassword');

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }
    }
}
