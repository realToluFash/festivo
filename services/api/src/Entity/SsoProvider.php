<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\SsoProtocol;
use App\Enum\SsoStanding;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** An organisation's identity provider for single sign-on (sc-610): what the Owner typed, and what was read from the provider when it was saved. */
#[ORM\Entity]
#[ORM\Table(name: 'organisation_sso_providers')]
#[ORM\UniqueConstraint(name: 'uniq_sso_provider_standing', columns: ['organisation_id', 'standing'])]
class SsoProvider
{
    public const int NAME_MAX = 40;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: SsoStanding::class)]
    private SsoStanding $standing;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: SsoProtocol::class)]
    private SsoProtocol $protocol;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $name;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $savedAt;

    /** SAML: where the metadata was read from, or null when the Owner uploaded the file. */
    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $metadataUrl = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $metadataFileName = null;

    #[ORM\Column(type: Types::STRING, length: 1024, nullable: true)]
    private ?string $samlEntityId = null;

    /** The provider's HTTP-Redirect single sign-on service. */
    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $samlSignOnUrl = null;

    /** @var list<string> base64 DER, every signing certificate the metadata names */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $samlCertificates = [];

    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $oidcIssuer = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $oidcClientId = null;

    /** Sealed with the server's key: redeeming a code needs it back. */
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $oidcClientSecret = null;

    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $oidcAuthorizationEndpoint = null;

    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $oidcTokenEndpoint = null;

    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $oidcJwksUri = null;

    /** The last Test sign-on that worked, and who it signed in. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $testedAt = null;

    #[ORM\Column(type: Types::STRING, length: 254, nullable: true)]
    private ?string $testedEmail = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $testedName = null;

    /** The provider's own words from the last test that did not work; cleared by one that does. */
    #[ORM\Column(type: Types::STRING, length: 500, nullable: true)]
    private ?string $testFailure = null;

    /** False when the failure is a sentence of ours, from a check the provider's answer did not pass. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $testFailureFromProvider = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $switchedOnAt = null;

    public function __construct(Organisation $organisation, SsoProtocol $protocol, string $name, DateTimeImmutable $savedAt)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->standing = SsoStanding::Current;
        $this->protocol = $protocol;
        $this->name = $name;
        $this->savedAt = $savedAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getStanding(): SsoStanding
    {
        return $this->standing;
    }

    public function setStanding(SsoStanding $standing): void
    {
        $this->standing = $standing;
    }

    public function getProtocol(): SsoProtocol
    {
        return $this->protocol;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getSavedAt(): DateTimeImmutable
    {
        return $this->savedAt;
    }

    public function getMetadataUrl(): ?string
    {
        return $this->metadataUrl;
    }

    public function setMetadataUrl(?string $metadataUrl): void
    {
        $this->metadataUrl = $metadataUrl;
    }

    public function getMetadataFileName(): ?string
    {
        return $this->metadataFileName;
    }

    public function setMetadataFileName(?string $metadataFileName): void
    {
        $this->metadataFileName = $metadataFileName;
    }

    public function getSamlEntityId(): ?string
    {
        return $this->samlEntityId;
    }

    public function setSamlEntityId(?string $samlEntityId): void
    {
        $this->samlEntityId = $samlEntityId;
    }

    public function getSamlSignOnUrl(): ?string
    {
        return $this->samlSignOnUrl;
    }

    public function setSamlSignOnUrl(?string $samlSignOnUrl): void
    {
        $this->samlSignOnUrl = $samlSignOnUrl;
    }

    /** @return list<string> */
    public function getSamlCertificates(): array
    {
        return $this->samlCertificates;
    }

    /** @param list<string> $samlCertificates */
    public function setSamlCertificates(array $samlCertificates): void
    {
        $this->samlCertificates = $samlCertificates;
    }

    public function getOidcIssuer(): ?string
    {
        return $this->oidcIssuer;
    }

    public function setOidcIssuer(?string $oidcIssuer): void
    {
        $this->oidcIssuer = $oidcIssuer;
    }

    public function getOidcClientId(): ?string
    {
        return $this->oidcClientId;
    }

    public function setOidcClientId(?string $oidcClientId): void
    {
        $this->oidcClientId = $oidcClientId;
    }

    public function getOidcClientSecret(): ?string
    {
        return $this->oidcClientSecret;
    }

    public function setOidcClientSecret(#[SensitiveParameter] ?string $oidcClientSecret): void
    {
        $this->oidcClientSecret = $oidcClientSecret;
    }

    public function getOidcAuthorizationEndpoint(): ?string
    {
        return $this->oidcAuthorizationEndpoint;
    }

    public function setOidcAuthorizationEndpoint(?string $oidcAuthorizationEndpoint): void
    {
        $this->oidcAuthorizationEndpoint = $oidcAuthorizationEndpoint;
    }

    public function getOidcTokenEndpoint(): ?string
    {
        return $this->oidcTokenEndpoint;
    }

    public function setOidcTokenEndpoint(#[SensitiveParameter] ?string $oidcTokenEndpoint): void
    {
        $this->oidcTokenEndpoint = $oidcTokenEndpoint;
    }

    public function getOidcJwksUri(): ?string
    {
        return $this->oidcJwksUri;
    }

    public function setOidcJwksUri(?string $oidcJwksUri): void
    {
        $this->oidcJwksUri = $oidcJwksUri;
    }

    public function getTestedAt(): ?DateTimeImmutable
    {
        return $this->testedAt;
    }

    public function setTestedAt(?DateTimeImmutable $testedAt): void
    {
        $this->testedAt = $testedAt;
    }

    public function getTestedEmail(): ?string
    {
        return $this->testedEmail;
    }

    public function setTestedEmail(?string $testedEmail): void
    {
        $this->testedEmail = $testedEmail;
    }

    public function getTestedName(): ?string
    {
        return $this->testedName;
    }

    public function setTestedName(?string $testedName): void
    {
        $this->testedName = $testedName;
    }

    public function getTestFailure(): ?string
    {
        return $this->testFailure;
    }

    public function setTestFailure(?string $testFailure): void
    {
        $this->testFailure = $testFailure;
    }

    public function isTestFailureFromProvider(): bool
    {
        return $this->testFailureFromProvider;
    }

    public function setTestFailureFromProvider(bool $testFailureFromProvider): void
    {
        $this->testFailureFromProvider = $testFailureFromProvider;
    }

    public function getSwitchedOnAt(): ?DateTimeImmutable
    {
        return $this->switchedOnAt;
    }

    public function setSwitchedOnAt(?DateTimeImmutable $switchedOnAt): void
    {
        $this->switchedOnAt = $switchedOnAt;
    }

    public function isOn(): bool
    {
        return null !== $this->switchedOnAt;
    }

    public function isTested(): bool
    {
        return null !== $this->testedAt && null === $this->testFailure;
    }
}
