<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\Interfaces\OrganisationIdTokenInterface;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\TokenIssuer;
use App\Entity\Organisation;
use App\Entity\SsoAttempt;
use App\Entity\User;
use App\Enum\SsoProtocol;
use App\Http\Exception\ApiException;
use App\Repository\SsoAttemptRepository;
use DateInterval;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Test sign-on (sc-610): the Owner is sent to the provider with PKCE, and what comes back is recorded on the saved provider. It signs nobody in. */
final readonly class TestSignOn
{
    private const string LIFETIME = 'PT10M';

    public function __construct(
        private SingleSignOnSettings $settings,
        private OidcExchange $oidcExchange,
        #[SensitiveParameter]
        private OrganisationIdTokenInterface $organisationIdToken,
        private SsoAttemptRepository $ssoAttemptRepository,
        private OwnerCheck $ownerCheck,
        private TranslatorInterface $translator,
        private UserMailer $userMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** @return string the address at the provider to open */
    public function start(Organisation $organisation, User $by): string
    {
        $this->ownerCheck->require($organisation, $by, 'sso.owner_only');
        $provider = $this->settings->current($organisation);
        $endpoint = $provider?->getOidcAuthorizationEndpoint();

        // A SAML provider has no test yet.
        if (null === $provider || SsoProtocol::Oidc !== $provider->getProtocol() || null === $endpoint) {
            throw ApiException::notFound('sso.not_set_up');
        }

        $state = OidcExchange::random();
        $nonce = OidcExchange::random();
        $verifier = OidcExchange::random();
        $this->entityManager->persist(new SsoAttempt($provider, $by, TokenIssuer::hash($state), $nonce, $verifier, $this->clock->now()->add(new DateInterval(self::LIFETIME))));
        $this->entityManager->flush();

        return $this->oidcExchange->authorizationUrl($provider, $state, $nonce, $verifier);
    }

    /** An unknown, used or expired state, or a starter no longer an Owner, records nothing. */
    public function answer(Organisation $organisation, string $state, #[SensitiveParameter] ?string $code, ?string $providerSaid): void
    {
        $attempt = '' === $state ? null : $this->ssoAttemptRepository->findOneBy(['stateHash' => TokenIssuer::hash($state)]);
        $owner = $attempt?->getStartedBy();

        if (null === $attempt || null === $owner || !$attempt->getProvider()->getOrganisation()->getId()->equals($organisation->getId()) || !$this->ssoAttemptRepository->claim($attempt)) {
            return;
        }

        if (!$attempt->isOpenAt($this->clock->now()) || !$this->ownerCheck->holds($organisation, $owner)) {
            return;
        }

        $provider = $attempt->getProvider();

        if (null !== $providerSaid || null === $code) {
            $this->settings->testFailed($provider, $owner, $providerSaid ?? $this->ours('sso.test_no_code', $owner), null !== $providerSaid);

            return;
        }

        $this->redeem($attempt, $owner, $code);
    }

    private function redeem(SsoAttempt $attempt, User $owner, #[SensitiveParameter] string $code): void
    {
        $provider = $attempt->getProvider();
        $reply = $this->oidcExchange->redeem($provider, $code, $attempt->getCodeVerifier());
        $idToken = $reply['id_token'] ?? null;

        if (null === $idToken) {
            $said = $reply['error_description'] ?? $reply['error'] ?? null;
            $this->settings->testFailed($provider, $owner, $said ?? $this->ours('sso.test_no_token', $owner), null !== $said);

            return;
        }

        $answer = $this->organisationIdToken->read($provider, $idToken, $attempt->getNonce());

        if (null === $answer) {
            $this->settings->testFailed($provider, $owner, $this->ours('sso.test_unchecked', $owner), false);

            return;
        }

        $email = Str\lowercase($answer->email ?? '');

        if (!Iter\contains($this->settings->domains($provider->getOrganisation()), Str\after_last($email, '@') ?? '')) {
            $this->settings->testFailed($provider, $owner, $this->ours('sso.test_other_domain', $owner), false);

            return;
        }

        $this->settings->testWorked($provider, $owner, Str\truncate($email, 0, 254), Str\truncate($answer->name, 0, 255));
    }

    private function ours(string $key, User $owner): string
    {
        return $this->translator->trans($key, locale: $this->userMailer->localeFor($owner));
    }
}
