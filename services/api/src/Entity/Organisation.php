<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'organisations')]
class Organisation
{
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

    public function __construct(
        string $name,
        string $countryCode,
        string $currency,
        string $timezone,
        string $contactAddress,
    ) {
        $this->id = Uuid::v7();
        $this->name = $name;
        $this->countryCode = $countryCode;
        $this->currency = $currency;
        $this->timezone = $timezone;
        $this->contactAddress = $contactAddress;
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
}
