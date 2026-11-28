<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One dish in an organisation's menu library (sc-3901): what a dish is. An event copies it, so nothing here changes what an event served. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'dishes')]
#[ORM\Index(name: 'idx_dish_organisation', columns: ['organisation_id'])]
class Dish
{
    use Timestampable;

    public const int NAME_MAXIMUM = 120;

    public const int DESCRIPTION_MAXIMUM = 300;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 480)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 1200, nullable: true)]
    private ?string $description;

    /** @var ?list<string> sc-3777's allergen codes in Annex II order; empty is "contains none of the 14", null is never stated */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $allergens;

    /** @var list<string> sc-3777's diet codes, in its order */
    #[ORM\Column(type: Types::JSON)]
    private array $diets;

    /** In the currency's ISO 4217 minor unit. */
    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $lastPriceMinor = null;

    #[ORM\Column(type: Types::STRING, length: 3, nullable: true)]
    private ?string $lastPriceCurrency = null;

    /** Set once an event copies it: from then on it is archived, never deleted. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $usedByEvent = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $archivedAt = null;

    /**
     * @param ?list<string> $allergens
     * @param list<string>  $diets
     */
    public function __construct(Organisation $organisation, string $name, ?string $description, ?array $allergens, array $diets)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->name = $name;
        $this->description = $description;
        $this->allergens = $allergens;
        $this->diets = $diets;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    /** @return ?list<string> */
    public function getAllergens(): ?array
    {
        return $this->allergens;
    }

    /** @param ?list<string> $allergens */
    public function setAllergens(?array $allergens): void
    {
        $this->allergens = $allergens;
    }

    /** @return list<string> */
    public function getDiets(): array
    {
        return $this->diets;
    }

    /** @param list<string> $diets */
    public function setDiets(array $diets): void
    {
        $this->diets = $diets;
    }

    public function getLastPriceMinor(): ?int
    {
        return null === $this->lastPriceMinor ? null : (int) $this->lastPriceMinor;
    }

    public function getLastPriceCurrency(): ?string
    {
        return $this->lastPriceCurrency;
    }

    public function setLastPrice(?int $minor, ?string $currency): void
    {
        $this->lastPriceMinor = null === $minor ? null : (string) $minor;
        $this->lastPriceCurrency = null === $minor ? null : $currency;
    }

    public function isUsedByEvent(): bool
    {
        return $this->usedByEvent;
    }

    public function setUsedByEvent(bool $usedByEvent): void
    {
        $this->usedByEvent = $usedByEvent;
    }

    public function getArchivedAt(): ?DateTimeImmutable
    {
        return $this->archivedAt;
    }

    public function setArchivedAt(?DateTimeImmutable $archivedAt): void
    {
        $this->archivedAt = $archivedAt;
    }
}
