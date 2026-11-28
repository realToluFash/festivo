<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One way a library dish comes (sc-3903): copied with the dish into each event that adds it, so editing it changes no event. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'dish_variants')]
#[ORM\Index(name: 'idx_dish_variant_order', columns: ['dish_id', 'position'])]
class DishVariant
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    public const int PER_DISH_MAXIMUM = 6;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Dish::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Dish $dish;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $forChildren;

    /** @var list<string> Annex II codes; empty is "contains none of the 14" */
    #[ORM\Column(type: Types::JSON)]
    private array $allergens;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $diets;

    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $lastPriceMinor = null;

    #[ORM\Column(type: Types::STRING, length: 3, nullable: true)]
    private ?string $lastPriceCurrency = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     */
    public function __construct(Dish $dish, string $name, bool $forChildren, array $allergens, array $diets, int $position)
    {
        $this->id = Uuid::v7();
        $this->dish = $dish;
        $this->name = $name;
        $this->forChildren = $forChildren;
        $this->allergens = $allergens;
        $this->diets = $diets;
        $this->position = $position;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getDish(): Dish
    {
        return $this->dish;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function isForChildren(): bool
    {
        return $this->forChildren;
    }

    /** @return list<string> */
    public function getAllergens(): array
    {
        return $this->allergens;
    }

    /** @return list<string> */
    public function getDiets(): array
    {
        return $this->diets;
    }

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     */
    public function describe(string $name, bool $forChildren, array $allergens, array $diets): void
    {
        $this->name = $name;
        $this->forChildren = $forChildren;
        $this->allergens = $allergens;
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

    public function getPosition(): int
    {
        return $this->position;
    }
}
