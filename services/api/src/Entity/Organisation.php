<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Interfaces\SoftDeletableInterface;
use App\Doctrine\Traits\SoftDeletable;
use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'organisations')]
#[ORM\Index(name: 'idx_organisation_deleted', columns: ['deleted_at'])]
#[ORM\UniqueConstraint(name: 'uniq_organisation_request_link_token', columns: ['request_link_token'])]
class Organisation implements SoftDeletableInterface
{
    use SoftDeletable;
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 2)]
    private string $countryCode;

    /** The default for every event, which may override it. */
    #[ORM\Column(type: Types::STRING, length: 3)]
    private string $currency;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $timezone;

    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $contactAddress;

    /** What a stranger's invitation is written in, there being no account to ask (sc-67): the founder's, at founding. */
    #[ORM\Column(type: Types::STRING, length: 5)]
    private string $locale;

    /** Password sign-in is off for members who have linked Google or Apple; the rest read but do not change (sc-69). */
    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $providerSignInOnly = false;

    /** Null is no limit. */
    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    private ?int $inactivityTimeoutDays = null;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $administratorsNeedTwoFactor = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $signInRulesChangedAt = null;

    /** When two-factor for everyone was switched on; null is not required (sc-609). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $twoFactorRequiredSince = null;

    /** The request link's token (sc-562); null is off. Turning it on, or replacing it, writes a new one. */
    #[ORM\Column(type: Types::STRING, length: 32, nullable: true)]
    private ?string $requestLinkToken = null;

    /** When the people who manage members were last emailed about requests to join (sc-392): at most once a day. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $joinRequestsNoticedAt = null;

    public function __construct(
        string $name,
        string $countryCode,
        string $currency,
        string $timezone,
        string $contactAddress,
        string $locale,
    ) {
        $this->id = Uuid::v7();
        $this->name = $name;
        $this->countryCode = $countryCode;
        $this->currency = $currency;
        $this->timezone = $timezone;
        $this->contactAddress = $contactAddress;
        $this->locale = $locale;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function getTimezone(): string
    {
        return $this->timezone;
    }

    public function setTimezone(string $timezone): void
    {
        $this->timezone = $timezone;
    }

    public function getContactAddress(): string
    {
        return $this->contactAddress;
    }

    public function setContactAddress(string $contactAddress): void
    {
        $this->contactAddress = $contactAddress;
    }

    public function getLocale(): string
    {
        return $this->locale;
    }

    public function setLocale(string $locale): void
    {
        $this->locale = $locale;
    }

    public function isProviderSignInOnly(): bool
    {
        return $this->providerSignInOnly;
    }

    public function setProviderSignInOnly(bool $providerSignInOnly): void
    {
        $this->providerSignInOnly = $providerSignInOnly;
    }

    public function getInactivityTimeoutDays(): ?int
    {
        return $this->inactivityTimeoutDays;
    }

    public function setInactivityTimeoutDays(?int $inactivityTimeoutDays): void
    {
        $this->inactivityTimeoutDays = $inactivityTimeoutDays;
    }

    public function isAdministratorsNeedTwoFactor(): bool
    {
        return $this->administratorsNeedTwoFactor;
    }

    public function setAdministratorsNeedTwoFactor(bool $administratorsNeedTwoFactor): void
    {
        $this->administratorsNeedTwoFactor = $administratorsNeedTwoFactor;
    }

    public function getSignInRulesChangedAt(): ?DateTimeImmutable
    {
        return $this->signInRulesChangedAt;
    }

    public function setSignInRulesChangedAt(?DateTimeImmutable $signInRulesChangedAt): void
    {
        $this->signInRulesChangedAt = $signInRulesChangedAt;
    }

    public function isTwoFactorRequired(): bool
    {
        return null !== $this->twoFactorRequiredSince;
    }

    public function getTwoFactorRequiredSince(): ?DateTimeImmutable
    {
        return $this->twoFactorRequiredSince;
    }

    public function setTwoFactorRequiredSince(?DateTimeImmutable $twoFactorRequiredSince): void
    {
        $this->twoFactorRequiredSince = $twoFactorRequiredSince;
    }

    public function getRequestLinkToken(): ?string
    {
        return $this->requestLinkToken;
    }

    public function setRequestLinkToken(#[SensitiveParameter] ?string $requestLinkToken): void
    {
        $this->requestLinkToken = $requestLinkToken;
    }

    public function getJoinRequestsNoticedAt(): ?DateTimeImmutable
    {
        return $this->joinRequestsNoticedAt;
    }

    public function setJoinRequestsNoticedAt(?DateTimeImmutable $joinRequestsNoticedAt): void
    {
        $this->joinRequestsNoticedAt = $joinRequestsNoticedAt;
    }
}
