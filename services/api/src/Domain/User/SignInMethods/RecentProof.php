<?php

declare(strict_types=1);

namespace App\Domain\User\SignInMethods;

use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Provider\ProviderClaims;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SecondFactorCheck;
use App\Entity\SignInProof;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use App\Repository\SignInProofRepository;
use App\Repository\TwoFactorFactorRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Throwable;

/** Signing in again before changing how one signs in, as OWASP ASVS 3.7.1 asks: proved for five minutes. */
final readonly class RecentProof
{
    private const int TOKEN_BYTES = 32;

    public function __construct(
        private PasswordResolver $passwordResolver,
        private SecondFactorCheck $secondFactorCheck,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private SignInProofRepository $signInProofRepository,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $passwordChangeAccountLimiter,
    ) {
    }

    /**
     * The password or a linked provider's sign-in, then the two-factor code when it is on.
     *
     * @param array{0: IdentityProvider, 1: ProviderClaims}|null $provider
     *
     * @return array{0: string, 1: DateTimeImmutable} the proof this client sends with the change, and when it lapses
     */
    public function prove(
        User $user,
        #[SensitiveParameter]
        ?string $password,
        ?array $provider,
        #[SensitiveParameter]
        ?string $code,
    ): array {
        if (null !== $provider) {
            $this->passProvider($user, ...$provider);
        } elseif (null !== $password && null !== $user->getPassword()) {
            $this->passPassword($user, $password);
        } else {
            throw ApiException::validation([[
                'propertyPath' => null === $user->getPassword() ? 'provider' : 'password',
                'message' => 'Enter your password, or confirm with Google or Apple.',
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $factor = $this->twoFactorFactorRepository->findActiveFor($user);

        if (null !== $factor) {
            if (null === $code || '' === Str\trim($code)) {
                throw new ApiException(ErrorCode::TwoFactorRequired, 'Enter a code from your app, or a recovery code.');
            }

            $this->secondFactorCheck->passEither($factor, $code);
        }

        return $this->issue($user);
    }

    /** Refused unless this client proved it within the five minutes; it may be used for several changes in that time. */
    public function require(User $user, #[SensitiveParameter] ?string $proof): void
    {
        $held = null === $proof || '' === $proof ? null : $this->signInProofRepository->findOneByHash(TokenIssuer::hash($proof));

        if (null === $held || !$held->standsFor($user, $this->clock->now())) {
            throw new ApiException(ErrorCode::ProofRequired, 'Confirm it is you first.');
        }
    }

    /** Under the account's lock from peek to spend, on the budget PasswordChange spends: the same guess either way. */
    private function passPassword(User $user, #[SensitiveParameter] string $password): void
    {
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $limit = $this->passwordChangeAccountLimiter->create($user->getId()->toRfc4122());
            $peek = $limit->consume(0);

            if (0 === $peek->getRemainingTokens()) {
                throw ApiException::tooManyAttempts('Too many tries.', $peek->getRetryAfter());
            }

            if (!$this->passwordResolver->verify($user, $password)) {
                $limit->consume();

                throw new ApiException(ErrorCode::InvalidCredentials, 'That is not your password.');
            }

            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }
    }

    private function passProvider(User $user, IdentityProvider $provider, ProviderClaims $claims): void
    {
        $identity = $this->providerIdentityRepository->findOneBySubject($provider, $claims->subject);

        if (null === $identity || !$identity->getUser()->getId()->equals($user->getId())) {
            throw new ApiException(ErrorCode::InvalidCredentials, 'That account is not linked to this Soirely account.');
        }

        // A token a provider SDK restored from an hour ago proves nobody is here now.
        $since = $claims->authenticatedAt;
        if (null === $since || $since < $this->clock->now()->modify('-' . SignInProof::MINUTES . ' minutes')) {
            throw new ApiException(ErrorCode::InvalidCredentials, 'Sign in again to confirm it is you.');
        }
    }

    /** @return array{0: string, 1: DateTimeImmutable} */
    private function issue(User $user): array
    {
        $now = $this->clock->now();
        $this->entityManager
            ->createQuery('DELETE FROM ' . SignInProof::class . ' p WHERE p.user = :user AND p.expiresAt <= :now')
            ->setParameter('user', $user)
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->execute();

        $plain = \bin2hex(SecureRandom\bytes(self::TOKEN_BYTES));
        $proof = new SignInProof($user, TokenIssuer::hash($plain), $now);
        $this->entityManager->persist($proof);
        $this->entityManager->flush();

        return [$plain, $proof->getExpiresAt()];
    }
}
