<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** The payer of one or more subscriptions. Card data never reaches it: the provider keeps that, behind `providerCustomerRef` (sc-3933). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'billing_accounts')]
class BillingAccount
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $contactEmail;

    /** ISO 4217. */
    #[ORM\Column(type: Types::STRING, length: 3)]
    private string $currency;

    /** ISO 3166-1 alpha-2. */
    #[ORM\Column(type: Types::STRING, length: 2)]
    private string $countryCode;

    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $taxId = null;

    /** Credits pool here, across every organisation the account pays for (sc-3932). */
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    private int $creditBalance = 0;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $providerCustomerRef = null;

    public function __construct(string $contactEmail, string $currency, string $countryCode)
    {
        $this->id = Uuid::v7();
        $this->contactEmail = $contactEmail;
        $this->currency = $currency;
        $this->countryCode = $countryCode;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getContactEmail(): string
    {
        return $this->contactEmail;
    }

    public function setContactEmail(string $contactEmail): void
    {
        $this->contactEmail = $contactEmail;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    public function getTaxId(): ?string
    {
        return $this->taxId;
    }

    public function setTaxId(?string $taxId): void
    {
        $this->taxId = $taxId;
    }

    public function getCreditBalance(): int
    {
        return $this->creditBalance;
    }

    public function setCreditBalance(int $creditBalance): void
    {
        $this->creditBalance = $creditBalance;
    }

    public function getProviderCustomerRef(): ?string
    {
        return $this->providerCustomerRef;
    }

    public function setProviderCustomerRef(?string $providerCustomerRef): void
    {
        $this->providerCustomerRef = $providerCustomerRef;
    }
}
