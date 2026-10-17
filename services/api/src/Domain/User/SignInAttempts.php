<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
use App\Domain\User\Model\SignInResult;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/** Sign-in's budgets per address (sc-838) under an advisory lock; never per IP, so one venue's Wi-Fi never queues. */
final readonly class SignInAttempts
{
    public function __construct(
        private UserAuthenticator $userAuthenticator,
        private EntityManagerInterface $entityManager,
        private RateLimiterFactoryInterface $signInIpLimiter,
        private RateLimiterFactoryInterface $signInAccountLimiter,
        private GuardedAttempt $guardedAttempt,
    ) {
    }

    public function signIn(string $email, #[SensitiveParameter] string $password, ?Request $request = null): SignInResult
    {
        // Keyed on the address as given: limiting only known accounts answers "is this registered".
        $address = EmailAddressNormaliser::normalise($email);

        return $this->guardedAttempt->attempt(
            fn () => $this->entityManager->getConnection()->executeStatement('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', ['key' => self::lockFor($address)]),
            fn (): array => [$this->signInAccountLimiter->create($address), $this->signInIpLimiter->create($request?->getClientIp() ?? '')],
            function () use ($email, $password, $request): SignInResult|WrongSecret {
                try {
                    return $this->userAuthenticator->signIn($email, $password, $request);
                } catch (ApiException $e) {
                    return ErrorCode::InvalidCredentials === $e->errorCode ? new WrongSecret($e) : throw $e;
                }
            },
            'Too many sign-in attempts.',
        );
    }

    /** The advisory lock's key for an address, held until the transaction ends. */
    public static function lockFor(string $address): string
    {
        return 'sign-in:address:' . $address;
    }
}
