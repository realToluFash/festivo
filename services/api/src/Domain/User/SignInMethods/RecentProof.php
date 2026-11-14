<?php

declare(strict_types=1);

namespace App\Domain\User\SignInMethods;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Attempts\WrongSecret;
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
use Symfony\Contracts\Translation\TranslatorInterface;

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
        private GuardedAttempt $guardedAttempt,
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * The password or a linked provider's sign-in, then the two-factor code when it is on. A refused code carries
     * `pendingProof`, which stands in for the first factor on the next try: a provider's sign-in is single-use.
     * Asked for the code straight after a provider's sign-in, it carries `providerEmail` too, the address that
     * sign-in vouched for, as the provider wrote it.
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
        #[SensitiveParameter]
        ?string $pendingProof = null,
    ): array {
        $pending = null === $pendingProof || '' === $pendingProof ? null : $this->awaitingCode($user, $pendingProof);

        $provedAt = null === $pending ? $this->passFirstFactor($user, $password, $provider) : $pending[1]->provedAt();
        $vouched = null === $pending && null !== $provider && $provider[1]->emailVerified ? $provider[1]->email : null;

        $factor = $this->twoFactorFactorRepository->findActiveFor($user);

        if (null !== $factor) {
            [$plain, $held] = $pending ?? $this->issue($user, $provedAt, awaitingCode: true);

            try {
                if (null === $code || '' === Str\trim($code)) {
                    throw new ApiException(ErrorCode::TwoFactorRequired, 'validation.code_app_or_recovery_required');
                }

                $this->secondFactorCheck->passEither($factor, $code);
            } catch (ApiException $refusal) {
                $members = [...$refusal->members, 'pendingProof' => $plain];
                if (ErrorCode::TwoFactorRequired === $refusal->errorCode && null !== $vouched) {
                    $members['providerEmail'] = $vouched;
                }

                throw new ApiException(
                    $refusal->errorCode,
                    $refusal->getMessage(),
                    $refusal->violations,
                    $refusal,
                    $refusal->headers,
                    $members,
                    $refusal->parameters,
                );
            }

            $this->entityManager->remove($held);
        }

        [$plain, $proof] = $this->issue($user, $provedAt);

        return [$plain, $proof->getExpiresAt()];
    }

    /** Refused unless this client proved it within the five minutes; it may be used for several changes in that time. */
    public function require(User $user, #[SensitiveParameter] ?string $proof): void
    {
        $held = null === $proof || '' === $proof ? null : $this->signInProofRepository->findOneByHash(TokenIssuer::hash($proof));

        if (null === $held || !$held->standsFor($user, $this->clock->now())) {
            throw $this->proofRequired();
        }
    }

    /**
     * @param array{0: IdentityProvider, 1: ProviderClaims}|null $provider
     *
     * @return DateTimeImmutable when it passed, which the five minutes count from
     */
    private function passFirstFactor(User $user, #[SensitiveParameter] ?string $password, ?array $provider): DateTimeImmutable
    {
        if (null !== $provider) {
            return $this->passProvider($user, ...$provider);
        }

        if (null !== $password && null !== $user->getPassword()) {
            $this->passPassword($user, $password);

            return $this->clock->now();
        }

        throw ApiException::validation([[
            'propertyPath' => null === $user->getPassword() ? 'provider' : 'password',
            'message' => 'proof.password_or_provider',
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }

    /** Through the one guarded attempt, on the budget PasswordChange spends: the same guess either way. */
    private function passPassword(User $user, #[SensitiveParameter] string $password): void
    {
        $this->guardedAttempt->attempt(
            fn () => $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE),
            fn (): array => [$this->passwordChangeAccountLimiter->create($user->getId()->toRfc4122())],
            fn (): ?WrongSecret => $this->passwordResolver->verify($user, $password)
                ? null
                : new WrongSecret(new ApiException(ErrorCode::InvalidCredentials, 'proof.password_wrong')),
            'limits.tries',
        );
    }

    private function passProvider(User $user, IdentityProvider $provider, ProviderClaims $claims): DateTimeImmutable
    {
        $identity = $this->providerIdentityRepository->findOneBySubject($provider, $claims->subject);

        if (null === $identity || !$identity->getUser()->getId()->equals($user->getId())) {
            throw new ApiException(ErrorCode::InvalidCredentials, 'proof.provider_not_linked');
        }

        $since = $claims->authenticatedAt;
        if (null === $since || $since < $this->clock->now()->modify('-' . SignInProof::MINUTES . ' minutes')) {
            throw new ApiException(ErrorCode::InvalidCredentials, 'proof.sign_in_again');
        }

        return $since;
    }

    /** @return array{0: string, 1: SignInProof} */
    private function issue(User $user, DateTimeImmutable $provedAt, bool $awaitingCode = false): array
    {
        $now = $this->clock->now();
        $this->entityManager
            ->createQuery('DELETE FROM ' . SignInProof::class . ' p WHERE p.user = :user AND p.expiresAt <= :now')
            ->setParameter('user', $user)
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->execute();

        $plain = \bin2hex(SecureRandom\bytes(self::TOKEN_BYTES));
        $proof = new SignInProof($user, TokenIssuer::hash($plain), $provedAt, $awaitingCode);
        $this->entityManager->persist($proof);
        $this->entityManager->flush();

        return [$plain, $proof];
    }

    /** @return array{0: string, 1: SignInProof} */
    private function awaitingCode(User $user, #[SensitiveParameter] string $plain): ?array
    {
        $held = $this->signInProofRepository->findOneByHash(TokenIssuer::hash($plain));

        if (null === $held || !$held->awaitsCodeFor($user, $this->clock->now())) {
            throw $this->proofRequired();
        }

        return [$plain, $held];
    }

    /** The title says a proof is needed; the detail says which one (RFC 9457 §3.1.5). */
    private function proofRequired(): ApiException
    {
        return new ApiException(ErrorCode::ProofRequired, $this->translator->trans('proof.required', [
            '{minutes}' => (string) SignInProof::MINUTES,
        ]));
    }
}
