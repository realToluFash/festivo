<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Audit\Auditor;
use App\Domain\Organisation\Interfaces\OrganisationIdTokenInterface;
use App\Domain\Organisation\SingleSignOn\Model\SingleSignOnStart;
use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SignInGate;
use App\Entity\Organisation;
use App\Entity\SsoAttempt;
use App\Entity\SsoHandoff;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\SsoProtocol;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Repository\SsoAttemptRepository;
use App\Repository\SsoHandoffRepository;
use App\Repository\SsoProviderRepository;
use App\Repository\UserRepository;
use DateInterval;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Signing in through an organisation's OpenID Connect provider (sc-610): start, the provider's answer, then the client's one-time handle. */
final readonly class SingleSignIn
{
    public const string FAILED = 'sso.sign_in_failed';

    private const string ATTEMPT_LIFETIME = 'PT10M';

    private const string HANDLE_LIFETIME = 'PT60S';

    public function __construct(
        private OidcExchange $oidcExchange,
        private SingleSignOnSettings $settings,
        #[SensitiveParameter]
        private OrganisationIdTokenInterface $organisationIdToken,
        private EmailDomainRepository $emailDomainRepository,
        private SsoProviderRepository $ssoProviderRepository,
        private SsoAttemptRepository $ssoAttemptRepository,
        private SsoHandoffRepository $ssoHandoffRepository,
        private UserRepository $userRepository,
        private SignInGate $signInGate,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** The same answer for every address at a domain, account or not (sc-55). */
    public function start(string $email, string $clientChallenge): SingleSignOnStart
    {
        $domain = Str\lowercase(Str\after_last(Str\trim($email), '@') ?? '');
        $organisation = $this->emailDomainRepository->findProvedOf($domain)?->getOrganisation();
        $provider = null === $organisation ? null : $this->ssoProviderRepository->findLive($organisation);

        // SAML sign-in is not built yet.
        if (null === $organisation || null === $provider || SsoProtocol::Oidc !== $provider->getProtocol() || '' === $clientChallenge || Str\length($clientChallenge) > 128) {
            throw ApiException::notFound('sso.not_set_up');
        }

        $state = OidcExchange::random();
        $nonce = OidcExchange::random();
        $verifier = OidcExchange::random();
        $this->entityManager->persist(new SsoAttempt($provider, null, TokenIssuer::hash($state), $nonce, $verifier, $this->clock->now()->add(new DateInterval(self::ATTEMPT_LIFETIME)), $clientChallenge));
        $this->entityManager->flush();

        return new SingleSignOnStart($this->oidcExchange->authorizationUrl($provider, $state, $nonce, $verifier), $organisation->getName(), $provider->getName());
    }

    /** The one-time handle for the client, or null when the sign-in failed, which is audited. */
    public function receive(SsoAttempt $attempt, #[SensitiveParameter] ?string $code, ?string $providerSaid): ?string
    {
        $provider = $attempt->getProvider();
        $organisation = $provider->getOrganisation();
        $clientChallenge = $attempt->getClientChallenge();

        if (null === $clientChallenge || !$this->ssoAttemptRepository->claim($attempt)) {
            return null;
        }

        if (!$attempt->isOpenAt($this->clock->now())) {
            return $this->failed($organisation, 'expired');
        }

        if (null !== $providerSaid || null === $code) {
            return $this->failed($organisation, $providerSaid ?? 'no_code');
        }

        $idToken = $this->oidcExchange->redeem($provider, $code, $attempt->getCodeVerifier())['id_token'] ?? null;
        $answer = null === $idToken ? null : $this->organisationIdToken->read($provider, $idToken, $attempt->getNonce());

        if (null === $answer) {
            return $this->failed($organisation, null === $idToken ? 'no_token' : 'unchecked');
        }

        $email = Str\lowercase($answer->email ?? '');

        // Only the organisation's own domains: its provider must never sign anybody else's account in.
        if (!Iter\contains($this->settings->domains($organisation), Str\after_last($email, '@') ?? '')) {
            return $this->failed($organisation, 'other_domain');
        }

        $user = $this->userRepository->findOneByPrimaryEmailAddress($email);

        // A first sign-in is not built yet; an unverified address is nobody's.
        if (null === $user || true !== $user->getPrimaryEmailAddress()?->isVerified()) {
            return $this->failed($organisation, 'no_account');
        }

        $handle = OidcExchange::random();
        $this->entityManager->persist(new SsoHandoff($provider, $user, TokenIssuer::hash($handle), $clientChallenge, $this->clock->now()->add(new DateInterval(self::HANDLE_LIFETIME))));
        $this->entityManager->flush();

        return $handle;
    }

    /** @return array{User, IssuedTokens|IssuedChallenge} once, within the minute, with the verifier that started it */
    public function exchange(#[SensitiveParameter] string $handle, #[SensitiveParameter] string $clientVerifier, Request $request): array
    {
        $handoff = '' === $handle ? null : $this->ssoHandoffRepository->findOneBy(['handleHash' => TokenIssuer::hash($handle)]);

        if (
            null === $handoff
            || !$handoff->isOpenAt($this->clock->now())
            || !\hash_equals($handoff->getClientChallenge(), OidcExchange::challengeOf($clientVerifier))
            || !$this->ssoHandoffRepository->claim($handoff)
        ) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'provider.unchecked');
        }

        $user = $handoff->getUser();

        return [$user, $this->signInGate->admit($user, $request, bySingleSignOn: true)];
    }

    private function failed(Organisation $organisation, string $why): null
    {
        $this->auditor->record(self::FAILED, SingleSignOnSettings::SUBJECT, $organisation->getId(), changes: ['said' => [null, Str\truncate($why, 0, 500)]]);
        $this->entityManager->flush();

        return null;
    }
}
