<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\PhoneCodeRoute;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One phone code's route, with no content: the monthly fallback rate per country is counted from these (sc-750). */
#[ORM\Entity]
#[ORM\Table(name: 'phone_code_deliveries')]
#[ORM\Index(name: 'idx_phone_code_delivery_country', columns: ['country_code', 'delivered_at'])]
class PhoneCodeDelivery
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $countryCode;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: PhoneCodeRoute::class)]
    private PhoneCodeRoute $route;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $deliveredAt;

    public function __construct(?string $countryCode, PhoneCodeRoute $route, DateTimeImmutable $at)
    {
        $this->id = Uuid::v7();
        $this->countryCode = $countryCode;
        $this->route = $route;
        $this->deliveredAt = $at;
    }

    public function getRoute(): PhoneCodeRoute
    {
        return $this->route;
    }

    public function getCountryCode(): ?string
    {
        return $this->countryCode;
    }
}
