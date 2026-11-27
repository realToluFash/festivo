<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Audit\Auditor;
use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\Organisation\SingleSignOn\Model\SamlMetadata;
use App\Domain\User\TwoFactor\SecretBox;
use App\Entity\Organisation;
use App\Entity\SsoProvider;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\SsoProtocol;
use App\Enum\SsoStanding;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Repository\SsoProviderRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Regex;
use Psl\Str;
use Psr\Clock\ClockInterface;

/** Settings › Sign-in rules › Single sign-on (sc-610): saving switches nothing on, a test that worked comes before the switch, and the provider people sign in through stays until its replacement is switched on. */
final readonly class SingleSignOnSettings
{
    public const string SUBJECT = 'Organisation';
    public const string SAVED = 'sso.saved';
    public const string CHANGED = 'sso.changed';
    public const string TESTED = 'sso.tested';
    public const string TEST_FAILED = 'sso.test_failed';
    public const string SWITCHED_ON = 'sso.switched_on';
    public const string SWITCHED_OFF = 'sso.switched_off';
    public const string REQUIRED_ON = 'sso.required_on';
    public const string REQUIRED_OFF = 'sso.required_off';
    public const string REMOVED = 'sso.removed';

    public function __construct(
        private SsoProviderRepository $ssoProviderRepository,
        private EmailDomainRepository $emailDomainRepository,
        private ProviderDocumentsInterface $providerDocuments,
        private SamlMetadataReader $samlMetadataReader,
        private OidcDiscovery $oidcDiscovery,
        private SecretBox $secretBox,
        private OwnerCheck $ownerCheck,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function current(Organisation $organisation): ?SsoProvider
    {
        return $this->ssoProviderRepository->findStanding($organisation, SsoStanding::Current);
    }

    public function staying(Organisation $organisation): ?SsoProvider
    {
        return $this->ssoProviderRepository->findStanding($organisation, SsoStanding::Staying);
    }

    public function live(Organisation $organisation): ?SsoProvider
    {
        return $this->ssoProviderRepository->findLive($organisation);
    }

    /**
     * @param array{protocol: string, name: string, metadataUrl?: ?string, metadataXml?: ?string, metadataFileName?: ?string, issuer?: ?string, clientId?: ?string, clientSecret?: ?string} $input
     */
    public function save(Organisation $organisation, User $by, array $input): SsoProvider
    {
        $this->requireOwner($organisation, $by);
        $this->requireProvedDomain($organisation);

        $protocol = SsoProtocol::tryFrom($input['protocol']) ?? throw ApiException::validation([['propertyPath' => 'protocol', 'message' => 'sso.protocol_unknown', 'code' => 'sso_protocol_unknown']]);
        $name = Str\trim($input['name']);
        $violations = [];

        if ('' === $name) {
            $violations[] = ['propertyPath' => 'name', 'message' => 'sso.name_blank', 'code' => 'sso_name_blank'];
        } elseif (Str\length($name) > SsoProvider::NAME_MAX) {
            $violations[] = ['propertyPath' => 'name', 'message' => 'sso.name_long', 'code' => 'sso_name_long'];
        }

        $provider = new SsoProvider($organisation, $protocol, $name, $this->clock->now());
        $violations = [...$violations, ...match ($protocol) {
            SsoProtocol::Saml => $this->readSaml($provider, $input),
            SsoProtocol::Oidc => $this->readOidc($provider, $input),
        }];

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $this->entityManager->wrapInTransaction(function () use ($organisation, $by, $provider): void {
            $this->lock($organisation);
            $current = $this->current($organisation);
            $staying = $this->staying($organisation);

            if (true === $current?->isOn()) {
                if (null !== $staying) {
                    $this->entityManager->remove($staying);
                }

                $current->setStanding(SsoStanding::Staying);
            } elseif (null !== $current) {
                $this->entityManager->remove($current);
            }

            $this->entityManager->flush();
            $this->entityManager->persist($provider);
            $this->record(null === $current ? self::SAVED : self::CHANGED, $organisation, $by, [
                'provider' => [$current?->getName(), $provider->getName()],
                'protocol' => [$current?->getProtocol()->value, $provider->getProtocol()->value],
            ]);
            $this->entityManager->flush();
        });

        return $provider;
    }

    /** Refused `sso_untested` until a test has worked; switching on retires the provider that stayed. */
    public function switchOn(Organisation $organisation, User $by): void
    {
        $this->requireOwner($organisation, $by);
        $this->requireProvedDomain($organisation);
        $current = $this->current($organisation) ?? throw ApiException::notFound('sso.not_set_up');

        if ($current->isOn()) {
            return;
        }

        if (!$current->isTested()) {
            throw new ApiException(ErrorCode::SsoUntested, 'sso.untested');
        }

        $staying = $this->staying($organisation);

        if (null !== $staying) {
            $this->entityManager->remove($staying);
        }

        $current->setSwitchedOnAt($this->clock->now());
        $this->record(self::SWITCHED_ON, $organisation, $by, ['sso' => [false, true], 'provider' => [$staying?->getName(), $current->getName()]]);
        $this->entityManager->flush();
    }

    /** Refused `sso_required_on` while required sign-on is on. */
    public function switchOff(Organisation $organisation, User $by): void
    {
        $this->requireOwner($organisation, $by);
        $current = $this->current($organisation) ?? throw ApiException::notFound('sso.not_set_up');

        if (!$current->isOn()) {
            return;
        }

        $this->refuseWhileRequired($organisation, 'sso.off_required');
        $current->setSwitchedOnAt(null);
        $this->record(self::SWITCHED_OFF, $organisation, $by, ['sso' => [true, false]]);
        $this->entityManager->flush();
    }

    public function require(Organisation $organisation, User $by): void
    {
        $this->requireOwner($organisation, $by);
        $this->requireProvedDomain($organisation);

        if (null === $this->live($organisation)) {
            throw new ApiException(ErrorCode::SsoNotOn, 'sso.not_on');
        }

        if (null !== $organisation->getSsoRequiredSince()) {
            return;
        }

        $organisation->setSsoRequiredSince($this->clock->now());
        $this->record(self::REQUIRED_ON, $organisation, $by, ['required' => [false, true]]);
        $this->entityManager->flush();
    }

    public function unrequire(Organisation $organisation, User $by): void
    {
        $this->requireOwner($organisation, $by);

        if (null === $organisation->getSsoRequiredSince()) {
            return;
        }

        $organisation->setSsoRequiredSince(null);
        $this->record(self::REQUIRED_OFF, $organisation, $by, ['required' => [true, false]]);
        $this->entityManager->flush();
    }

    /** Refused `sso_required_on` while required sign-on is on; removes the provider waiting and the one that stayed. */
    public function remove(Organisation $organisation, User $by): void
    {
        $this->requireOwner($organisation, $by);
        $this->refuseWhileRequired($organisation, 'sso.remove_required');
        $providers = $this->ssoProviderRepository->findForOrganisation($organisation);

        if ([] === $providers) {
            return;
        }

        $current = $this->current($organisation);
        $this->record(self::REMOVED, $organisation, $by, ['provider' => [$current?->getName() ?? $this->staying($organisation)?->getName(), null]]);

        foreach ($providers as $provider) {
            $this->entityManager->remove($provider);
        }

        $this->entityManager->flush();
    }

    public function testWorked(SsoProvider $provider, User $owner, string $email, string $name): void
    {
        $provider->setTestedAt($this->clock->now());
        $provider->setTestedEmail($email);
        $provider->setTestedName($name);
        $provider->setTestFailure(null);
        $this->record(self::TESTED, $provider->getOrganisation(), $owner, ['test' => [null, 'worked'], 'email' => [null, $email]]);
        $this->entityManager->flush();
    }

    public function testFailed(SsoProvider $provider, User $owner, string $said): void
    {
        $provider->setTestedAt($this->clock->now());
        $provider->setTestFailure(Str\truncate($said, 0, 500));
        $this->record(self::TEST_FAILED, $provider->getOrganisation(), $owner, ['test' => [null, 'failed'], 'said' => [null, $provider->getTestFailure()]]);
        $this->entityManager->flush();
    }

    public function openSecret(SsoProvider $provider): ?string
    {
        $sealed = $provider->getOidcClientSecret();

        return null === $sealed ? null : $this->secretBox->open($sealed);
    }

    /** @return list<string> the organisation's proved domains, which single sign-on covers */
    public function domains(Organisation $organisation): array
    {
        $domains = [];

        foreach ($this->emailDomainRepository->findProvedIn($organisation) as $proved) {
            $domains[] = $proved->getDomain();
        }

        return $domains;
    }

    /**
     * @param array{protocol: string, name: string, metadataUrl?: ?string, metadataXml?: ?string, metadataFileName?: ?string, issuer?: ?string, clientId?: ?string, clientSecret?: ?string} $input
     *
     * @return list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}>
     */
    private function readSaml(SsoProvider $provider, array $input): array
    {
        $url = Str\trim($input['metadataUrl'] ?? '');
        $xml = $input['metadataXml'] ?? '';

        if ('' === $url && '' === $xml) {
            return [['propertyPath' => 'metadata', 'message' => 'sso.metadata_blank', 'code' => 'sso_metadata_blank']];
        }

        if ('' !== $url && !self::isHttps($url)) {
            return [['propertyPath' => 'metadata', 'message' => 'sso.metadata_shape', 'code' => 'sso_metadata_shape']];
        }

        $read = '' !== $url ? $this->providerDocuments->fetch($url) : $xml;
        $metadata = null === $read ? null : $this->samlMetadataReader->read($read);

        if (!$metadata instanceof SamlMetadata) {
            return [['propertyPath' => 'metadata', 'message' => 'sso.metadata_unreadable', 'code' => 'sso_metadata_unreadable']];
        }

        $provider->setMetadataUrl('' !== $url ? $url : null);
        $provider->setMetadataFileName('' !== $url ? null : Str\truncate(Str\trim($input['metadataFileName'] ?? ''), 0, 255));
        $provider->setSamlEntityId($metadata->entityId);
        $provider->setSamlSignOnUrl($metadata->signOnUrl);
        $provider->setSamlCertificates($metadata->certificates);

        return [];
    }

    /**
     * @param array{protocol: string, name: string, metadataUrl?: ?string, metadataXml?: ?string, metadataFileName?: ?string, issuer?: ?string, clientId?: ?string, clientSecret?: ?string} $input
     *
     * @return list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}>
     */
    private function readOidc(SsoProvider $provider, array $input): array
    {
        $issuer = OidcDiscovery::issuerOf($input['issuer'] ?? '');
        $clientId = Str\trim($input['clientId'] ?? '');
        $secret = $input['clientSecret'] ?? '';
        $violations = [];

        if ('' === $issuer) {
            $violations[] = ['propertyPath' => 'issuer', 'message' => 'sso.issuer_blank', 'code' => 'sso_issuer_blank'];
        } elseif (!self::isHttps($issuer)) {
            $violations[] = ['propertyPath' => 'issuer', 'message' => 'sso.issuer_shape', 'code' => 'sso_issuer_shape'];
        }

        if ('' === $clientId) {
            $violations[] = ['propertyPath' => 'clientId', 'message' => 'sso.client_id_blank', 'code' => 'sso_client_id_blank'];
        }

        if ('' === $secret) {
            $violations[] = ['propertyPath' => 'clientSecret', 'message' => 'sso.client_secret_blank', 'code' => 'sso_client_secret_blank'];
        }

        if ([] !== $violations) {
            return $violations;
        }

        $endpoints = $this->oidcDiscovery->discover($issuer);

        if (null === $endpoints) {
            return [['propertyPath' => 'issuer', 'message' => 'sso.discovery_failed', 'code' => 'sso_discovery_failed', 'parameters' => ['{url}' => OidcDiscovery::documentAt($issuer)]]];
        }

        $provider->setOidcIssuer($endpoints->issuer);
        $provider->setOidcClientId(Str\truncate($clientId, 0, 255));
        $provider->setOidcClientSecret($this->secretBox->seal($secret));
        $provider->setOidcAuthorizationEndpoint($endpoints->authorizationEndpoint);
        $provider->setOidcTokenEndpoint($endpoints->tokenEndpoint);
        $provider->setOidcJwksUri($endpoints->jwksUri);

        return [];
    }

    private static function isHttps(string $url): bool
    {
        return Regex\matches($url, '/^https:\/\/\S+$/i');
    }

    private function requireOwner(Organisation $organisation, User $by): void
    {
        $this->ownerCheck->require($organisation, $by, 'sso.owner_only');
    }

    private function requireProvedDomain(Organisation $organisation): void
    {
        if ([] === $this->domains($organisation)) {
            throw new ApiException(ErrorCode::SsoDomainUnproved, 'sso.domain_unproved');
        }
    }

    private function refuseWhileRequired(Organisation $organisation, string $message): void
    {
        if (null !== $organisation->getSsoRequiredSince()) {
            throw new ApiException(ErrorCode::SsoRequiredOn, $message);
        }
    }

    private function lock(Organisation $organisation): void
    {
        $this->entityManager->getConnection()->executeStatement('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', ['key' => 'sso:' . $organisation->getId()->toRfc4122()]);
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, Organisation $organisation, User $by, array $changes): void
    {
        $this->auditor->record($action, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
