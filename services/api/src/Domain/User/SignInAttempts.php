<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\SignInResult;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Throwable;

/** Peek, check, spend as one step per address (sc-838), under an advisory lock: the address may have no row. */
// Never per IP: guests on one venue's Wi-Fi must not queue on each other, so 30 per IP may overshoot in flight.
final readonly class SignInAttempts
{
    public function __construct(
        private UserAuthenticator $userAuthenticator,
        private EntityManagerInterface $entityManager,
        private RateLimiterFactoryInterface $signInIpLimiter,
        private RateLimiterFactoryInterface $signInAccountLimiter,
    ) {
    }

    public function signIn(string $email, #[SensitiveParameter] string $password, ?Request $request = null): SignInResult
    {
        $address = EmailAddressNormaliser::normalise($email);
        $ip = $request?->getClientIp() ?? '';
        $limits = [$this->signInAccountLimiter->create($address), $this->signInIpLimiter->create($ip)];
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->getConnection()->executeStatement('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', ['key' => self::lockFor($address)]);
            self::refuseIfSpent($limits);
            $result = $this->checked($email, $password, $request, $limits);
            $connection->commit();

            return $result;
        } catch (Throwable $e) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            throw $e;
        }
    }

    /** @param list<LimiterInterface> $limits */
    private function checked(string $email, #[SensitiveParameter] string $password, ?Request $request, array $limits): SignInResult
    {
        try {
            return $this->userAuthenticator->signIn($email, $password, $request);
        } catch (ApiException $e) {
            if (ErrorCode::InvalidCredentials === $e->errorCode) {
                foreach ($limits as $limit) {
                    $limit->consume();
                }
            }

            throw $e;
        }
    }

    /** @param list<LimiterInterface> $limits peeked, not spent: only a refused password costs anything */
    private static function refuseIfSpent(array $limits): void
    {
        foreach ($limits as $limit) {
            $peek = $limit->consume(0);

            if ($peek->getRemainingTokens() <= 0) {
                throw ApiException::tooManyAttempts('Too many sign-in attempts.', $peek->getRetryAfter());
            }
        }
    }

    /** The advisory lock's key for an address, held until the transaction ends. */
    public static function lockFor(string $address): string
    {
        return 'sign-in:address:' . $address;
    }
}
